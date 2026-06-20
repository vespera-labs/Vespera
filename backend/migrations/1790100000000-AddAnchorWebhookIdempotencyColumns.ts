import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the columns the anchor webhook idempotency / optimistic-lock
 * code in src/modules/stellar/services/anchor.service.ts relies on:
 *
 *   - processed_event_ids text[]  — replay guard (anchor event ids
 *     already applied to this row)
 *   - version             integer — TypeORM @VersionColumn target
 *
 * The original anchor_transactions table was created by
 * 1740020000000-CreateAnchorTables.ts without these columns.
 */
export class AddAnchorWebhookIdempotencyColumns1790100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "anchor_transactions"
         ADD COLUMN IF NOT EXISTS "processed_event_ids" text[] NOT NULL DEFAULT '{}',
         ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "anchor_transactions"
         DROP COLUMN IF EXISTS "version",
         DROP COLUMN IF EXISTS "processed_event_ids"`,
    );
  }
}
