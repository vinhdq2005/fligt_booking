import { prisma } from "./lib/prisma";

async function main() {
  console.log("=== USERS ===");
  console.log(await prisma.user.findMany({
    select: {
      id: true, name: true, email: true,
      role: true, status: true, airlineId: true,
    },
    orderBy: { id: "asc" },
  }));

  console.log("\n=== FLIGHTS ===");
  console.log(await prisma.flight.findMany({
    select: {
      id: true, flightNumber: true, airlineId: true,
      departureCode: true, arrivalCode: true,
      departureTime: true, arrivalTime: true,
      capacity: true, basePrice: true,
      status: true, saleStatus: true,
    },
    orderBy: { id: "asc" },
  }));

  console.log("\n=== BOOKINGS WITHOUT TICKETS ===");
  console.log(await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      passengers: { some: { ticket: null } },
    },
    select: {
      id: true, bookingCode: true, status: true,
      passengers: {
        select: { id: true, fullName: true, ticket: { select: { id: true } } },
      },
    },
  }));

  console.log("\n=== PENDING BOOKINGS ===");
  console.log(await prisma.booking.findMany({
    where: { status: "PENDING" },
    select: {
      id: true, bookingCode: true, flightId: true,
      expiresAt: true, totalAmount: true,
      _count: { select: { passengers: true, payments: true } },
    },
  }));
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
