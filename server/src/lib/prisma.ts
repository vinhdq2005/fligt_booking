import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as MySqlClient } from "../generated/prisma/client";
import { PrismaClient as PostgresClient } from "../generated/prisma-postgres/client";

export const databaseProvider = process.env.DB_PROVIDER === "postgresql" ? "postgresql" : "mysql";
const connectionString = databaseProvider === "postgresql"
  ? process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(`Missing database URL for ${databaseProvider}`);
}

function createMySqlClient(urlString: string) {
  const url = new URL(urlString);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must be a MySQL URL in local mode");
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 5,
  });
  return new MySqlClient({ adapter });
}

function createPostgresClient(urlString: string) {
  const url = new URL(urlString);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Neon URL must be a PostgreSQL URL");
  }
  return new PostgresClient({ adapter: new PrismaPg({ connectionString: urlString, max: 2, idleTimeoutMillis: 10000 }) });
}

// Both schemas have the same application models. Keep one model type for service code.
export const prisma: MySqlClient = databaseProvider === "postgresql"
  ? createPostgresClient(connectionString) as unknown as MySqlClient
  : createMySqlClient(connectionString);
