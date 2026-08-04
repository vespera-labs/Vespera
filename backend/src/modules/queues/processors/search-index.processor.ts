import { Process, Processor, OnQueueActive } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SearchOutboxRelay } from '../../search/search-outbox.relay';
import { SearchReconcileJob } from '../../search/search-reconcile.job';

export type SearchIndexJobType = 'relay' | 'reconcile';

export interface SearchIndexJobData {
  type: SearchIndexJobType;
}

export const SEARCH_INDEX_QUEUE = 'search-index';

@Processor(SEARCH_INDEX_QUEUE)
export class SearchIndexProcessor implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  constructor(
    @InjectQueue(SEARCH_INDEX_QUEUE) private readonly searchIndexQueue: Queue,
    private readonly relay: SearchOutboxRelay,
    private readonly reconcileJob: SearchReconcileJob,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const pollIntervalMs = this.configService.get<number>(
      'SEARCH_OUTBOX_POLL_INTERVAL_MS',
      5000,
    );
    const reconcileCron = this.configService.get<string>(
      'SEARCH_RECONCILE_CRON',
      '0 */15 * * * *', // every 15 minutes
    );

    // Repeatable relay drain
    await this.searchIndexQueue.add(
      { type: 'relay' } satisfies SearchIndexJobData,
      {
        jobId: 'search-outbox-relay',
        repeat: { every: pollIntervalMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    // Repeatable reconcile (Bull cron)
    await this.searchIndexQueue.add(
      { type: 'reconcile' } satisfies SearchIndexJobData,
      {
        jobId: 'search-reconcile',
        repeat: { cron: reconcileCron },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Registered search-index repeatables (relay every ${pollIntervalMs}ms, reconcile cron=${reconcileCron})`,
    );
  }

  @OnQueueActive()
  onActive(job: Job<SearchIndexJobData>): void {
    this.logger.debug(`Processing search-index job ${job.id}: ${job.data.type}`);
  }

  @Process()
  async handle(job: Job<SearchIndexJobData>): Promise<void> {
    switch (job.data.type) {
      case 'relay':
        await this.relay.drain();
        break;
      case 'reconcile':
        await this.reconcileJob.run();
        break;
      default:
        throw new Error(
          `Unknown search-index job type: ${String((job.data as SearchIndexJobData).type)}`,
        );
    }
  }
}
