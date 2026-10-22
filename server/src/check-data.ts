import { prisma } from "./lib/prisma";

try {
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.airline.count(),
    prisma.flight.count(),
    prisma.booking.count(),
    prisma.passenger.count(),
    prisma.ticket.count(),
    prisma.payment.count(),
    prisma.pricingRule.count(),
  ]);

  const tables = [
    "User", "Airline", "Flight", "Booking",
    "Passenger", "Ticket", "Payment", "PricingRule",
  ];

  tables.forEach((table, i) => console.log(`${table}: ${counts[i]}`));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
