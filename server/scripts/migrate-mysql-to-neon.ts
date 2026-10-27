import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";
import { prisma } from "../src/lib/prisma";

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error("Missing NEON_DATABASE_URL in server/.env");

// pg otherwise interprets PostgreSQL timestamps in the computer's local timezone.
pg.types.setTypeParser(1114, (value) => new Date(`${value.replace(" ", "T")}Z`));
pg.types.setTypeParser(1082, (value) => value);

const tables = [
  ["FlightSearch", "flightSearch"],
  ["FlightOffer", "flightOffer"],
  ["FlightSegment", "flightSegment"],
  ["Airline", "airline"],
  ["User", "user"],
  ["AuthSession", "authSession"],
  ["AuditLog", "auditLog"],
  ["Flight", "flight"],
  ["Booking", "booking"],
  ["Passenger", "passenger"],
  ["Ticket", "ticket"],
  ["PricingRule", "pricingRule"],
  ["Payment", "payment"],
] as const;

type Row = Record<string, unknown>;
type Delegate = { findMany: (args: { orderBy: { id: "asc" } }) => Promise<Row[]> };
type Column = { column_name: string; data_type: string };
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

function normalize(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return null;
  if (dataType === "date") return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (dataType.startsWith("timestamp")) return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
  if (dataType === "numeric") return String(value);
  if (dataType === "jsonb") return stableJson(value);
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(rows: Row[], columns: Column[]): string {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(JSON.stringify(columns.map(({ column_name, data_type }) => normalize(row[column_name], data_type))));
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function main() {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    const existing = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const names = new Set(existing.rows.map((row) => row.tablename));
    for (const [table] of tables) {
      if (!names.has(table)) throw new Error(`Neon table ${table} is missing; run PostgreSQL migrations first.`);
      const count = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quote(table)}`);
      if (Number(count.rows[0].count) !== 0) throw new Error(`Neon table ${table} already contains data; refusing to overwrite or duplicate it.`);
    }

    const source = await prisma.$transaction(async (tx) => {
      const delegates = tx as unknown as Record<string, Delegate>;
      const rows = new Map<string, Row[]>();
      for (const [table, model] of tables) {
        rows.set(table, await delegates[model].findMany({ orderBy: { id: "asc" } }));
      }
      return rows;
    }, { timeout: 60000 });

    await client.query("BEGIN");
    try {
      for (const [table] of tables) {
        const rows = source.get(table)!;
        const columnResult = await client.query<Column>(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
          [table],
        );
        const columns = columnResult.rows;
        if (!columns.length) throw new Error(`No columns found for ${table}`);
        const columnNames = columns.map((column) => column.column_name);
        for (let offset = 0; offset < rows.length; offset += 100) {
          const batch = rows.slice(offset, offset + 100);
          const values: unknown[] = [];
          const placeholders = batch.map((row) => {
            const cells = columns.map(({ column_name, data_type }) => {
              if (!(column_name in row)) throw new Error(`Missing MySQL column ${table}.${column_name}`);
              const value = row[column_name];
              values.push(data_type === "jsonb" && value !== null ? JSON.stringify(value) :
                data_type === "date" && value instanceof Date ? value.toISOString().slice(0, 10) :
                data_type.startsWith("timestamp") && value instanceof Date ? value.toISOString().slice(0, -1).replace("T", " ") :
                data_type === "numeric" && value !== null ? String(value) : value);
              return `$${values.length}`;
            });
            return `(${cells.join(", ")})`;
          });
          await client.query(
            `INSERT INTO ${quote(table)} (${columnNames.map(quote).join(", ")}) VALUES ${placeholders.join(", ")}`,
            values,
          );
        }

        const target = await client.query<Row>(`SELECT * FROM ${quote(table)} ORDER BY "id" ASC`);
        const sourceHash = digest(rows, columns);
        const targetHash = digest(target.rows, columns);
        if (rows.length !== target.rows.length || sourceHash !== targetHash) {
          throw new Error(`Verification mismatch in ${table}: MySQL=${rows.length}, Neon=${target.rows.length}`);
        }
        if (rows.length && table !== "AuthSession") {
          await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), $2, true)`,
            [`public.${quote(table)}`, Math.max(...rows.map((row) => Number(row.id)))]);
        }
        console.log(`${table}: ${rows.length} rows verified`);
      }
      await client.query("COMMIT");
      console.log("Migration committed; every table matches its MySQL snapshot.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const problem = error as { code?: string; message?: string };
  console.error(`Migration failed${problem.code ? ` (${problem.code})` : ""}: ${problem.message ?? "unknown error"}`);
  process.exitCode = 1;
});
