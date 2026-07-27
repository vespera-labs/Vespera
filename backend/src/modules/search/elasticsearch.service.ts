import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchVisibility } from './search-visibility';
import { TenantContext } from './tenant-context';
import { SearchScopeError } from './search-scope.error';

export interface PropertySearchDocument {
  id: string;
  tenant_id: string;
  visibility: SearchVisibility | string;
  title: string;
  description: string;
  type: string;
  city: string;
  state: string;
  country: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  amenities: string[];
  location: {
    lat: number;
    lon: number;
  };
  status?: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsSearchFilters {
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  location?: {
    lat: number;
    lon: number;
    radius: string;
  };
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EsSearchResult<T> {
  hits: T[];
  total: number;
  page: number;
  limit: number;
  facets: Record<string, Array<{ key: string; count: number }>>;
  /** Exposed for tests / PR attachments — the ES body that was sent. */
  searchBody?: Record<string, unknown>;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly esUrl: string;
  private readonly indexPrefix: string;
  private enabled = false;

  constructor(private configService: ConfigService) {
    this.esUrl = this.configService.get<string>(
      'ELASTICSEARCH_NODE',
      this.configService.get<string>(
        'ELASTICSEARCH_URL',
        'http://localhost:9200',
      )!,
    );
    this.indexPrefix = this.configService.get<string>(
      'SEARCH_INDEX_PREFIX',
      'vespera',
    );
  }

  get indexName(): string {
    return `${this.indexPrefix}-properties`;
  }

  async onModuleInit(): Promise<void> {
    try {
      const response = await fetch(this.esUrl);
      if (response.ok) {
        this.enabled = true;
        this.logger.log('Elasticsearch connection established');
        await this.ensureIndex();
      }
    } catch {
      this.logger.warn(
        'Elasticsearch not available, falling back to PostgreSQL search',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Test helper to force enable/disable without a live cluster. */
  setEnabledForTests(enabled: boolean): void {
    this.enabled = enabled;
  }

  private async ensureIndex(): Promise<void> {
    const exists = await fetch(`${this.esUrl}/${this.indexName}`);
    if (exists.status === 404) {
      await this.createIndex();
    }
  }

  private async createIndex(): Promise<void> {
    const mapping = {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            property_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          tenant_id: { type: 'keyword' },
          visibility: { type: 'keyword' },
          status: { type: 'keyword' },
          checksum: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'property_analyzer',
            fields: { keyword: { type: 'keyword' } },
          },
          description: { type: 'text', analyzer: 'property_analyzer' },
          type: { type: 'keyword' },
          city: { type: 'keyword' },
          state: { type: 'keyword' },
          country: { type: 'keyword' },
          price: { type: 'float' },
          bedrooms: { type: 'integer' },
          bathrooms: { type: 'integer' },
          area: { type: 'float' },
          amenities: { type: 'keyword' },
          location: { type: 'geo_point' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    };

    const response = await fetch(`${this.esUrl}/${this.indexName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });

    if (response.ok) {
      this.logger.log(`Index '${this.indexName}' created`);
    } else {
      const error = await response.text();
      this.logger.error(`Failed to create index: ${error}`);
    }
  }

  async indexProperty(
    doc: PropertySearchDocument,
    idempotencyKey?: string,
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error('Elasticsearch is not enabled');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(
      `${this.esUrl}/${this.indexName}/_doc/${doc.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(doc),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ES index failed: ${response.status} ${text}`);
    }
  }

  async removeProperty(id: string, idempotencyKey?: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Elasticsearch is not enabled');
    }

    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(
      `${this.esUrl}/${this.indexName}/_doc/${id}`,
      {
        method: 'DELETE',
        headers,
      },
    );

    // 404 is idempotent success for deletes
    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`ES delete failed: ${response.status} ${text}`);
    }
  }

  async bulkIndex(docs: PropertySearchDocument[]): Promise<void> {
    if (!this.enabled || docs.length === 0) return;

    const body =
      docs
        .flatMap((doc) => [
          JSON.stringify({ index: { _index: this.indexName, _id: doc.id } }),
          JSON.stringify(doc),
        ])
        .join('\n') + '\n';

    const response = await fetch(`${this.esUrl}/_bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body,
    });

    if (!response.ok) {
      throw new Error('Bulk indexing failed');
    }
  }

  /**
   * Build a scoped ES search body. Always includes non-removable tenant_id
   * and visibility filters derived from TenantContext.
   */
  buildScopedSearchBody(
    tenant: TenantContext,
    filters: EsSearchFilters,
  ): Record<string, unknown> {
    if (!tenant?.tenantId) {
      throw new SearchScopeError('tenant_id is required for search');
    }
    if (!tenant.allowedVisibilities?.length) {
      throw new SearchScopeError('visibility scope is required for search');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;

    const must: Record<string, unknown>[] = [];
    // Mandatory, non-removable scope filters — never accept from caller.
    const filterClauses: Record<string, unknown>[] = [
      { term: { tenant_id: tenant.tenantId } },
      { terms: { visibility: tenant.allowedVisibilities } },
    ];

    if (filters.query) {
      must.push({
        multi_match: {
          query: filters.query,
          fields: ['title^3', 'description', 'city^2', 'state', 'amenities'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters.city) filterClauses.push({ term: { city: filters.city } });
    if (filters.state) filterClauses.push({ term: { state: filters.state } });
    if (filters.country)
      filterClauses.push({ term: { country: filters.country } });
    if (filters.type) filterClauses.push({ term: { type: filters.type } });
    if (filters.bedrooms)
      filterClauses.push({ term: { bedrooms: filters.bedrooms } });
    if (filters.bathrooms)
      filterClauses.push({ term: { bathrooms: filters.bathrooms } });

    if (filters.minPrice || filters.maxPrice) {
      const range: Record<string, number> = {};
      if (filters.minPrice) range.gte = filters.minPrice;
      if (filters.maxPrice) range.lte = filters.maxPrice;
      filterClauses.push({ range: { price: range } });
    }

    if (filters.amenities && filters.amenities.length > 0) {
      filterClauses.push({ terms: { amenities: filters.amenities } });
    }

    if (filters.location) {
      filterClauses.push({
        geo_distance: {
          distance: filters.location.radius || '10km',
          location: {
            lat: filters.location.lat,
            lon: filters.location.lon,
          },
        },
      });
    }

    const sort: Record<string, unknown>[] = [];
    if (filters.sortBy) {
      sort.push({ [filters.sortBy]: { order: filters.sortOrder || 'desc' } });
    } else {
      sort.push({ _score: { order: 'desc' } });
    }

    const aggs = {
      types: { terms: { field: 'type', size: 20 } },
      cities: { terms: { field: 'city', size: 50 } },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'Under 500', to: 500 },
            { key: '500-1000', from: 500, to: 1000 },
            { key: '1000-2000', from: 1000, to: 2000 },
            { key: '2000-5000', from: 2000, to: 5000 },
            { key: 'Over 5000', from: 5000 },
          ],
        },
      },
      amenities: { terms: { field: 'amenities', size: 30 } },
    };

    return {
      from,
      size: limit,
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter: filterClauses,
        },
      },
      sort,
      aggs,
    };
  }

  async search(
    tenant: TenantContext,
    filters: EsSearchFilters,
  ): Promise<EsSearchResult<PropertySearchDocument>> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const searchBody = this.buildScopedSearchBody(tenant, filters);

    if (!this.enabled) {
      return { hits: [], total: 0, page, limit, facets: {}, searchBody };
    }

    const response = await fetch(`${this.esUrl}/${this.indexName}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      this.logger.error('Search query failed');
      return { hits: [], total: 0, page, limit, facets: {}, searchBody };
    }

    const data = await response.json();

    const hits = (data.hits?.hits || []).map(
      (hit: { _source: PropertySearchDocument }) => hit._source,
    );
    const total =
      typeof data.hits?.total === 'object'
        ? data.hits.total.value
        : data.hits?.total || 0;

    const facets: Record<string, Array<{ key: string; count: number }>> = {};
    if (data.aggregations) {
      for (const [name, agg] of Object.entries(
        data.aggregations as Record<string, { buckets?: Array<{ key: string; doc_count: number }> }>,
      )) {
        facets[name] = (agg.buckets || []).map((b) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
    }

    return { hits, total, page, limit, facets, searchBody };
  }

  async getDocument(id: string): Promise<PropertySearchDocument | null> {
    if (!this.enabled) return null;
    const response = await fetch(
      `${this.esUrl}/${this.indexName}/_doc/${id}`,
    );
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const data = await response.json();
    return (data._source as PropertySearchDocument) ?? null;
  }

  async scrollAllIds(): Promise<string[]> {
    if (!this.enabled) return [];
    const response = await fetch(`${this.esUrl}/${this.indexName}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: 1000,
        _source: false,
        query: { match_all: {} },
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.hits?.hits || []).map((h: { _id: string }) => h._id);
  }
}
