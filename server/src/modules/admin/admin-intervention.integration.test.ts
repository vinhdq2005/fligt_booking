import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { InterventionError, runAdminIntervention, type InterventionAction } from "./admin-intervention.service";
import { createFlight } from "../flights/flight-management.service";
import { getAdminDetail } from "./admin-read.service";

test("admin interventions update business state and audit atomically", async t => {
  const actor = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (!actor) { t.skip("Cần một admin đang hoạt động trong database kiểm thử."); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  let airlineId: number | undefined;
  let userId: number | undefined;
  let flightId: number | undefined;
  let bookingId: number | undefined;
  let passengerId: number | undefined;
  let ticketId: number | undefined;
  let paymentId: number | undefined;
  const reason = "Kiểm thử can thiệp admin";
  const invoke = (action: InterventionAction, entityId: number, requestId = randomUUID()) =>
    runAdminIntervention({ action, entityId, reason, requestId, actorId: actor.id });
  try {
    const airline = await prisma.airline.create({ data: { code: `T${suffix}`, name: `Test ${suffix}` } });
    airlineId = airline.id;
    const user = await prisma.user.create({ data: { name: "Test staff", email: `stage7-${suffix}@example.test`, passwordHash: "test-only", role: "AIRLINE_FLIGHT_MANAGER", airlineId } });
    userId = user.id;
    const flight = await prisma.flight.create({ data: { flightNumber: `T${suffix}`, airlineId, departureCode: "HAN", arrivalCode: "SGN", departureTime: new Date(Date.now() + 172800000), arrivalTime: new Date(Date.now() + 180000000), capacity: 10, basePrice: 100000 } });
    flightId = flight.id;
    const booking = await prisma.booking.create({ data: { flightId, bookingCode: `T${suffix}`, contactName: "Test customer", totalAmount: 100000, status: "CONFIRMED", expiresAt: new Date(Date.now() + 3600000) } });
    bookingId = booking.id;
    const passenger = await prisma.passenger.create({ data: { bookingId, fullName: "Test passenger" } });
    passengerId = passenger.id;
    const ticket = await prisma.ticket.create({ data: { passengerId, flightId, price: 100000, ticketCode: `T${suffix}`, qrToken: `T${suffix}` } });
    ticketId = ticket.id;
    const payment = await prisma.payment.create({ data: { bookingId, amount: 100000, method: "MOCK", status: "PAID" } });
    paymentId = payment.id;
    const initialFlightDetail = await getAdminDetail("flights", flightId);
    assert.ok(initialFlightDetail && "activeBookingCount" in initialFlightDetail);
    assert.equal(initialFlightDetail.airlineStatus, "ACTIVE");
    assert.equal(initialFlightDetail.activeBookingCount, 1);
    const initialBookingDetail = await getAdminDetail("bookings", bookingId);
    assert.ok(initialBookingDetail && "hasUsedTicket" in initialBookingDetail);
    assert.equal(initialBookingDetail.flightStatus, "SCHEDULED");
    assert.equal(initialBookingDetail.hasUsedTicket, false);

    await assert.rejects(invoke("LOCK_USER", actor.id), (error: unknown) => error instanceof InterventionError && error.status === 409);
    assert.equal((await invoke("HIDE_FLIGHT", flightId)).status, "applied");
    assert.equal((await invoke("LOCK_AIRLINE", airlineId)).status, "applied");
    assert.equal((await prisma.airline.findUniqueOrThrow({ where: { id: airlineId } })).status, "LOCKED");
    await assert.rejects(createFlight({ flightNumber: `X${suffix}`, airlineId, departureCode: "HAN", arrivalCode: "SGN",
      departureTime: new Date(Date.now() + 172800000).toISOString(), arrivalTime: new Date(Date.now() + 180000000).toISOString() }), /Hãng bay đang bị khóa/);
    await assert.rejects(invoke("REOPEN_FLIGHT", flightId), (error: unknown) => error instanceof InterventionError && error.status === 409);
    assert.equal((await invoke("UNLOCK_AIRLINE", airlineId)).status, "applied");
    assert.equal((await invoke("REOPEN_FLIGHT", flightId)).status, "applied");
    assert.equal((await invoke("LOCK_USER", userId)).status, "applied");
    assert.equal((await invoke("UNLOCK_USER", userId)).status, "applied");
    const hideKey = randomUUID();
    assert.equal((await invoke("HIDE_FLIGHT", flightId, hideKey)).status, "applied");
    assert.equal((await invoke("HIDE_FLIGHT", flightId, hideKey)).status, "already_processed");
    assert.equal((await invoke("HIDE_FLIGHT", flightId)).status, "already_applied");
    assert.equal((await invoke("REOPEN_FLIGHT", flightId)).status, "applied");
    assert.equal((await invoke("MARK_PAYMENT_REVIEW", paymentId)).status, "applied");
    assert.equal((await invoke("CANCEL_BOOKING_EXCEPTION", bookingId)).status, "applied");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status, "CANCELLED");
    assert.equal((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status, "CANCELLED");
    const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(finalPayment.status, "PAID");
    assert.equal(finalPayment.reviewStatus, "NEEDS_REVIEW");
    assert.equal((await invoke("CANCEL_BOOKING_EXCEPTION", bookingId)).status, "already_applied");
    assert.equal(await prisma.auditLog.count({ where: { entityType: "BOOKING", entityId: String(bookingId) } }), 1);
    const updatedBookingDetail = await getAdminDetail("bookings", bookingId);
    assert.ok(updatedBookingDetail && "hasUsedTicket" in updatedBookingDetail);
    assert.equal(updatedBookingDetail.status, "CANCELLED");
    assert.ok("auditTrail" in updatedBookingDetail && Array.isArray(updatedBookingDetail.auditTrail));
    assert.equal(updatedBookingDetail.auditTrail.length, 1);
  } finally {
    if (bookingId) await prisma.auditLog.deleteMany({ where: { OR: [
      { entityType: "BOOKING", entityId: String(bookingId) }, { entityType: "PAYMENT", entityId: String(paymentId) },
      { entityType: "FLIGHT", entityId: String(flightId) }, { entityType: "USER", entityId: String(userId) }, { entityType: "AIRLINE", entityId: String(airlineId) },
    ] } });
    if (ticketId) await prisma.ticket.delete({ where: { id: ticketId } });
    if (paymentId) await prisma.payment.delete({ where: { id: paymentId } });
    if (passengerId) await prisma.passenger.delete({ where: { id: passengerId } });
    if (bookingId) await prisma.booking.delete({ where: { id: bookingId } });
    if (flightId) await prisma.flight.delete({ where: { id: flightId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (airlineId) await prisma.airline.delete({ where: { id: airlineId } });
    await prisma.$disconnect();
  }
});
