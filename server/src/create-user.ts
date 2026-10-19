import "dotenv/config";
import { prisma } from "./lib/prisma";
import { hashPassword } from "./modules/auth/auth.service";
import type { Role } from "./modules/auth/auth.service";

async function main() {
  const name = process.env.BOOTSTRAP_USER_NAME?.trim();
  const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;
  const role = process.env.BOOTSTRAP_USER_ROLE as Role | undefined;
  const airlineId = process.env.BOOTSTRAP_AIRLINE_ID ? Number(process.env.BOOTSTRAP_AIRLINE_ID) : null;
  const validRoles: Role[] = ["ADMIN", "CUSTOMER", "AIRLINE_FLIGHT_MANAGER", "AIRLINE_SALES_MANAGER"];
  if (!name || name.length > 120 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 10 || !role || !validRoles.includes(role)) {
    throw new Error("Cần BOOTSTRAP_USER_NAME, BOOTSTRAP_USER_EMAIL, BOOTSTRAP_USER_PASSWORD (>=10 ký tự) và BOOTSTRAP_USER_ROLE hợp lệ.");
  }
  const airlineRole = role === "AIRLINE_FLIGHT_MANAGER" || role === "AIRLINE_SALES_MANAGER";
  if (airlineRole !== (airlineId !== null) || (airlineId !== null && (!Number.isInteger(airlineId) || airlineId < 1))) {
    throw new Error("Nhân viên hãng cần BOOTSTRAP_AIRLINE_ID hợp lệ; admin/khách không có airlineId.");
  }
  if (airlineId !== null && !await prisma.airline.findUnique({ where: { id: airlineId } })) throw new Error("Không tìm thấy hãng bay.");
  if (await prisma.user.findUnique({ where: { email } })) throw new Error("Email đã có tài khoản; không ghi đè mật khẩu hoặc vai trò.");
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password), role, airlineId } });
  console.log(`Đã tạo ${user.role}: ${user.email} (id ${user.id})`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
