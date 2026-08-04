import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  SearchOutbox,
  SearchOutboxOperation,
  SearchOutboxStatus,
} from './entities/search-outbox.entity';
import { Property } from '../properties/entities/property.entity';
import { listingStatusToVisibility } from './search-visibility';
import { PropertySearchDocument } from './elasticsearch.service';

export const SEARCH_AGGREGATE_PROPERTY = 'property';

@Injectable()
export class SearchOutboxService {
  constructor(
    @InjectRepository(SearchOutbox)
    private readonly outboxRepo: Repository<SearchOutbox>,
  ) {}

  /**
   * Insert an outbox row inside an existing transaction.
   * Must share the same EntityManager/QueryRunner as the source mutation.
   */
  async enqueueIndex(
    manager: EntityManager,
    property: Property,
  ): Promise<SearchOutbox> {
    const payload = this.toSearchDocument(property);
    const row = manager.create(SearchOutbox, {
      aggregateType: SEARCH_AGGREGATE_PROPERTY,
      aggregateId: property.id,
      tenantId: property.ownerId,
      operation: SearchOutboxOperation.INDEX,
      payload: payload as unknown as Record<string, unknown>,
      status: SearchOutboxStatus.PENDING,
      attempts: 0,
    });
    return manager.save(SearchOutbox, row);
  }

  async enqueueDelete(
    manager: EntityManager,
    propertyId: string,
    tenantId: string,
  ): Promise<SearchOutbox> {
    const row = manager.create(SearchOutbox, {
      aggregateType: SEARCH_AGGREGATE_PROPERTY,
      aggregateId: propertyId,
      tenantId,
      operation: SearchOutboxOperation.DELETE,
      payload: { id: propertyId },
      status: SearchOutboxStatus.PENDING,
      attempts: 0,
    });
    return manager.save(SearchOutbox, row);
  }

  toSearchDocument(property: Property): PropertySearchDocument {
    const amenities = (property.amenities ?? []).map((a) => a.name);
    return {
      id: property.id,
      tenant_id: property.ownerId,
      visibility: listingStatusToVisibility(property.status),
      title: property.title,
      description: property.description ?? '',
      type: property.type,
      city: property.city ?? '',
      state: property.state ?? '',
      country: property.country ?? '',
      price: Number(property.price),
      bedrooms: property.bedrooms ?? 0,
      bathrooms: property.bathrooms ?? 0,
      area: Number(property.area ?? 0),
      amenities,
      location: {
        lat: Number(property.latitude ?? 0),
        lon: Number(property.longitude ?? 0),
      },
      status: property.status,
      checksum: this.computeChecksum(property),
      createdAt: property.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: property.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  computeChecksum(property: Property): string {
    const raw = [
      property.id,
      property.ownerId,
      property.status,
      property.title,
      property.price,
      property.updatedAt?.getTime?.() ?? 0,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `c${Math.abs(hash).toString(16)}`;
  }

  async claimPending(limit = 50): Promise<SearchOutbox[]> {
    return this.outboxRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: SearchOutboxStatus.PENDING })
      .orderBy('o.created_at', 'ASC')
      .take(limit)
      .getMany();
  }

  async markProcessing(id: string): Promise<void> {
    await this.outboxRepo.update(id, {
      status: SearchOutboxStatus.PROCESSING,
    });
  }

  async markDone(id: string): Promise<void> {
    await this.outboxRepo.update(id, {
      status: SearchOutboxStatus.DONE,
      processedAt: new Date(),
    });
  }

  async markFailedOrRetry(
    id: string,
    attempts: number,
    maxAttempts: number,
  ): Promise<void> {
    const nextAttempts = attempts + 1;
    await this.outboxRepo.update(id, {
      attempts: nextAttempts,
      status:
        nextAttempts >= maxAttempts
          ? SearchOutboxStatus.FAILED
          : SearchOutboxStatus.PENDING,
      processedAt: nextAttempts >= maxAttempts ? new Date() : null,
    });
  }
}
