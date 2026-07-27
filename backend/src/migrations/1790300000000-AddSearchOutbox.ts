import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchOutbox1790300000000 implements MigrationInterface {
  name = 'AddSearchOutbox1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE search_outbox_operation AS ENUM ('index', 'delete');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE search_outbox_status AS ENUM ('pending', 'processing', 'done', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_outbox (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        aggregate_type VARCHAR(64) NOT NULL,
        aggregate_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        operation search_outbox_operation NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status search_outbox_status NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_outbox_status_created
        ON search_outbox (status, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_outbox_aggregate
        ON search_outbox (aggregate_type, aggregate_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_outbox_tenant
        ON search_outbox (tenant_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_search_outbox_tenant;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_search_outbox_aggregate;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_search_outbox_status_created;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS search_outbox;`);
    await queryRunner.query(`DROP TYPE IF EXISTS search_outbox_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS search_outbox_operation;`);
  }
}
