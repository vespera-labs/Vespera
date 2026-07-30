import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ElasticsearchModule } from './elasticsearch.module';
import { SearchOutbox } from './entities/search-outbox.entity';
import { SearchOutboxService } from './search-outbox.service';
import { SearchOutboxRelay } from './search-outbox.relay';
import { SearchReconcileJob } from './search-reconcile.job';
import { Property } from '../properties/entities/property.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, SearchOutbox]),
    ElasticsearchModule,
    MonitoringModule,
    AuditModule,
  ],
  providers: [
    SearchService,
    SearchOutboxService,
    SearchOutboxRelay,
    SearchReconcileJob,
  ],
  controllers: [SearchController],
  exports: [
    SearchService,
    SearchOutboxService,
    SearchOutboxRelay,
    SearchReconcileJob,
    ElasticsearchModule,
  ],
})
export class SearchModule {}
