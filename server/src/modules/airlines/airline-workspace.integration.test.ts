import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { createFlight } from "../flights/flight-management.service";
import { getFlightById } from "../flights/flight-search.service";
import { AirlineWorkspaceError, getAirlineWorkspace, parseAirlineWorkspaceQuery, setAirlineSalesSettings, setAirlineSaleStatus } from "./airline-workspace.service";

test("airline workspace query validates filters and paging", () => {
  assert.deepEqual(parseAirlineWorkspaceQuery({ page: "2", pageSize: "10", status: "SCHEDULED", sort: "createdAt", direction: "desc" }),
    { page: 2, pageSize: 10, search: "", sort: "createdAt", direction: "desc", status: "SCHEDULED" });
  assert.equal(parseAirlineWorkspaceQuery({ pageSize: "1000" }), null);
  assert.equal(parseAirlineWorkspaceQuery({ sort: "airlineId" }), null);
  assert.equal(parseAirlineWorkspaceQuery({ fromDate: "2026-11-02", toDate: "2026-11-01" }), null);
  assert.equal(parseAirlineWorkspaceQuery({ salesStage: "OTHER" }), null);
  assert.equal(parseAirlineWorkspaceQuery({ salesStage: "AWAITING_SALE" })?.salesStage, "AWAITING_SALE");
});

test("airline flight lifecycle keeps dynamic pricing and airline scope", async t => {
  const actor = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (!actor) { t.skip("Cần admin đang hoạt động trong database kiểm thử."); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  let airlineId: number | undefined;
  let otherAirlineId: number | undefined;
  let flightId: number | undefined;
  let bookingId: number | undefined;
  try {
    const airline = await prisma.airline.create({ data: { code: `W${suffix}`, name: `Workspace ${suffix}` } });
    airlineId = airline.id;
    const other = await prisma.airline.create({ data: { code: `X${suffix}`, name: `Other ${suffix}` } });
    otherAirlineId = other.id;
    const flight = await createFlight({ flightNumber: `W${suffix}`, airlineId, departureCode: "HAN", arrivalCode: "SGN",
      departureTime: new Date(Date.now() + 172800000).toISOString(), arrivalTime: new Date(Date.now() + 180000000).toISOString() });
    flightId = flight.id;
    assert.equal(flight.saleStatus, "HIDDEN");
    assert.equal(flight.capacity, 0);
    assert.equal(flight.basePrice, 0);
    assert.equal((await getAirlineWorkspace(airlineId)).items.length, 1);
    assert.equal((await getAirlineWorkspace(otherAirlineId)).items.length, 0);
    const hidden = await getAirlineWorkspace(airlineId, parseAirlineWorkspaceQuery({ saleStatus: "HIDDEN" })!);
    assert.equal(hidden.pagination.total, 1);
    assert.equal(hidden.summary.onSaleFlights, 0);
    const awaitingQuery = parseAirlineWorkspaceQuery({ salesStage: "AWAITING_SALE" })!;
    assert.equal((await getAirlineWorkspace(airlineId, awaitingQuery)).pagination.total, 1);
    assert.equal((await getAirlineWorkspace(otherAirlineId, awaitingQuery)).pagination.total, 0);
    const filtered = await getAirlineWorkspace(airlineId, parseAirlineWorkspaceQuery({ search: "nomatch" })!);
    assert.equal(filtered.pagination.total, 0);
    await assert.rejects(setAirlineSalesSettings({ airlineId: otherAirlineId, flightId, actorId: actor.id, capacity: 2, basePrice: 100000 }),
      (error: unknown) => error instanceof AirlineWorkspaceError && error.status === 404);
    await assert.rejects(setAirlineSaleStatus({ airlineId, flightId, actorId: actor.id, saleStatus: "ON_SALE" }),
      (error: unknown) => error instanceof AirlineWorkspaceError && error.status === 409);
    await setAirlineSalesSettings({ airlineId, flightId, actorId: actor.id, capacity: 2, basePrice: 100000 });
    await setAirlineSaleStatus({ airlineId, flightId, actorId: actor.id, saleStatus: "ON_SALE" });
    assert.equal((await getAirlineWorkspace(airlineId, awaitingQuery)).pagination.total, 0);
    const initialPrice = (await getFlightById(flightId))?.currentPrice;
    assert.ok(initialPrice && initialPrice > 0);
    const booking = await prisma.booking.create({ data: { flightId, contactName: "Test", totalAmount: initialPrice, status: "CONFIRMED" } });
    bookingId = booking.id;
    await prisma.passenger.create({ data: { bookingId, fullName: "Test passenger" } });
    const nextPrice = (await getFlightById(flightId))?.currentPrice;
    assert.ok(nextPrice && nextPrice > initialPrice);
    assert.equal((await getAirlineWorkspace(airlineId)).items[0].occupancyPercent, 50);
    await prisma.passenger.create({ data: { bookingId, fullName: "Second passenger" } });
    await assert.rejects(setAirlineSalesSettings({ airlineId, flightId, actorId: actor.id, capacity: 1, basePrice: 100000 }),
      (error: unknown) => error instanceof AirlineWorkspaceError && error.status === 409);
    await assert.rejects(setAirlineSalesSettings({ airlineId, flightId, actorId: actor.id, capacity: 0, basePrice: 100000 }),
      (error: unknown) => error instanceof AirlineWorkspaceError && error.status === 400);
    await setAirlineSaleStatus({ airlineId, flightId, actorId: actor.id, saleStatus: "HIDDEN" });
    assert.equal((await getAirlineWorkspace(airlineId, awaitingQuery)).pagination.total, 1);
    assert.equal(await getFlightById(flightId), null);
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "HIDE_FLIGHT", entityType: "FLIGHT", entityId: String(flightId), result: "SUCCESS" } });
    await assert.rejects(setAirlineSaleStatus({ airlineId, flightId, actorId: actor.id, saleStatus: "ON_SALE" }),
      (error: unknown) => error instanceof AirlineWorkspaceError && error.status === 409);
  } finally {
    if (flightId) await prisma.auditLog.deleteMany({ where: { entityType: "FLIGHT", entityId: String(flightId) } });
    if (bookingId) { await prisma.passenger.deleteMany({ where: { bookingId } }); await prisma.booking.delete({ where: { id: bookingId } }); }
    if (flightId) await prisma.flight.delete({ where: { id: flightId } });
    if (airlineId) await prisma.airline.delete({ where: { id: airlineId } });
    if (otherAirlineId) await prisma.airline.delete({ where: { id: otherAirlineId } });
    await prisma.$disconnect();
  }
});
