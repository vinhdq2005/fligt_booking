import { prisma } from "./lib/prisma";

async function main() {
  console.log("\n=== BOOKING STATUS ===");
  console.log(await prisma.booking.groupBy({
    by: ["status"],
    _count: { _all: true }
  }));

  console.log("\n=== TICKET STATUS ===");
  console.log(await prisma.ticket.groupBy({
    by: ["status"],
    _count: { _all: true }
  }));

  console.log("\n=== PAYMENT STATUS ===");
  console.log(await prisma.payment.groupBy({
    by: ["status"],
    _count: { _all: true }
  }));

  console.log("\n=== FLIGHT STATUS ===");
  console.log(await prisma.flight.groupBy({
    by: ["status", "saleStatus"],
    _count: { _all: true }
  }));

  console.log("\n=== USER ROLE ===");
  console.log(await prisma.user.groupBy({
    by: ["role", "status"],
    _count: { _all: true }
  }));
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
