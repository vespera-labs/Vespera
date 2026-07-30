import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Property } from '../properties/entities/property.entity';
import { SearchOutboxService } from './search-outbox.service';
import { ElasticsearchService } from './elasticsearch.service';
import { MetricsService } from '../monitoring/metrics.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditLevel } from '../audit/entities/audit-log.entity';
import { listingStatusToVisibility } from './search-visibility';

export interface ReconcileResult {
  checked: number;
  drifted: number;
  missing: number;
  orphaned: number;
  enqueued: number;
  deleted: number;
}

@Injectable()
export class SearchReconcileJob {
  private readonly logger = new Logger(SearchReconcileJob.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    private readonly outboxService: SearchOutboxService,
    private readonly elasticsearch: ElasticsearchService,
    private readonly dataSource: DataSource,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Compare PostgreSQL properties against ES documents.
   * Enqueues outbox rows for drifted/missing docs; deletes orphaned ES docs.
   */
  async run(): Promise<ReconcileResult> {
    const result: ReconcileResult = {
      checked: 0,
      drifted: 0,
      missing: 0,
      orphaned: 0,
      enqueued: 0,
      deleted: 0,
    };

    if (!this.elasticsearch.isEnabled()) {
      this.logger.debug('ES disabled — skipping reconcile');
      return result;
    }

    const properties = await this.propertyRepo.find({
      relations: ['amenities'],
    });
    const pgIds = new Set(properties.map((p) => p.id));

    for (const property of properties) {
      result.checked += 1;
      const esDoc = await this.elasticsearch.getDocument(property.id);
      const expectedVisibility = listingStatusToVisibility(property.status);
      const expectedChecksum = this.outboxService.computeChecksum(property);

      if (!esDoc) {
        result.missing += 1;
        await this.dataSource.transaction(async (manager) => {
          await this.outboxService.enqueueIndex(manager, property);
        });
        result.enqueued += 1;
        this.metricsService.recordSearchReconcile('missing');
        continue;
      }

      const drifted =
        esDoc.visibility !== expectedVisibility ||
        esDoc.checksum !== expectedChecksum ||
        esDoc.tenant_id !== property.ownerId ||
        esDoc.updatedAt !== property.updatedAt?.toISOString();

      if (drifted) {
        result.drifted += 1;
        await this.dataSource.transaction(async (manager) => {
          await this.outboxService.enqueueIndex(manager, property);
        });
        result.enqueued += 1;
        this.metricsService.recordSearchReconcile('drifted');
      }
    }

    const esIds = await this.elasticsearch.scrollAllIds();
    for (const esId of esIds) {
      if (!pgIds.has(esId)) {
        result.orphaned += 1;
        try {
          await this.elasticsearch.removeProperty(esId);
          result.deleted += 1;
          this.metricsService.recordSearchReconcile('orphaned');
        } catch (error) {
          this.logger.warn(
            `Failed to delete orphaned ES doc ${esId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    await this.auditService.log({
      action: AuditAction.SEARCH_RECONCILE,
      entityType: 'search_index',
      level: AuditLevel.INFO,
      metadata: { ...result },
    });

    this.logger.log(
      `Reconcile complete: checked=${result.checked} drifted=${result.drifted} missing=${result.missing} orphaned=${result.orphaned}`,
    );

    return result;
  }
}
