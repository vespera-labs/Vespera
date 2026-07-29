import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { KycStatus, ScreeningStatus } from './kyc-status.enum';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  AuditLevel,
  AuditStatus,
} from '../audit/entities/audit-log.entity';

@Injectable()
export class KycStatusService {
  private readonly logger = new Logger(KycStatusService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async getStatus(
    userId: string,
  ): Promise<{ kyc: KycStatus; screening: ScreeningStatus }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return { kyc: user.kycStatus, screening: user.screeningStatus };
  }

  async isCleared(userId: string): Promise<boolean> {
    const { kyc, screening } = await this.getStatus(userId);
    return kyc === KycStatus.VERIFIED && screening === ScreeningStatus.CLEAR;
  }

  async setKycStatus(
    userId: string,
    status: KycStatus,
    actorId: string,
  ): Promise<void> {
    await this.userRepo.update(userId, { kycStatus: status });
    this.logger.log(
      `KYC status updated for user ${userId}: ${status} by ${actorId}`,
    );
    await this.auditService.log({
      action: AuditAction.KYC_STATUS_CHANGED,
      entityType: 'User',
      entityId: userId,
      performedBy: actorId,
      status: AuditStatus.SUCCESS,
      level: AuditLevel.SECURITY,
      metadata: { newStatus: status },
    });
  }

  async setScreeningStatus(
    userId: string,
    status: ScreeningStatus,
    actorId: string,
  ): Promise<void> {
    await this.userRepo.update(userId, { screeningStatus: status });
    this.logger.log(
      `Screening status updated for user ${userId}: ${status} by ${actorId}`,
    );
    await this.auditService.log({
      action: AuditAction.KYC_STATUS_CHANGED,
      entityType: 'User',
      entityId: userId,
      performedBy: actorId,
      status: AuditStatus.SUCCESS,
      level: AuditLevel.SECURITY,
      metadata: { newScreeningStatus: status },
    });
  }
}
