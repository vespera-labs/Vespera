import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1774289018419 implements MigrationInterface {
  name = 'AddPerformanceIndexes1774289018419';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_99797bb751811331b74d27865f" ON "kyc" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_823d1011f2efdec975081a15b5" ON "rent_agreements" ("property_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_797b76e2d11a5bf755127d1aa6" ON "properties" ("owner_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b13da725bb0d236ee1df1f94ce" ON "rental_units" ("property_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_290ac1d9ac5dced160a9b7a14e" ON "anchor_transactions" ("stellar_transaction_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_290ac1d9ac5dced160a9b7a14e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b13da725bb0d236ee1df1f94ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_797b76e2d11a5bf755127d1aa6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_823d1011f2efdec975081a15b5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99797bb751811331b74d27865f"`,
    );
  }
}
