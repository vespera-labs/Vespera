import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SearchReconcileJob } from '../search-reconcile.job';
import { SearchOutboxService } from '../search-outbox.service';
import { ElasticsearchService } from '../elasticsearch.service';
import { MetricsService } from '../../monitoring/metrics.service';
import { AuditService } from '../../audit/audit.service';
import {
  ListingStatus,
  Property,
  PropertyType,
} from '../../properties/entities/property.entity';
import { SearchVisibility } from '../search-visibility';

describe('SearchReconcileJob', () => {
  let job: SearchReconcileJob;
  let outboxService: { enqueueIndex: jest.Mock; computeChecksum: jest.Mock };
  let elasticsearch: {
    isEnabled: jest.Mock;
    getDocument: jest.Mock;
    scrollAllIds: jest.Mock;
    removeProperty: jest.Mock;
  };

  const property = {
    id: 'prop-1',
    ownerId: 'tenant-1',
    title: 'Loft',
    status: ListingStatus.ARCHIVED,
    type: PropertyType.APARTMENT,
    price: 100,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    amenities: [],
  } as unknown as Property;

  beforeEach(async () => {
    outboxService = {
      enqueueIndex: jest.fn().mockResolvedValue({}),
      computeChecksum: jest.fn().mockReturnValue('cabc'),
    };
    elasticsearch = {
      isEnabled: jest.fn().mockReturnValue(true),
      getDocument: jest.fn(),
      scrollAllIds: jest.fn().mockResolvedValue(['prop-1']),
      removeProperty: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchReconcileJob,
        {
          provide: getRepositoryToken(Property),
          useValue: { find: jest.fn().mockResolvedValue([property]) },
        },
        { provide: SearchOutboxService, useValue: outboxService },
        { provide: ElasticsearchService, useValue: elasticsearch },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
              cb({}),
            ),
          },
        },
        {
          provide: MetricsService,
          useValue: { recordSearchReconcile: jest.fn() },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    job = module.get(SearchReconcileJob);
  });

  it('detects a stale ES document and enqueues an outbox index row', async () => {
    elasticsearch.getDocument.mockResolvedValue({
      id: 'prop-1',
      tenant_id: 'tenant-1',
      visibility: SearchVisibility.LISTED, // stale — PG is archived/unlisted
      checksum: 'cold',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const result = await job.run();

    expect(result.drifted).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(outboxService.enqueueIndex).toHaveBeenCalled();
  });
});
