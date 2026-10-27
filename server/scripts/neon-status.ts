import "dotenv/config";
import pg from "pg";

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error("Missing NEON_DATABASE_URL in server/.env");

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const result = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  console.log(`Neon reachable; public tables: ${result.rows.length}`);
  console.log(result.rows.map((row) => row.tablename).join(", ") || "(empty)");
} finally {
  await client.end().catch(() => undefined);
}
