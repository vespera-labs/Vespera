import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VesperaContractService } from './vespera-contract.service';

describe('VesperaContractService', () => {
  let service: VesperaContractService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, string> = {
        SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
        VESPERA_CONTRACT_ID:
          'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        STELLAR_ADMIN_SECRET_KEY: '',
        STELLAR_NETWORK: 'testnet',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VesperaContractService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<VesperaContractService>(VesperaContractService);
  });

  it('reads the Vespera contract id from the rebranded environment key', () => {
    expect(service).toBeDefined();
    expect(mockConfigService.get).toHaveBeenCalledWith('VESPERA_CONTRACT_ID');
  });

  it('exposes the contract methods used by agreement workflows', () => {
    expect(service.createAgreement).toBeDefined();
    expect(service.signAgreement).toBeDefined();
    expect(service.submitAgreement).toBeDefined();
    expect(service.cancelAgreement).toBeDefined();
    expect(service.getAgreement).toBeDefined();
    expect(service.hasAgreement).toBeDefined();
    expect(service.getAgreementCount).toBeDefined();
    expect(service.getPaymentSplit).toBeDefined();
  });
});
