import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";

test("admin import requires authentication and explicit confirmation", async () => {
  let imports = 0;
  const app = createApp("test-admin-token", {
    getImportStatus: async () => ({ status: "missing" as const }),
    importFlights: async (_request, confirmed) => {
      if (!confirmed) return { status: "confirmation_required" as const, reason: "missing" as const };
      imports += 1;
      return { status: "imported" as const, searchId: 1, offerCount: 2 };
    },
  }, {
    listFlights: async () => ({
      items: [],
      pagination: { page: 1, pageSize: 15, total: 0, pageCount: 0 },
      summary: { fresh: 0, expired: 0, total: 0 },
    }),
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/admin/flight-imports`;
    const body = JSON.stringify({ departureCode: "HAN", arrivalCode: "SGN", date: "2026-11-01" });

    const unauthorized = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" }, body,
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(imports, 0);

    const status = await fetch(
      `http://127.0.0.1:${port}/api/admin/flight-imports/status?departureCode=HAN&arrivalCode=SGN&date=2026-11-01`,
      { headers: { authorization: "Bearer test-admin-token" } },
    );
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { status: "missing" });

    const flights = await fetch(`http://127.0.0.1:${port}/api/admin/flights?status=fresh&page=1`, {
      headers: { authorization: "Bearer test-admin-token" },
    });
    assert.equal(flights.status, 200);
    assert.deepEqual((await flights.json()).items, []);

    const pending = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-admin-token" },
      body,
    });
    assert.equal(pending.status, 428);
    assert.equal(imports, 0);

    const approved = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-admin-token" },
      body: JSON.stringify({ departureCode: "HAN", arrivalCode: "SGN", date: "2026-11-01", confirmed: true }),
    });
    assert.equal(approved.status, 201);
    assert.equal(imports, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});
