import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { createBooking } from "./booking.service";
import { payBooking } from "./payment.service";
import { getBookingByCode } from "./booking-query.service";
import { verifyTicketQR } from "../tickets/ticket.service";
import { getAirlineBooking, listAirlineBookings, parseAirlineBookingQuery } from "../airlines/airline-bookings.service";

test("one round-trip booking issues a ticket for each passenger and flight", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  let airlineId: number | undefined;
  const flightIds: number[] = [];
  let bookingId: number | undefined;
  try {
    const airline = await prisma.airline.create({ data: { code: `R${suffix}`, name: `Round trip ${suffix}` } });
    airlineId = airline.id;
    const departureTime = new Date(Date.now() + 7 * 86400000);
    const outbound = await prisma.flight.create({ data: {
      airlineId, flightNumber: `R${suffix}A`, departureCode: "HAN", arrivalCode: "PQC",
      departureTime, arrivalTime: new Date(departureTime.getTime() + 2 * 3600000),
      capacity: 5, basePrice: 500000, saleStatus: "ON_SALE",
    } });
    flightIds.push(outbound.id);
    const inbound = await prisma.flight.create({ data: {
      airlineId, flightNumber: `R${suffix}B`, departureCode: "PQC", arrivalCode: "HAN",
      departureTime: new Date(departureTime.getTime() + 3 * 86400000),
      arrivalTime: new Date(departureTime.getTime() + 3 * 86400000 + 2 * 3600000),
      capacity: 5, basePrice: 700000, saleStatus: "ON_SALE",
    } });
    flightIds.push(inbound.id);
    const booking = await createBooking({
      flightId: outbound.id, returnFlightId: inbound.id,
      contactName: "Demo Passenger", contactEmail: "roundtrip@example.test", contactPhone: "+84901234567",
      passengers: ["Passenger One", "Passenger Two"].map((fullName, index) => ({
        fullName, documentNumber: `0123456789${index}0`, gender: "MALE" as const,
        dateOfBirth: "1990-01-01", nationality: "Vietnamese",
      })),
    });
    bookingId = booking.id;
    assert.match(booking.bookingCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(booking.returnFlightId, inbound.id);
    assert.equal(booking.totalAmount, 2 * (booking.outboundUnitPrice! + booking.returnUnitPrice!));

    const payment = await payBooking(booking.bookingCode);
    assert.equal(payment.item.payment.amount, booking.totalAmount);
    assert.equal(payment.item.tickets.length, 4);
    assert.deepEqual(payment.item.tickets.map(ticket => ticket.flightId).sort(),
      [outbound.id, outbound.id, inbound.id, inbound.id].sort());
    assert.equal(new Set(payment.item.tickets.map(ticket => ticket.ticketCode)).size, 4);

    const detail = await getBookingByCode(booking.bookingCode);
    assert.equal(detail.returnFlightId, inbound.id);
    assert.equal(detail.passengers.length, 2);
    assert.ok(detail.passengers.every(passenger => passenger.tickets.length === 2));
    assert.equal((await prisma.payment.count({ where: { bookingId } })), 1);
    const returnTicket = payment.item.tickets.find(ticket => ticket.flightId === inbound.id)!;
    const verified = await verifyTicketQR(returnTicket.qrToken);
    assert.equal(verified.flight.flightNumber, inbound.flightNumber);
    const airlineDetail = await getAirlineBooking(airlineId, bookingId);
    assert.ok(airlineDetail?.passengers.every(passenger => passenger.tickets.length === 2));
    const returnList = await listAirlineBookings(airlineId, parseAirlineBookingQuery({
      departureCode: "PQC", arrivalCode: "HAN", paymentStatus: "PAID",
    })!);
    assert.equal(returnList.pagination.total, 1);
  } finally {
    if (bookingId) {
      await prisma.payment.deleteMany({ where: { bookingId } });
      const passengers = await prisma.passenger.findMany({ where: { bookingId }, select: { id: true } });
      await prisma.ticket.deleteMany({ where: { passengerId: { in: passengers.map(item => item.id) } } });
      await prisma.passenger.deleteMany({ where: { bookingId } });
      await prisma.booking.delete({ where: { id: bookingId } });
    }
    if (flightIds.length) await prisma.flight.deleteMany({ where: { id: { in: flightIds } } });
    if (airlineId) await prisma.airline.delete({ where: { id: airlineId } });
    await prisma.$disconnect();
  }
});
