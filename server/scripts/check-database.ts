import "dotenv/config";
import { databaseProvider, prisma } from "../src/lib/prisma";
import { sqlIdentifier as ident } from "../src/lib/sql-identifier";

try {
  const [bookings, flights, payments, sample] = await Promise.all([
    prisma.booking.count(),
    prisma.flight.count(),
    prisma.payment.count(),
    prisma.booking.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, bookingCode: true, passengers: { select: { id: true } }, payments: { select: { id: true } } },
    }),
  ]);
  if (sample) {
    const locked = await prisma.$transaction((tx) => tx.$queryRaw<{ id: number }[]>`
      SELECT ${ident("id")} FROM ${ident("Booking")} WHERE ${ident("id")} = ${sample.id} FOR UPDATE
    `);
    if (locked[0]?.id !== sample.id) throw new Error("Booking row lock query failed");
  }
  const activeAirline = await prisma.airline.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
  if (activeAirline) {
    const rows = await prisma.$transaction((tx) => tx.$queryRaw<{ id: number }[]>`
      SELECT ${ident("id")} FROM ${ident("Airline")}
      WHERE ${ident("id")} = ${activeAirline.id} AND ${ident("status")} = 'ACTIVE' FOR UPDATE
    `);
    if (rows[0]?.id !== activeAirline.id) throw new Error("Airline row lock query failed");
  }
  console.log(`${databaseProvider}: flights=${flights}, bookings=${bookings}, payments=${payments}, bookingRead=${Boolean(sample)}`);
} finally {
  await prisma.$disconnect();
}
