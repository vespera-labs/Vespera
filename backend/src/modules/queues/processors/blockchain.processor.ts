
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { StellarService } from "../../stellar/services/stellar.service";
import { PaymentProcessingService } from "../../stellar/services/payment-processing.service";

export interface BlockchainJobData {
  type:
    | "send-payment"
    | "create-escrow"
    | "release-escrow"
    | "mint-nft"
    | "sync-transaction"
    | "process-anchor-transaction";
  transactionId?: string;
  agreementId?: string;
  paymentId?: string;
  data: Record<string, unknown>;
}

@Processor("blockchain")
export class BlockchainQueueProcessor {
  private readonly logger = new Logger(BlockchainQueueProcessor.name);

  constructor(
    private readonly stellarService: StellarService,
    private readonly paymentProcessingService: PaymentProcessingService,
  ) {}

  @Process()
  async handleBlockchainJob(job: Job<BlockchainJobData>): Promise<void> {
    this.logger.log();
    try {
      switch (job.data.type) {
        case "send-payment":
          await this.sendPayment(job.data);
          break;
        case "create-escrow":
          await this.createEscrow(job.data);
          break;
        case "release-escrow":
          await this.releaseEscrow(job.data);
          break;
        case "mint-nft":
          await this.mintNft(job.data);
          break;
        case "sync-transaction":
          await this.syncTransaction(job.data);
          break;
        case "process-anchor-transaction":
          await this.processAnchorTransaction(job.data);
          break;
        default:
          throw new Error();
      }
      this.logger.log();
    } catch (error) {
      this.logger.error(
        ,
        error instanceof Error ? error.stack : "",
      );
      throw error;
    }
  }

  // FIX #26: Wire to real StellarService instead of debug-log stubs

  private async sendPayment(data: BlockchainJobData): Promise<void> {
    const { paymentId, agreementId } = data;
    if (!paymentId || !agreementId) {
      throw new Error("send-payment requires paymentId and agreementId");
    }
    this.logger.log();
    await this.paymentProcessingService.processStellarRentPayment({
      paymentId,
      agreementId,
      ...(data.data as { tenantAddress: string; amount: number; token: string }),
    });
  }

  private async createEscrow(data: BlockchainJobData): Promise<void> {
    const { agreementId } = data;
    if (!agreementId) throw new Error("create-escrow requires agreementId");
    this.logger.log();
    await this.stellarService.createEscrow(
      agreementId,
      data.data as { depositorAddress: string; amount: number; token: string },
    );
  }

  private async releaseEscrow(data: BlockchainJobData): Promise<void> {
    const { agreementId } = data;
    if (!agreementId) throw new Error("release-escrow requires agreementId");
    this.logger.log();
    await this.stellarService.releaseEscrow(
      agreementId,
      data.data as { releaseTo: string },
    );
  }

  private async mintNft(data: BlockchainJobData): Promise<void> {
    const { agreementId } = data;
    if (!agreementId) throw new Error("mint-nft requires agreementId");
    this.logger.log();
    await this.stellarService.mintAgreementNft(
      agreementId,
      data.data as { recipientAddress: string },
    );
  }

  private async syncTransaction(data: BlockchainJobData): Promise<void> {
    const { transactionId } = data;
    if (!transactionId) throw new Error("sync-transaction requires transactionId");
    this.logger.log();
    await this.stellarService.syncTransactionStatus(transactionId);
  }

  private async processAnchorTransaction(data: BlockchainJobData): Promise<void> {
    const { transactionId } = data;
    if (!transactionId) throw new Error("process-anchor-transaction requires transactionId");
    this.logger.log();
    await this.stellarService.processAnchorDeposit(transactionId);
  }
}
