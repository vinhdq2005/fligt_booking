import { prisma } from "./lib/prisma";

async function main() {
  const bookings = await prisma.booking.findMany({
    orderBy: { id: "asc" },
    include: {
      flight: { select: { flightNumber: true, departureCode: true, arrivalCode: true } },
      passengers: {
        include: { ticket: true },
      },
      payments: true,
    },
  });

  for (const b of bookings) {
    console.log(JSON.stringify({
      id: b.id,
      bookingCode: b.bookingCode,
      flight: b.flight.flightNumber,
      route: `${b.flight.departureCode}-${b.flight.arrivalCode}`,
      status: b.status,
      expiresAt: b.expiresAt,
      totalAmount: b.totalAmount,
      passengerCount: b.passengers.length,
      tickets: b.passengers.map(p => p.ticket?.status ?? "NO_TICKET"),
      payments: b.payments.map(p => ({
        status: p.status,
        amount: p.amount,
        reviewStatus: p.reviewStatus,
      })),
    }));
  }
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
