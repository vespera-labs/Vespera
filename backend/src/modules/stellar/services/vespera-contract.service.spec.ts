import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VesperaContractService } from './vespera-contract.service';

describe('VesperaContractService', () => {
  let service: VesperaContractService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
        VESPERA_CONTRACT_ID:
          'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        STELLAR_ADMIN_SECRET_KEY: '', // Empty to skip keypair creation in tests
        STELLAR_NETWORK: 'testnet',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have checkHealth method', () => {
    expect(service.checkHealth).toBeDefined();
  });

  it('should have all contract methods', () => {
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
