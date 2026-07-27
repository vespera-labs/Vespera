import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SearchOutboxOperation {
  INDEX = 'index',
  DELETE = 'delete',
}

export enum SearchOutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity('search_outbox')
@Index(['status', 'createdAt'])
@Index(['aggregateType', 'aggregateId'])
@Index(['tenantId'])
export class SearchOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({
    type: 'enum',
    enum: SearchOutboxOperation,
    enumName: 'search_outbox_operation',
  })
  operation: SearchOutboxOperation;

  @Column({
    type: process.env.DB_TYPE === 'sqlite' ? 'simple-json' : 'jsonb',
    default: {},
  })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: SearchOutboxStatus,
    enumName: 'search_outbox_status',
    default: SearchOutboxStatus.PENDING,
  })
  status: SearchOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
