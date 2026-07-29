import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainQueueProcessor } from '../blockchain.processor';
import { StellarService } from '../../../stellar/services/stellar.service';
import { PaymentProcessingService } from '../../../stellar/services/payment-processing.service';

describe('BlockchainQueueProcessor', () => {
  let processor: BlockchainQueueProcessor;

  const mockStellarService = {
    createEscrow: jest.fn(),
    releaseEscrow: jest.fn(),
    getTransactionByHash: jest.fn(),
  };

  const mockPaymentProcessingService = {
    processRentPayment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainQueueProcessor,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: PaymentProcessingService,
          useValue: mockPaymentProcessingService,
        },
      ],
    }).compile();

    processor = module.get<BlockchainQueueProcessor>(BlockchainQueueProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeJob = (data: any) => ({ id: 1, data }) as any;

  describe('handleBlockchainJob', () => {
    it('throws for unknown job type', async () => {
      const job = makeJob({ type: 'unknown-type', data: {} });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'Unknown blockchain type: unknown-type',
      );
    });

    it('throws for empty string job type', async () => {
      const job = makeJob({ type: '', data: {} });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'Unknown blockchain type: ',
      );
    });

    it('dispatches send-payment and validates required fields', async () => {
      const job = makeJob({
        type: 'send-payment',
        paymentId: 'pay-1',
        data: {
          sourcePublicKey: 'GAAA...',
          amount: '10',
          agreementId: 'agr-1',
        },
      });

      await expect(processor.handleBlockchainJob(job)).resolves.toBeUndefined();
    });

    it('throws when send-payment is missing required fields', async () => {
      const job = makeJob({
        type: 'send-payment',
        data: { sourcePublicKey: 'GAAA...' },
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'send-payment missing required fields',
      );
    });

    it('dispatches create-escrow and calls stellarService', async () => {
      mockStellarService.createEscrow.mockResolvedValue({ id: 1 });
      const job = makeJob({
        type: 'create-escrow',
        agreementId: 'agr-1',
        data: {
          sourcePublicKey: 'GAAA...',
          destinationPublicKey: 'GBBB...',
          amount: '100',
        },
      });

      await processor.handleBlockchainJob(job);

      expect(mockStellarService.createEscrow).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePublicKey: 'GAAA...',
          destinationPublicKey: 'GBBB...',
          amount: '100',
        }),
      );
    });

    it('throws when create-escrow is missing required fields', async () => {
      const job = makeJob({
        type: 'create-escrow',
        data: { sourcePublicKey: 'GAAA...' },
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'create-escrow missing required fields',
      );
    });

    it('dispatches release-escrow and calls stellarService', async () => {
      mockStellarService.releaseEscrow.mockResolvedValue({});
      const job = makeJob({
        type: 'release-escrow',
        agreementId: 'agr-1',
        data: {},
      });

      await processor.handleBlockchainJob(job);

      expect(mockStellarService.releaseEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ escrowId: 'agr-1' }),
      );
    });

    it('throws when release-escrow has neither agreementId nor escrowId', async () => {
      const job = makeJob({
        type: 'release-escrow',
        data: {},
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'release-escrow missing required field',
      );
    });

    it('dispatches release-escrow using data.escrowId when agreementId is absent', async () => {
      mockStellarService.releaseEscrow.mockResolvedValue({});
      const job = makeJob({
        type: 'release-escrow',
        data: { escrowId: 'esc-99' },
      });

      await processor.handleBlockchainJob(job);

      expect(mockStellarService.releaseEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ escrowId: 'esc-99' }),
      );
    });

    it('dispatches sync-transaction and calls stellarService', async () => {
      mockStellarService.getTransactionByHash.mockResolvedValue({
        hash: 'tx-hash-1',
      });
      const job = makeJob({
        type: 'sync-transaction',
        transactionId: 'tx-hash-1',
        data: {},
      });

      await processor.handleBlockchainJob(job);

      expect(mockStellarService.getTransactionByHash).toHaveBeenCalledWith(
        'tx-hash-1',
      );
    });

    it('throws when sync-transaction is missing transactionId', async () => {
      const job = makeJob({
        type: 'sync-transaction',
        data: {},
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'sync-transaction missing required field',
      );
    });

    it('dispatches sync-transaction using data.transactionId as fallback', async () => {
      mockStellarService.getTransactionByHash.mockResolvedValue({});
      const job = makeJob({
        type: 'sync-transaction',
        data: { transactionId: 'tx-hash-2' },
      });

      await processor.handleBlockchainJob(job);

      expect(mockStellarService.getTransactionByHash).toHaveBeenCalledWith(
        'tx-hash-2',
      );
    });

    it('mint-nft always throws (not wired)', async () => {
      const job = makeJob({
        type: 'mint-nft',
        agreementId: 'agr-1',
        data: {},
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'mintNft is not wired',
      );
    });

    it('process-anchor-transaction always throws (not wired)', async () => {
      const job = makeJob({
        type: 'process-anchor-transaction',
        transactionId: 'tx-1',
        data: {},
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'processAnchorTransaction is not wired',
      );
    });

    it('re-throws errors from the dispatch methods', async () => {
      mockStellarService.createEscrow.mockRejectedValue(
        new Error('Stellar network error'),
      );
      const job = makeJob({
        type: 'create-escrow',
        data: {
          sourcePublicKey: 'GAAA...',
          destinationPublicKey: 'GBBB...',
          amount: '100',
        },
      });

      await expect(processor.handleBlockchainJob(job)).rejects.toThrow(
        'Stellar network error',
      );
    });
  });
});
