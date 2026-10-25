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

test("round trips assign tickets and paid revenue to each flight and airline", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const airlineIds: number[] = [];
  const flightIds: number[] = [];
  const bookingIds: number[] = [];
  try {
    const airline = await prisma.airline.create({ data: { code: `R${suffix}`, name: `Round trip ${suffix}` } });
    const other = await prisma.airline.create({ data: { code: `S${suffix}`, name: `Return ${suffix}` } });
    airlineIds.push(airline.id, other.id);
    const makeFlight = async (airlineId: number, flightNumber: string, departureCode: string, arrivalCode: string) => {
      const flight = await prisma.flight.create({ data: { airlineId, flightNumber, departureCode, arrivalCode,
        departureTime: new Date("2026-11-10T03:00:00Z"), arrivalTime: new Date("2026-11-10T05:00:00Z"),
        capacity: 5, basePrice: 100, status: "SCHEDULED", saleStatus: "ON_SALE" } });
      flightIds.push(flight.id);
      return flight;
    };
    const outbound = await makeFlight(airline.id, `R${suffix}A`, "HAN", "SGN");
    const ownReturn = await makeFlight(airline.id, `R${suffix}B`, "SGN", "HAN");
    const otherReturn = await makeFlight(other.id, `S${suffix}B`, "SGN", "HAN");
    const crossAirline = await prisma.booking.create({ data: { flightId: outbound.id, returnFlightId: otherReturn.id,
      contactName: "Dashboard test", totalAmount: 600, status: "CONFIRMED",
      passengers: { create: [{ fullName: "One" }, { fullName: "Two" }] } },
      include: { passengers: true } });
    bookingIds.push(crossAirline.id);
    const sameAirline = await prisma.booking.create({ data: { flightId: outbound.id, returnFlightId: ownReturn.id,
      contactName: "Dashboard test", totalAmount: 270, status: "CONFIRMED",
      passengers: { create: { fullName: "Three" } } },
      include: { passengers: true } });
    bookingIds.push(sameAirline.id);
    for (const passenger of crossAirline.passengers) {
      await prisma.ticket.create({ data: { passengerId: passenger.id, flightId: outbound.id, price: 100 } });
      await prisma.ticket.create({ data: { passengerId: passenger.id, flightId: otherReturn.id, price: 200 } });
    }
    await prisma.ticket.create({ data: { passengerId: sameAirline.passengers[0].id, flightId: outbound.id, price: 150 } });
    await prisma.ticket.create({ data: { passengerId: sameAirline.passengers[0].id, flightId: ownReturn.id, price: 120 } });
    await prisma.payment.create({ data: { bookingId: crossAirline.id, amount: 600, method: "MOCK", status: "PAID" } });
    await prisma.payment.create({ data: { bookingId: sameAirline.id, amount: 270, method: "MOCK", status: "PAID" } });

    const own = await getAirlineDashboard(airline.id, { fromDate: "2026-11-10", toDate: "2026-11-10" });
    const away = await getAirlineDashboard(other.id, { fromDate: "2026-11-10", toDate: "2026-11-10" });
    assert.deepEqual([own.summary.ticketsSold, own.summary.paidBookings, own.summary.revenue], [4, 2, 470]);
    assert.deepEqual([away.summary.ticketsSold, away.summary.paidBookings, away.summary.revenue], [2, 1, 400]);
    const outboundRow = own.flights.find(item => item.id === outbound.id)!;
    const ownReturnRow = own.flights.find(item => item.id === ownReturn.id)!;
    assert.deepEqual([outboundRow.ticketsSold, outboundRow.paidBookings, outboundRow.revenue], [3, 2, 350]);
    assert.deepEqual([ownReturnRow.ticketsSold, ownReturnRow.paidBookings, ownReturnRow.revenue], [1, 1, 120]);
    assert.equal(own.departureSeries[0].paidBookings, 2);
    assert.equal((await getAirlineDashboard(other.id, { flightId: otherReturn.id })).summary.revenue, 400);
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
