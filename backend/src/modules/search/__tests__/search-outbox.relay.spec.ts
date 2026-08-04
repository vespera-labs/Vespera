import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SearchOutboxRelay } from '../search-outbox.relay';
import { SearchOutboxService } from '../search-outbox.service';
import { ElasticsearchService } from '../elasticsearch.service';
import { MetricsService } from '../../monitoring/metrics.service';
import {
  SearchOutbox,
  SearchOutboxOperation,
  SearchOutboxStatus,
} from '../entities/search-outbox.entity';
import { SearchVisibility } from '../search-visibility';

describe('SearchOutboxRelay', () => {
  let relay: SearchOutboxRelay;
  let outboxService: jest.Mocked<SearchOutboxService>;
  let elasticsearch: jest.Mocked<Partial<ElasticsearchService>>;
  let metrics: jest.Mocked<Partial<MetricsService>>;

  const pendingRow: SearchOutbox = {
    id: 'outbox-1',
    aggregateType: 'property',
    aggregateId: 'prop-1',
    tenantId: 'tenant-1',
    operation: SearchOutboxOperation.INDEX,
    payload: {
      id: 'prop-1',
      tenant_id: 'tenant-1',
      visibility: SearchVisibility.LISTED,
      title: 'Loft',
      description: '',
      type: 'apartment',
      city: 'Lagos',
      state: '',
      country: 'NG',
      price: 100,
      bedrooms: 1,
      bathrooms: 1,
      area: 40,
      amenities: [],
      location: { lat: 0, lon: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    status: SearchOutboxStatus.PENDING,
    attempts: 0,
    createdAt: new Date(),
    processedAt: null,
  };

  beforeEach(async () => {
    outboxService = {
      claimPending: jest.fn(),
      markProcessing: jest.fn(),
      markDone: jest.fn(),
      markFailedOrRetry: jest.fn(),
    } as unknown as jest.Mocked<SearchOutboxService>;

    elasticsearch = {
      isEnabled: jest.fn().mockReturnValue(true),
      indexProperty: jest.fn().mockResolvedValue(undefined),
      removeProperty: jest.fn().mockResolvedValue(undefined),
    };

    metrics = {
      recordSearchOutboxRelay: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchOutboxRelay,
        { provide: SearchOutboxService, useValue: outboxService },
        { provide: ElasticsearchService, useValue: elasticsearch },
        { provide: MetricsService, useValue: metrics },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: number) =>
              key === 'SEARCH_OUTBOX_MAX_ATTEMPTS' ? 3 : fallback,
            ),
          },
        },
        {
          provide: getRepositoryToken(SearchOutbox),
          useValue: {},
        },
      ],
    }).compile();

    relay = module.get(SearchOutboxRelay);
  });

  it('drains pending rows to ES and marks done', async () => {
    outboxService.claimPending.mockResolvedValue([pendingRow]);

    const result = await relay.drain();

    expect(elasticsearch.indexProperty).toHaveBeenCalledWith(
      pendingRow.payload,
      'outbox-1',
    );
    expect(outboxService.markDone).toHaveBeenCalledWith('outbox-1');
    expect(result.succeeded).toBe(1);
    expect(metrics.recordSearchOutboxRelay).toHaveBeenCalledWith('success');
  });

  it('retries transient failures and dead-letters after max attempts', async () => {
    const failing = { ...pendingRow, attempts: 2 };
    outboxService.claimPending.mockResolvedValue([failing]);
    (elasticsearch.indexProperty as jest.Mock).mockRejectedValue(
      new Error('timeout'),
    );

    const result = await relay.drain();

    expect(outboxService.markFailedOrRetry).toHaveBeenCalledWith(
      'outbox-1',
      2,
      3,
    );
    expect(result.deadLetter).toBe(1);
    expect(metrics.recordSearchOutboxRelay).toHaveBeenCalledWith('dead_letter');
  });
});
