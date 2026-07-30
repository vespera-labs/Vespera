import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchOutboxService } from './search-outbox.service';
import { ElasticsearchService, PropertySearchDocument } from './elasticsearch.service';
import {
  SearchOutboxOperation,
} from './entities/search-outbox.entity';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class SearchOutboxRelay {
  private readonly logger = new Logger(SearchOutboxRelay.name);
  private readonly maxAttempts: number;
  private running = false;

  constructor(
    private readonly outboxService: SearchOutboxService,
    private readonly elasticsearch: ElasticsearchService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.maxAttempts = this.configService.get<number>(
      'SEARCH_OUTBOX_MAX_ATTEMPTS',
      5,
    );
  }

  /**
   * Drain pending outbox rows to Elasticsearch.
   * Idempotent per outbox id. Retries with attempt counter; dead-letters after max.
   */
  async drain(batchSize = 50): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    deadLetter: number;
  }> {
    if (this.running) {
      return { processed: 0, succeeded: 0, failed: 0, deadLetter: 0 };
    }
    this.running = true;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let deadLetter = 0;

    try {
      if (!this.elasticsearch.isEnabled()) {
        this.logger.debug('ES disabled — skipping outbox relay');
        return { processed, succeeded, failed, deadLetter };
      }

      const pending = await this.outboxService.claimPending(batchSize);

      for (const row of pending) {
        processed += 1;
        await this.outboxService.markProcessing(row.id);

        try {
          if (row.operation === SearchOutboxOperation.INDEX) {
            await this.elasticsearch.indexProperty(
              row.payload as unknown as PropertySearchDocument,
              row.id,
            );
          } else if (row.operation === SearchOutboxOperation.DELETE) {
            await this.elasticsearch.removeProperty(row.aggregateId, row.id);
          }

          await this.outboxService.markDone(row.id);
          succeeded += 1;
          this.metricsService.recordSearchOutboxRelay('success');
        } catch (error) {
          this.logger.warn(
            `Outbox ${row.id} attempt ${row.attempts + 1} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          await this.outboxService.markFailedOrRetry(
            row.id,
            row.attempts,
            this.maxAttempts,
          );
          const nextAttempts = row.attempts + 1;
          if (nextAttempts >= this.maxAttempts) {
            deadLetter += 1;
            this.metricsService.recordSearchOutboxRelay('dead_letter');
          } else {
            failed += 1;
            this.metricsService.recordSearchOutboxRelay('retry');
          }
        }
      }
    } finally {
      this.running = false;
    }

    return { processed, succeeded, failed, deadLetter };
  }
}
