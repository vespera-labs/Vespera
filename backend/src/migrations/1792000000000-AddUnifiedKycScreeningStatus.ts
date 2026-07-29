import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnifiedKycScreeningStatus1792000000000
  implements MigrationInterface
{
  name = 'AddUnifiedKycScreeningStatus1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add screening_status column to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "screening_status" VARCHAR NOT NULL DEFAULT 'CLEAR'
    `);

    // Create kyc_propagation_outbox table
    await queryRunner.query(`
      CREATE TABLE "kyc_propagation_outbox" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" UUID NOT NULL,
        "wallet_address" VARCHAR NOT NULL,
        "kyc_status" VARCHAR NOT NULL DEFAULT 'UNVERIFIED',
        "screening_status" VARCHAR NOT NULL DEFAULT 'CLEAR',
        "status" VARCHAR NOT NULL DEFAULT 'PENDING',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "last_error" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_propagation_outbox" PRIMARY KEY ("id")
      )
    `);

    // Add composite index for queue polling
    await queryRunner.query(`
      CREATE INDEX "IDX_kyc_propagation_outbox_status_attempts"
      ON "kyc_propagation_outbox" ("status", "attempts")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "kyc_propagation_outbox"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "screening_status"`,
    );
  }
}
