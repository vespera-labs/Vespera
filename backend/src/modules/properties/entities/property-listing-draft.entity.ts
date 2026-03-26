import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('property_listing_drafts')
export class PropertyListingDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  landlordId: string;

  @Column({
    type: process.env.DB_TYPE === 'sqlite' ? 'text' : 'jsonb',
    default: {},
  })
  data: Record<string, unknown>;

  @Column({ type: 'integer', default: 1 })
  currentStep: number;

  @Column({
    type: process.env.DB_TYPE === 'sqlite' ? 'text' : 'jsonb',
    default: [],
  })
  completedSteps: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;
}
