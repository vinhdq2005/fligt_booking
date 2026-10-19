import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReadQuery } from "./admin-read.service";

test("admin read query only accepts bounded pages, known filters and sort fields", () => {
  assert.deepEqual(parseReadQuery("flights", { page: "2", pageSize: "20", airlineId: "4", saleStatus: "HIDDEN", sort: "departureTime", direction: "asc" }), {
    page: 2, pageSize: 20, search: "", sort: "departureTime", direction: "asc", filters: { airlineId: "4", saleStatus: "HIDDEN" },
  });
  assert.equal(parseReadQuery("flights", { pageSize: "1000" }), null);
  assert.equal(parseReadQuery("users", { sort: "passwordHash" }), null);
  assert.equal(parseReadQuery("bookings", { fromDate: "2026-10-20", toDate: "2026-10-19" }), null);
  assert.equal(parseReadQuery("bookings", { departureDate: "2026-02-30" }), null);
  assert.equal(parseReadQuery("payments", { airlineId: "0" }), null);
  assert.equal(parseReadQuery("audit-logs", { unexpected: "value" }), null);
});
