import "dotenv/config";
import { handler } from "../../netlify/functions/api.mts";
import { prisma } from "../src/lib/prisma";

if (process.env.DB_PROVIDER !== "postgresql") throw new Error("Set DB_PROVIDER=postgresql for this check");

try {
  const result = await handler({
    httpMethod: "GET",
    path: "/api/airports",
    headers: { Host: "localhost" },
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {},
  }, {}) as { statusCode: number; body: string };
  const body = JSON.parse(result.body) as { codes?: string[] };
  if (result.statusCode !== 200 || !Array.isArray(body.codes) || body.codes.length === 0) {
    throw new Error(`Unexpected /api/airports response: ${result.statusCode}`);
  }
  console.log(`Netlify API adapter: status=${result.statusCode}, airports=${body.codes.length}`);
} finally {
  await prisma.$disconnect();
}
