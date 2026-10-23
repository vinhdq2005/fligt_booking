import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { getAirlineBooking, listAirlineBookings, parseAirlineBookingQuery } from "./airline-bookings.service";

test("airline booking query validates paging, dates and payment state", () => {
  assert.equal(parseAirlineBookingQuery({ page: "2", pageSize: "10", paymentStatus: "PAID" })?.page, 2);
  assert.equal(parseAirlineBookingQuery({ pageSize: "101" }), null);
  assert.equal(parseAirlineBookingQuery({ bookingFromDate: "2026-11-02", bookingToDate: "2026-11-01" }), null);
  assert.equal(parseAirlineBookingQuery({ flightFromDate: "2026-02-30" }), null);
  assert.equal(parseAirlineBookingQuery({ paymentStatus: "UNKNOWN" }), null);
});

test("sales manager booking read stays in airline scope and lists tickets without QR tokens", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const airlineIds: number[] = [];
  const flightIds: number[] = [];
  const bookingIds: number[] = [];
  try {
    const airline = await prisma.airline.create({ data: { code: `B${suffix}`, name: `Booking ${suffix}` } });
    const other = await prisma.airline.create({ data: { code: `C${suffix}`, name: `Other ${suffix}` } });
    airlineIds.push(airline.id, other.id);
    const flight = await prisma.flight.create({ data: { airlineId: airline.id, flightNumber: `B${suffix}`, departureCode: "HAN", arrivalCode: "PQC",
      departureTime: new Date("2026-11-05T03:00:00Z"), arrivalTime: new Date("2026-11-05T05:00:00Z"), capacity: 30, basePrice: 500000 } });
    const otherFlight = await prisma.flight.create({ data: { airlineId: other.id, flightNumber: `C${suffix}`, departureCode: "HAN", arrivalCode: "PQC",
      departureTime: new Date("2026-11-05T03:00:00Z"), arrivalTime: new Date("2026-11-05T05:00:00Z"), capacity: 30, basePrice: 500000 } });
    flightIds.push(flight.id, otherFlight.id);
    const paid = await prisma.booking.create({ data: { flightId: flight.id, contactName: "Demo Contact", contactPhone: "0901234567",
      contactEmail: "demo@example.invalid", totalAmount: 1000000, status: "CONFIRMED", createdAt: new Date("2026-10-20T03:00:00Z"),
      passengers: { create: [{ fullName: "Passenger One" }, { fullName: "Passenger Two" }] } }, include: { passengers: true } });
    bookingIds.push(paid.id);
    await prisma.ticket.create({ data: { passengerId: paid.passengers[0].id, price: 500000 } });
    await prisma.ticket.create({ data: { passengerId: paid.passengers[1].id, price: 500000 } });
    await prisma.payment.create({ data: { bookingId: paid.id, amount: 1000000, method: "MOCK", status: "PAID" } });
    const pending = await prisma.booking.create({ data: { flightId: flight.id, contactName: "Pending Contact", totalAmount: 500000,
      status: "PENDING", expiresAt: new Date("2026-11-04T00:00:00Z"), passengers: { create: [{ fullName: "Passenger Three" }] } } });
    bookingIds.push(pending.id);
    const foreign = await prisma.booking.create({ data: { flightId: otherFlight.id, contactName: "Demo Contact", totalAmount: 500000,
      status: "PENDING", passengers: { create: [{ fullName: "Foreign Passenger" }] } } });
    bookingIds.push(foreign.id);

    const query = parseAirlineBookingQuery({ search: "Demo Contact", paymentStatus: "PAID", flightFromDate: "2026-11-05", flightToDate: "2026-11-05" })!;
    const list = await listAirlineBookings(airline.id, query);
    assert.equal(list.pagination.total, 1);
    assert.equal(list.items[0].passengerCount, 2);
    assert.equal(list.items[0].paymentStatus, "PAID");
    assert.equal(list.items[0].contactPhone, "0901234567");
    assert.equal((await listAirlineBookings(airline.id, parseAirlineBookingQuery({ paymentStatus: "NO_PAYMENT" })!)).pagination.total, 1);
    const detail = await getAirlineBooking(airline.id, paid.id);
    assert.equal(detail?.passengers.length, 2);
    assert.ok(detail?.passengers.every(person => person.ticket?.ticketCode));
    assert.equal(JSON.stringify(detail).includes("qrToken"), false);
    assert.equal(JSON.stringify(detail).includes("documentNumber"), false);
    assert.equal((await getAirlineBooking(airline.id, pending.id))?.passengers[0].ticket, null);
    assert.equal(await getAirlineBooking(other.id, paid.id), null);
    assert.equal((await listAirlineBookings(other.id, query)).pagination.total, 0);
  } finally {
    if (bookingIds.length) {
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      const passengers = await prisma.passenger.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true } });
      await prisma.ticket.deleteMany({ where: { passengerId: { in: passengers.map(item => item.id) } } });
      await prisma.passenger.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (flightIds.length) await prisma.flight.deleteMany({ where: { id: { in: flightIds } } });
    if (airlineIds.length) await prisma.airline.deleteMany({ where: { id: { in: airlineIds } } });
    await prisma.$disconnect();
  }
});
