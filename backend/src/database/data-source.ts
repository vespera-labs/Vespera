
import "reflect-metadata";
import * as path from "path";
import { DataSource } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import * as dotenv from "dotenv";

dotenv.config();

/** Repo-root backend directory */
const backendDir = path.join(__dirname, "..", "..");

/**
 * FIX #27: Canonical DataSource used by both the NestJS runtime and
 * the TypeORM CLI.  A single migrations glob from backend/migrations/
 * is used exclusively so discovery and run-order are always identical.
 *
 * The three files that previously shared timestamp 1790000000000 have
 * been renamed to 1790000000000, 1790000000001, and 1790000000002
 * to enforce deterministic ordering.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || "localhost"),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DATABASE_URL ? undefined : (process.env.DB_USERNAME || "postgres"),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD || "password"),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || "chioma_db"),
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" }
    : false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [path.join(backendDir, "src", "modules", "**", "*.entity{.ts,.js}")],
  // FIXED: single canonical glob - no duplicate/divergent paths
  migrations: [path.join(backendDir, "migrations", "*{.ts,.js}")],
  migrationsTableName: "migrations",
  migrationsTransactionMode: "each",
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === "true",
});
