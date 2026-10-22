import { prisma } from "./lib/prisma";

try {
  console.log("\n=== USERS ===");
  console.table(await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      airlineId: true,
    },
  }));

  console.log("\n=== AIRLINES ===");
  console.table(await prisma.airline.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  }));

  console.log("\n=== FLIGHTS ===");
  console.table(await prisma.flight.findMany({
    select: {
      id: true,
      flightNumber: true,
      airlineId: true,
      departureCode: true,
      arrivalCode: true,
      departureTime: true,
      arrivalTime: true,
      capacity: true,
      basePrice: true,
      status: true,
      saleStatus: true,
    },
  }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
