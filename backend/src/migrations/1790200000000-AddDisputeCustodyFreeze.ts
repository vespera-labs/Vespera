import { MigrationInterface, QueryRunner, TableColumn, TableUnique } from 'typeorm';

export class AddDisputeCustodyFreeze1790200000000 implements MigrationInterface {
  name = 'AddDisputeCustodyFreeze1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add custody freeze flag to stellar_escrows
    await queryRunner.addColumn(
      'stellar_escrows',
      new TableColumn({
        name: 'frozen',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Add settled_tx_hash to stellar_escrows (set exactly once on resolution)
    await queryRunner.addColumn(
      'stellar_escrows',
      new TableColumn({
        name: 'settled_tx_hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );

    // Add unique constraint so settled_tx_hash is written exactly once
    await queryRunner.createUniqueConstraint(
      'stellar_escrows',
      new TableUnique({
        name: 'UQ_stellar_escrows_settled_tx_hash',
        columnNames: ['settled_tx_hash'],
      }),
    );

    // Add custody_frozen / custody_released to the dispute event type enum
    // by adding a check constraint on dispute_events.event_type
    await queryRunner.query(`
      ALTER TABLE dispute_events
        ADD CONSTRAINT CHK_dispute_events_event_type_valid
        CHECK (
          event_type IN (
            'dispute_raised', 'arbiters_selected', 'vote_cast',
            'voting_complete', 'resolution_enforced', 'appeal_filed',
            'appeal_resolved', 'timeout_triggered',
            'custody_frozen', 'custody_released'
          )
        )
    `);

    // Create index for frozen queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stellar_escrows_frozen"
        ON "stellar_escrows" ("frozen")
        WHERE "frozen" = true
    `);

    // Create index for settled_tx_hash lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stellar_escrows_settled_tx_hash"
        ON "stellar_escrows" ("settled_tx_hash")
        WHERE "settled_tx_hash" IS NOT NULL
    `);

    // Add dispute_custody_events table for freeze/unfreeze audit trail
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dispute_custody_events (
        id SERIAL PRIMARY KEY,
        dispute_id VARCHAR(100) NOT NULL,
        agreement_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('custody_frozen', 'custody_released', 'custody_settled')),
        frozen BOOLEAN NOT NULL,
        settled_tx_hash VARCHAR(64),
        triggered_by VARCHAR(100),
        block_number BIGINT,
        event_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_custody_events_dispute_id"
        ON "dispute_custody_events" ("dispute_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_custody_events_agreement_id"
        ON "dispute_custody_events" ("agreement_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_custody_events_agreement_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_custody_events_dispute_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS dispute_custody_events`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stellar_escrows_settled_tx_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stellar_escrows_frozen"`);

    await queryRunner.query(`
      ALTER TABLE dispute_events DROP CONSTRAINT IF EXISTS CHK_dispute_events_event_type_valid
    `);

    await queryRunner.dropUniqueConstraint(
      'stellar_escrows',
      'UQ_stellar_escrows_settled_tx_hash',
    );

    await queryRunner.dropColumn('stellar_escrows', 'settled_tx_hash');
    await queryRunner.dropColumn('stellar_escrows', 'frozen');
  }
}
