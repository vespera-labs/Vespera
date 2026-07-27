import { SearchOutboxService } from '../search-outbox.service';
import {
  SearchOutbox,
  SearchOutboxOperation,
  SearchOutboxStatus,
} from '../entities/search-outbox.entity';
import {
  ListingStatus,
  Property,
  PropertyType,
} from '../../properties/entities/property.entity';
import { EntityManager } from 'typeorm';

describe('SearchOutboxService transactional insert', () => {
  it('persists the outbox row via the provided EntityManager (same TX)', async () => {
    const saved: SearchOutbox[] = [];
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, row) => {
        saved.push(row as SearchOutbox);
        return { ...row, id: 'outbox-tx-1' };
      }),
    } as unknown as EntityManager;

    const service = new SearchOutboxService({} as never);

    const property = {
      id: 'prop-1',
      ownerId: 'tenant-1',
      title: 'Loft',
      description: 'Nice',
      type: PropertyType.APARTMENT,
      status: ListingStatus.PUBLISHED,
      price: 100,
      city: 'Lagos',
      state: '',
      country: 'NG',
      bedrooms: 1,
      bathrooms: 1,
      area: 40,
      latitude: 0,
      longitude: 0,
      amenities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Property;

    await service.enqueueIndex(manager, property);

    expect(manager.save).toHaveBeenCalled();
    expect(saved[0].aggregateId).toBe('prop-1');
    expect(saved[0].tenantId).toBe('tenant-1');
    expect(saved[0].operation).toBe(SearchOutboxOperation.INDEX);
    expect(saved[0].status).toBe(SearchOutboxStatus.PENDING);
  });

  it('documents that rolling back the source TX rolls back the outbox row', () => {
    // Invariant: enqueueIndex uses manager.save (not a separate connection).
    // If the caller's dataSource.transaction rolls back, the outbox insert is undone.
    const source = SearchOutboxService.prototype.enqueueIndex.toString();
    expect(source).toContain('manager.save');
    expect(source).not.toContain('this.outboxRepo.save');
  });
});
