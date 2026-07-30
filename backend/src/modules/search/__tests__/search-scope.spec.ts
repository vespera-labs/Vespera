import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from '../search.service';
import { Property } from '../../properties/entities/property.entity';
import { CacheService } from '../../../common/cache/cache.service';
import { ElasticsearchService } from '../elasticsearch.service';
import { SearchScopeError } from '../search-scope.error';
import { SearchVisibility } from '../search-visibility';
import { discoveryTenantContext } from '../tenant-context';
import { ConfigService } from '@nestjs/config';

describe('SearchService.query scope', () => {
  let service: SearchService;
  let elasticsearch: ElasticsearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        ElasticsearchService,
        {
          provide: getRepositoryToken(Property),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            })),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn((_k: string, fn: () => Promise<unknown>) => fn()),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
          },
        },
      ],
    }).compile();

    service = module.get(SearchService);
    elasticsearch = module.get(ElasticsearchService);
    elasticsearch.setEnabledForTests(false);
  });

  it('throws SearchScopeError when tenant is absent', async () => {
    await expect(service.query(null, {})).rejects.toBeInstanceOf(
      SearchScopeError,
    );
    await expect(service.query(undefined, {})).rejects.toBeInstanceOf(
      SearchScopeError,
    );
    await expect(
      service.query({ tenantId: '', allowedVisibilities: [SearchVisibility.LISTED] }),
    ).rejects.toBeInstanceOf(SearchScopeError);
  });

  it('always emits both tenant_id and visibility filters in the ES body', async () => {
    const tenant = discoveryTenantContext('tenant-abc');
    const result = await service.query(tenant, { city: 'Lagos', page: 1 });

    expect(result.searchBody).toBeDefined();
    const filter = (
      result.searchBody as {
        query: { bool: { filter: Array<Record<string, unknown>> } };
      }
    ).query.bool.filter;

    expect(filter).toEqual(
      expect.arrayContaining([
        { term: { tenant_id: 'tenant-abc' } },
        { terms: { visibility: [SearchVisibility.LISTED] } },
      ]),
    );

    // Caller-supplied city is additive; scope filters remain.
    expect(filter).toEqual(
      expect.arrayContaining([{ term: { city: 'Lagos' } }]),
    );
  });

  it('buildScopedSearchBody rejects missing visibility set', () => {
    expect(() =>
      elasticsearch.buildScopedSearchBody(
        { tenantId: 't1', allowedVisibilities: [] },
        {},
      ),
    ).toThrow(SearchScopeError);
  });
});
