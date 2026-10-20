import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { hashPassword, hashSession, verifyPassword } from "./modules/auth/auth.service";
import type { AuthStore, AuthUser } from "./modules/auth/auth.service";
import { CreateStaffError, parseCreateStaffInput } from "./modules/admin/admin-user.service";

test("staff creation accepts only valid airline staff fields", () => {
  const valid = { name: "  Nhân viên A  ", email: "  STAFF@Example.com ", password: "strong-password-123", role: "AIRLINE_FLIGHT_MANAGER", airlineId: 7 };
  assert.deepEqual(parseCreateStaffInput(valid, 1), { ...valid, name: "Nhân viên A", email: "staff@example.com", actorId: 1 });
  assert.equal(parseCreateStaffInput({ ...valid, role: "ADMIN" }, 1), null);
  assert.equal(parseCreateStaffInput({ ...valid, airlineId: 0 }, 1), null);
  assert.equal(parseCreateStaffInput({ ...valid, password: "short" }, 1), null);
});

test("password hash is salted and verifies without storing plaintext", async () => {
  const a = await hashPassword("strong-password-123");
  const b = await hashPassword("strong-password-123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("strong-password-123", a), true);
  assert.equal(await verifyPassword("wrong-password", a), false);
});

test("session roles, CSRF and airline scope protect the APIs", async () => {
  const passwordHash = await hashPassword("strong-password-123");
  const users = new Map<string, AuthUser & { passwordHash: string }>();
  const sessions = new Map<string, { user: AuthUser; expiresAt: Date }>();
  const makeUser = (id: number, role: AuthUser["role"], airlineId: number | null = null): AuthUser & { passwordHash: string } => ({
    id, name: `User ${id}`, email: `user${id}@example.com`, passwordHash, role, status: "ACTIVE", airlineId,
    phone: null, airline: airlineId ? { status: "ACTIVE" } : null,
  });
  for (const user of [makeUser(1, "ADMIN"), makeUser(2, "CUSTOMER"), makeUser(3, "AIRLINE_FLIGHT_MANAGER", 7), makeUser(4, "AIRLINE_SALES_MANAGER", 8), makeUser(5, "AIRLINE_FLIGHT_MANAGER", 9)]) users.set(user.email, user);
  const store: AuthStore = {
    findByEmail: async email => users.get(email) ?? null,
    findBySession: async id => sessions.get(id) ?? null,
    createCustomer: async input => { const user = { ...makeUser(users.size + 1, "CUSTOMER"), ...input }; users.set(user.email, user); return user; },
    createSession: async input => { const user = [...users.values()].find(item => item.id === input.userId)!; sessions.set(input.id, { user, expiresAt: input.expiresAt }); },
    deleteSession: async id => { sessions.delete(id); },
    recordLogin: async () => {},
    updateProfile: async (id, data) => { const user = [...users.values()].find(item => item.id === id)!; Object.assign(user, data); return user; },
  };
  let imports = 0;
  const scopedAirlineIds: Array<number | undefined> = [];
  const createdAirlineIds: number[] = [];
  const interventionInputs: Array<{ action: string; entityId: number; reason: string; actorId: number }> = [];
  const staffInputs: Array<{ name: string; email: string; role: string; airlineId: number; actorId: number }> = [];
  const app = createApp({
    getImportStatus: async () => ({ status: "missing" as const }),
    importFlights: async (_request, confirmed) => {
      if (!confirmed) return { status: "confirmation_required" as const, reason: "missing" as const };
      imports++;
      return { status: "imported" as const, searchId: 1, offerCount: 2 };
    },
  }, {
    listFlights: async () => ({ items: [], pagination: { page: 1, pageSize: 15, total: 0, pageCount: 0 }, summary: { fresh: 0, expired: 0, total: 0 } }),
  }, store, {
    listManagedFlights: (async (airlineId?: number) => { scopedAirlineIds.push(airlineId); return []; }) as never,
    createFlight: (async (input: { airlineId: number }) => { createdAirlineIds.push(input.airlineId); return { id: 1 }; }) as never,
  }, undefined, async input => { interventionInputs.push(input); return { status: "applied", auditLogId: 17 }; }, async input => {
    staffInputs.push({ name: input.name, email: input.email, role: input.role, airlineId: input.airlineId, actorId: input.actorId });
    if (input.email === "duplicate@example.com") throw new CreateStaffError(409, "Email đã được sử dụng.");
    return { id: 42, name: input.name, email: input.email, role: input.role, airlineId: input.airlineId, status: "ACTIVE" };
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, init);
  async function login(id: number) {
    const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-csrf-intent": "1" }, body: JSON.stringify({ email: `user${id}@example.com`, password: "strong-password-123" }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  const auth = (cookie: string) => ({ cookie });
  const write = (cookie: string) => ({ cookie, "x-csrf-intent": "1", "content-type": "application/json" });

  try {
    assert.equal((await request("/api/admin/flights")).status, 401);
    const registration = await request("/api/auth/register", { method: "POST", headers: { "x-csrf-intent": "1", "content-type": "application/json" }, body: JSON.stringify({ name: "New Customer", email: "NEW@example.com", password: "strong-password-123", role: "ADMIN", airlineId: 7 }) });
    assert.equal(registration.status, 201);
    assert.equal((await registration.json()).user.role, "CUSTOMER");
    assert.equal(users.get("new@example.com")!.airlineId, null);
    assert.equal((await request("/api/auth/login", { method: "POST", headers: { "x-csrf-intent": "1", "content-type": "application/json" }, body: JSON.stringify({ email: "user1@example.com", password: "wrong-password" }) })).status, 401);
    const customer = await login(2);
    assert.equal((await request("/api/admin/flights", { headers: auth(customer) })).status, 403);
    assert.equal((await request("/api/admin/read/users", { headers: auth(customer) })).status, 403);
    const staffBody = JSON.stringify({ name: " New Staff ", email: " NEW.STAFF@example.com ", password: "strong-password-123", role: "AIRLINE_SALES_MANAGER", airlineId: 7 });
    assert.equal((await request("/api/admin/users", { method: "POST", headers: write(customer), body: staffBody })).status, 403);
    const admin = await login(1);
    assert.match(admin, /^flight_session=/);
    assert.equal((await request("/api/admin/users", { method: "POST", headers: { ...write(admin), "x-csrf-intent": "0" }, body: staffBody })).status, 403);
    assert.equal((await request("/api/admin/users", { method: "POST", headers: write(admin), body: staffBody.replace("AIRLINE_SALES_MANAGER", "ADMIN") })).status, 400);
    const createdStaff = await request("/api/admin/users", { method: "POST", headers: write(admin), body: staffBody });
    assert.equal(createdStaff.status, 201);
    assert.deepEqual(await createdStaff.json(), { user: { id: 42, name: "New Staff", email: "new.staff@example.com", role: "AIRLINE_SALES_MANAGER", airlineId: 7, status: "ACTIVE" } });
    assert.deepEqual(staffInputs, [{ name: "New Staff", email: "new.staff@example.com", role: "AIRLINE_SALES_MANAGER", airlineId: 7, actorId: 1 }]);
    assert.equal((await request("/api/admin/users", { method: "POST", headers: write(admin), body: staffBody.replace("NEW.STAFF@example.com", "duplicate@example.com") })).status, 409);
    const interventionBody = JSON.stringify({ action: "HIDE_FLIGHT", entityId: 9, reason: "Lịch bay cần kiểm tra" });
    const interventionHeaders = { ...write(admin), "idempotency-key": "11111111-1111-4111-8111-111111111111" };
    assert.equal((await request("/api/admin/interventions", { method: "POST", headers: interventionHeaders, body: interventionBody.replace("Lịch bay cần kiểm tra", "ngắn") })).status, 400);
    assert.equal((await request("/api/admin/interventions", { method: "POST", headers: { ...write(admin) }, body: interventionBody })).status, 400);
    assert.equal((await request("/api/admin/interventions", { method: "POST", headers: { ...interventionHeaders, "x-csrf-intent": "0" }, body: interventionBody })).status, 403);
    assert.equal((await request("/api/admin/interventions", { method: "POST", headers: { ...interventionHeaders, cookie: customer }, body: interventionBody })).status, 403);
    assert.equal((await request("/api/admin/interventions", { method: "POST", headers: interventionHeaders, body: interventionBody })).status, 201);
    assert.deepEqual(interventionInputs, [{ action: "HIDE_FLIGHT", entityId: 9, reason: "Lịch bay cần kiểm tra", actorId: 1, requestId: "11111111-1111-4111-8111-111111111111" }]);
    assert.equal((await request("/api/admin/flights", { headers: auth(admin) })).status, 200);
    assert.equal((await request("/api/admin/read/users?sort=passwordHash", { headers: auth(admin) })).status, 400);
    assert.equal((await request("/api/admin/read/unknown", { headers: auth(admin) })).status, 404);
    assert.equal((await request("/api/admin/managed-flights", { method: "POST", headers: write(admin), body: JSON.stringify({}) })).status, 404);
    assert.equal((await request("/api/airline/managed-flights", { headers: auth(admin) })).status, 403);
    const body = JSON.stringify({ departureCode: "HAN", arrivalCode: "SGN", date: "2026-11-01", confirmed: true });
    assert.equal((await request("/api/admin/flight-imports", { method: "POST", headers: auth(admin), body })).status, 403);
    assert.equal((await request("/api/admin/flight-imports", { method: "POST", headers: write(admin), body })).status, 201);
    assert.equal(imports, 1);
    const airline = await login(3);
    assert.equal((await request("/api/admin/flights", { headers: auth(airline) })).status, 403);
    assert.equal((await request("/api/airline/managed-flights", { headers: auth(airline) })).status, 200);
    assert.deepEqual(scopedAirlineIds, [7]);
    const flightBody = JSON.stringify({ flightNumber: "FB123", airlineId: 999, departureCode: "HAN", arrivalCode: "SGN", departureTime: "2026-11-01T10:00:00Z", arrivalTime: "2026-11-01T12:00:00Z", capacity: 100, basePrice: 1000000 });
    assert.equal((await request("/api/airline/managed-flights", { method: "POST", headers: write(airline), body: flightBody })).status, 201);
    assert.deepEqual(createdAirlineIds, [7]);
    const sales = await login(4);
    assert.equal((await request("/api/airline/managed-flights", { method: "POST", headers: write(sales), body: flightBody })).status, 403);
    users.get("user4@example.com")!.airline!.status = "LOCKED";
    assert.equal((await request("/api/airline/managed-flights", { headers: auth(sales) })).status, 401);
    const otherAirline = await login(5);
    assert.equal((await request("/api/airline/managed-flights", { headers: auth(otherAirline) })).status, 200);
    assert.deepEqual(scopedAirlineIds, [7, 9]);
    users.get("user3@example.com")!.status = "LOCKED";
    assert.equal((await request("/api/airline/managed-flights", { headers: auth(airline) })).status, 401);
    const oldToken = customer.slice(cookieNameLength());
    assert.equal(sessions.has(hashSession(oldToken)), true);
    assert.equal((await request("/api/auth/logout", { method: "POST", headers: write(customer) })).status, 204);
    assert.equal((await request("/api/auth/me", { headers: auth(customer) })).status, 401);
  } finally {
    server.close();
    await once(server, "close");
  }
});

function cookieNameLength() { return "flight_session=".length; }
