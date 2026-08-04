import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KycPropagationOutbox,
  PropagationStatus,
} from './kyc-propagation-outbox.entity';
import { KycStatus, ScreeningStatus } from './kyc-status.enum';

@Injectable()
export class KycPropagationService {
  private readonly logger = new Logger(KycPropagationService.name);

  constructor(
    @InjectRepository(KycPropagationOutbox)
    private readonly outboxRepo: Repository<KycPropagationOutbox>,
  ) {}

  /**
   * Enqueue a status transition for propagation to the on-chain
   * user_profile contract. Uses the outbox pattern for at-least-once delivery.
   */
  async enqueue(
    userId: string,
    walletAddress: string,
    kycStatus: KycStatus,
    screeningStatus: ScreeningStatus,
  ): Promise<void> {
    const record = this.outboxRepo.create({
      userId,
      walletAddress,
      kycStatus,
      screeningStatus,
      status: PropagationStatus.PENDING,
    });
    await this.outboxRepo.save(record);
    this.logger.log(
      `Enqueued KYC propagation for user ${userId}: kyc=${kycStatus}, screening=${screeningStatus}`,
    );
  }

  /**
   * Process pending outbox entries. Called by the Bull queue processor.
   * Marks entries as SENT on success, increments attempts on failure,
   * and marks as FAILED after max retries.
   */
  async processPending(): Promise<{ processed: number; failed: number }> {
    const pending = await this.outboxRepo.find({
      where: { status: PropagationStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    let processed = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        // TODO: Submit to Stellar user_profile contract via blockchain service
        // await this.blockchainService.updateUserProfileStatus(
        //   record.walletAddress,
        //   record.kycStatus,
        //   record.screeningStatus,
        // );
        this.logger.log(
          `KYC propagation for user ${record.userId}: kyc=${record.kycStatus}, screening=${record.screeningStatus}`,
        );
        record.status = PropagationStatus.SENT;
        processed++;
      } catch (error) {
        record.attempts += 1;
        record.lastError = error instanceof Error ? error.message : String(error);
        if (record.attempts >= 5) {
          record.status = PropagationStatus.FAILED;
          this.logger.error(
            `KYC propagation FAILED for user ${record.userId} after ${record.attempts} attempts`,
          );
        }
        failed++;
      }
      await this.outboxRepo.save(record);
    }

    return { processed, failed };
  }

  /**
   * Get pending count for monitoring.
   */
  async getPendingCount(): Promise<number> {
    return this.outboxRepo.count({
      where: { status: PropagationStatus.PENDING },
    });
  }

  /**
   * Retry a failed record.
   */
  async retryFailed(recordId: string): Promise<void> {
    await this.outboxRepo.update(recordId, {
      status: PropagationStatus.PENDING,
      attempts: 0,
      lastError: null,
    });
  }
}
