import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  Property,
  PropertyType,
  ListingStatus,
} from '../properties/entities/property.entity';
import { CacheService } from '../../common/cache/cache.service';
import {
  CACHE_PREFIX_SEARCH_PROPERTIES,
  CACHE_PREFIX_SUGGEST,
  TTL_SEARCH_RESULTS_MS,
  TTL_SUGGEST_MS,
} from '../../common/cache/cache.constants';
import {
  ElasticsearchService,
  EsSearchFilters,
  EsSearchResult,
  PropertySearchDocument,
} from './elasticsearch.service';
import { TenantContext } from './tenant-context';
import { SearchScopeError } from './search-scope.error';
import { visibilityToListingStatus } from './search-visibility';

export interface SearchFilters {
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  type?: PropertyType;
  status?: ListingStatus;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  isFurnished?: boolean;
  hasParking?: boolean;
  petsAllowed?: boolean;
  // Geospatial
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  types: Array<{ type: string; count: number }>;
  cities: Array<{ city: string; count: number }>;
  priceRanges: Array<{
    label: string;
    min: number;
    max: number;
    count: number;
  }>;
  amenities: {
    furnished: number;
    parking: number;
    petsAllowed: number;
  };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    private readonly cacheService: CacheService,
    private readonly elasticsearch: ElasticsearchService,
  ) {}

  /**
   * Tenant-scoped Elasticsearch query.
   * Invariant: every ES body includes non-removable tenant_id + visibility filters.
   * Throws SearchScopeError when tenant context is missing.
   */
  async query(
    tenant: TenantContext | null | undefined,
    filters: EsSearchFilters = {},
  ): Promise<EsSearchResult<PropertySearchDocument>> {
    if (!tenant?.tenantId) {
      throw new SearchScopeError();
    }
    if (!tenant.allowedVisibilities?.length) {
      throw new SearchScopeError('visibility scope is required for search');
    }

    // Prefer ES when available; fall back to scoped Postgres.
    if (this.elasticsearch.isEnabled()) {
      return this.elasticsearch.search(tenant, filters);
    }

    return this.queryPostgresFallback(tenant, filters);
  }

  private async queryPostgresFallback(
    tenant: TenantContext,
    filters: EsSearchFilters,
  ): Promise<EsSearchResult<PropertySearchDocument>> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const allowedStatuses = tenant.allowedVisibilities.map(
      visibilityToListingStatus,
    );

    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.amenities', 'amenities')
      .where('property.owner_id = :tenantId', { tenantId: tenant.tenantId })
      .andWhere('property.status IN (:...statuses)', {
        statuses: allowedStatuses,
      });

    if (filters.query) {
      qb.andWhere(
        `(to_tsvector('english', property.title || ' ' || COALESCE(property.description, '')) @@ plainto_tsquery('english', :query) OR property.address ILIKE :likeQuery)`,
        { query: filters.query, likeQuery: `%${filters.query}%` },
      );
    }
    if (filters.city) {
      qb.andWhere('property.city ILIKE :city', { city: `%${filters.city}%` });
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere('property.price >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere('property.price <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('property.bedrooms >= :bedrooms', {
        bedrooms: filters.bedrooms,
      });
    }

    const searchBody = this.elasticsearch.buildScopedSearchBody(
      tenant,
      filters,
    );

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('property.createdAt', 'DESC')
      .getManyAndCount();

    return {
      hits: items.map((p) => ({
        id: p.id,
        tenant_id: p.ownerId,
        visibility: tenant.allowedVisibilities[0],
        title: p.title,
        description: p.description ?? '',
        type: p.type,
        city: p.city ?? '',
        state: p.state ?? '',
        country: p.country ?? '',
        price: Number(p.price),
        bedrooms: p.bedrooms ?? 0,
        bathrooms: p.bathrooms ?? 0,
        area: Number(p.area ?? 0),
        amenities: (p.amenities ?? []).map((a) => a.name),
        location: {
          lat: Number(p.latitude ?? 0),
          lon: Number(p.longitude ?? 0),
        },
        status: p.status,
        createdAt: p.createdAt?.toISOString?.() ?? '',
        updatedAt: p.updatedAt?.toISOString?.() ?? '',
      })),
      total,
      page,
      limit,
      facets: {},
      searchBody,
    };
  }

  async searchProperties(
    filters: SearchFilters,
    page = 1,
    limit = 20,
  ): Promise<SearchResult<Property>> {
    const cacheKey = `${CACHE_PREFIX_SEARCH_PROPERTIES}:${JSON.stringify({ filters, page, limit })}`;
    return this.cacheService.getOrSet(
      cacheKey,
      () => this.executeSearchProperties(filters, page, limit),
      TTL_SEARCH_RESULTS_MS,
    );
  }

  private async executeSearchProperties(
    filters: SearchFilters,
    page: number,
    limit: number,
  ): Promise<SearchResult<Property>> {
    const qb = this.buildPropertyQuery(filters);
    const countQb = this.buildPropertyQuery(filters);

    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('property.createdAt', 'DESC');

    const [items, total] = await Promise.all([
      qb.getMany(),
      countQb.getCount(),
    ]);

    const facets = await this.buildFacets(filters);

    return {
      items,
      total,
      page,
      limit,
      facets,
    };
  }

  async suggest(partialQuery: string, limit = 10): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) return [];

    const cacheKey = `${CACHE_PREFIX_SUGGEST}:${partialQuery}`;
    return this.cacheService.getOrSet(
      cacheKey,
      () => this.executeSuggest(partialQuery, limit),
      TTL_SUGGEST_MS,
    );
  }

  private async executeSuggest(
    partialQuery: string,
    limit: number,
  ): Promise<string[]> {
    const results = await this.propertyRepo
      .createQueryBuilder('property')
      .select(['property.title', 'property.city', 'property.address'])
      .where(
        'property.title ILIKE :q OR property.city ILIKE :q OR property.address ILIKE :q',
        {
          q: `${partialQuery}%`,
        },
      )
      .andWhere('property.status = :status', {
        status: ListingStatus.PUBLISHED,
      })
      .limit(limit)
      .getMany();

    return [
      ...new Set([
        ...results.map((p) => p.title),
        ...results.map((p) => p.city).filter(Boolean),
      ]),
    ].slice(0, limit);
  }

  private buildPropertyQuery(
    filters: SearchFilters,
  ): SelectQueryBuilder<Property> {
    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .leftJoinAndSelect('property.amenities', 'amenities');

    if (filters.query) {
      qb.andWhere(
        `(to_tsvector('english', property.title || ' ' || COALESCE(property.description, '')) @@ plainto_tsquery('english', :query) OR property.address ILIKE :likeQuery)`,
        { query: filters.query, likeQuery: `%${filters.query}%` },
      );
    }

    if (filters.city) {
      qb.andWhere('property.city ILIKE :city', { city: `%${filters.city}%` });
    }
    if (filters.state) {
      qb.andWhere('property.state ILIKE :state', {
        state: `%${filters.state}%`,
      });
    }
    if (filters.country) {
      qb.andWhere('property.country = :country', { country: filters.country });
    }
    if (filters.type) {
      qb.andWhere('property.type = :type', { type: filters.type });
    }
    if (filters.status) {
      qb.andWhere('property.status = :status', { status: filters.status });
    } else {
      qb.andWhere('property.status = :status', {
        status: ListingStatus.PUBLISHED,
      });
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere('property.price >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere('property.price <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('property.bedrooms >= :bedrooms', {
        bedrooms: filters.bedrooms,
      });
    }
    if (filters.bathrooms !== undefined) {
      qb.andWhere('property.bathrooms >= :bathrooms', {
        bathrooms: filters.bathrooms,
      });
    }
    if (filters.isFurnished !== undefined) {
      qb.andWhere('property.is_furnished = :isFurnished', {
        isFurnished: filters.isFurnished,
      });
    }
    if (filters.hasParking !== undefined) {
      qb.andWhere('property.has_parking = :hasParking', {
        hasParking: filters.hasParking,
      });
    }
    if (filters.petsAllowed !== undefined) {
      qb.andWhere('property.pets_allowed = :petsAllowed', {
        petsAllowed: filters.petsAllowed,
      });
    }

    if (
      filters.lat !== undefined &&
      filters.lng !== undefined &&
      filters.radiusKm !== undefined
    ) {
      qb.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(CAST(property.latitude AS float))) * cos(radians(CAST(property.longitude AS float)) - radians(:lng)) + sin(radians(:lat)) * sin(radians(CAST(property.latitude AS float))))) <= :radius`,
        { lat: filters.lat, lng: filters.lng, radius: filters.radiusKm },
      );
    }

    return qb;
  }

  private async buildFacets(baseFilters: SearchFilters): Promise<SearchFacets> {
    const baseQb = () => {
      const qb = this.propertyRepo.createQueryBuilder('property');
      if (baseFilters.query) {
        qb.andWhere(
          `to_tsvector('english', property.title || ' ' || COALESCE(property.description, '')) @@ plainto_tsquery('english', :query)`,
          { query: baseFilters.query },
        );
      }
      qb.andWhere('property.status = :status', {
        status: ListingStatus.PUBLISHED,
      });
      return qb;
    };

    const [typeFacets, cityFacets, amenityCounts] = await Promise.all([
      baseQb()
        .select('property.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('property.type')
        .getRawMany(),
      baseQb()
        .select('property.city', 'city')
        .addSelect('COUNT(*)', 'count')
        .groupBy('property.city')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      baseQb()
        .select([
          'SUM(CASE WHEN property.is_furnished = true THEN 1 ELSE 0 END) as furnished',
          'SUM(CASE WHEN property.has_parking = true THEN 1 ELSE 0 END) as parking',
          'SUM(CASE WHEN property.pets_allowed = true THEN 1 ELSE 0 END) as pets_allowed',
        ])
        .getRawOne(),
    ]);

    return {
      types: typeFacets.map((r) => ({
        type: r.type,
        count: parseInt(r.count),
      })),
      cities: cityFacets.map((r) => ({
        city: r.city,
        count: parseInt(r.count),
      })),
      priceRanges: [
        { label: 'Under $500', min: 0, max: 500, count: 0 },
        { label: '$500-$1000', min: 500, max: 1000, count: 0 },
        { label: '$1000-$2000', min: 1000, max: 2000, count: 0 },
        { label: 'Over $2000', min: 2000, max: 999999, count: 0 },
      ],
      amenities: {
        furnished: parseInt(amenityCounts?.furnished) || 0,
        parking: parseInt(amenityCounts?.parking) || 0,
        petsAllowed: parseInt(amenityCounts?.pets_allowed) || 0,
      },
    };
  }
}
