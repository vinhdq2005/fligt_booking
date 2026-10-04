import { prisma } from "./lib/prisma";

try {
  const count = await prisma.flightSearch.count();
  console.log("Số lượt tìm kiếm đã lưu:", count);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}