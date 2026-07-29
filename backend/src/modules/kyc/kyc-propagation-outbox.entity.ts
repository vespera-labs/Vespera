import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { KycStatus, ScreeningStatus } from './kyc-status.enum';

export enum PropagationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('kyc_propagation_outbox')
@Index(['status', 'attempts'])
export class KycPropagationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'wallet_address', type: 'varchar' })
  walletAddress: string;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.UNVERIFIED,
  })
  kycStatus: KycStatus;

  @Column({
    name: 'screening_status',
    type: 'enum',
    enum: ScreeningStatus,
    default: ScreeningStatus.CLEAR,
  })
  screeningStatus: ScreeningStatus;

  @Column({
    type: 'enum',
    enum: PropagationStatus,
    default: PropagationStatus.PENDING,
  })
  status: PropagationStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
