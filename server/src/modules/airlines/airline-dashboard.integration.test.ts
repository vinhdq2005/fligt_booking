import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { getAirlineDashboard, parseAirlineDashboardQuery } from "./airline-dashboard.service";

test("dashboard query validates dates and scope inputs", () => {
  assert.equal(parseAirlineDashboardQuery({ fromDate: "2026-10-21", toDate: "2026-10-22" })?.fromDate, "2026-10-21");
  assert.equal(parseAirlineDashboardQuery({ fromDate: "2026-10-22", toDate: "2026-10-21" }), null);
  assert.equal(parseAirlineDashboardQuery({ fromDate: "2026-02-30" }), null);
  assert.equal(parseAirlineDashboardQuery({ flightId: "0" }), null);
  assert.equal(parseAirlineDashboardQuery({ departureCode: "Hanoi" }), null);
});

test("dashboard totals count issued tickets and distinct paid bookings across all filtered flights", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const airlineIds: number[] = [];
  const flightIds: number[] = [];
  const bookingIds: number[] = [];
  try {
    const airline = await prisma.airline.create({ data: { code: `D${suffix}`, name: `Dashboard ${suffix}` } });
    airlineIds.push(airline.id);
    const other = await prisma.airline.create({ data: { code: `E${suffix}`, name: `Other ${suffix}` } });
    airlineIds.push(other.id);
    const flight = await prisma.flight.create({ data: { airlineId: airline.id, flightNumber: `D${suffix}`, departureCode: "HAN", arrivalCode: "SGN",
      departureTime: new Date("2026-11-05T03:00:00Z"), arrivalTime: new Date("2026-11-05T05:00:00Z"), capacity: 5, basePrice: 100000,
      status: "SCHEDULED", saleStatus: "ON_SALE" } });
    flightIds.push(flight.id);
    const otherFlight = await prisma.flight.create({ data: { airlineId: other.id, flightNumber: `E${suffix}`, departureCode: "HAN", arrivalCode: "SGN",
      departureTime: new Date("2026-11-05T03:00:00Z"), arrivalTime: new Date("2026-11-05T05:00:00Z"), capacity: 5, basePrice: 100000,
      status: "SCHEDULED", saleStatus: "ON_SALE" } });
    flightIds.push(otherFlight.id);
    const booking = await prisma.booking.create({ data: { flightId: flight.id, contactName: "Dashboard test", totalAmount: 200000, status: "CONFIRMED" } });
    bookingIds.push(booking.id);
    const first = await prisma.passenger.create({ data: { bookingId: booking.id, fullName: "One" } });
    const second = await prisma.passenger.create({ data: { bookingId: booking.id, fullName: "Two" } });
    await prisma.ticket.create({ data: { passengerId: first.id, flightId: flight.id, price: 100000, status: "ISSUED" } });
    await prisma.ticket.create({ data: { passengerId: second.id, flightId: flight.id, price: 100000, status: "USED" } });
    await prisma.payment.create({ data: { bookingId: booking.id, amount: 200000, method: "MOCK", status: "PAID" } });
    const result = await getAirlineDashboard(airline.id, { fromDate: "2026-11-05", toDate: "2026-11-05" });
    assert.equal(result.summary.flights, 1);
    assert.equal(result.summary.ticketsSold, 2);
    assert.equal(result.summary.paidBookings, 1);
    assert.equal(result.summary.revenue, 200000);
    assert.equal(result.summary.occupancyPercent, 40);
    assert.deepEqual(result.departureSeries.map(point => point.date), ["2026-11-05"]);
    assert.equal(result.routes[0].ticketsSold, 2);
    assert.equal((await getAirlineDashboard(other.id, { flightId: flight.id })).summary.flights, 0);
    assert.equal((await getAirlineDashboard(airline.id, { fromDate: "2026-11-06" })).summary.revenue, 0);
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
