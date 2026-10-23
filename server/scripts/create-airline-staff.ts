
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth.service";

async function main() {
  const email = "qr.staff@example.com";
  const password = "StaffQR2026!Demo";
  const airlineId = Number(process.argv[2]);

  if (!Number.isInteger(airlineId) || airlineId < 1) {
    throw new Error(
      "Cách chạy: npx tsx scripts/create-airline-staff.ts <AIRLINE_ID>",
    );
  }

  const airline = await prisma.airline.findUnique({
    where: { id: airlineId },
    select: { id: true, name: true, status: true },
  });

  if (!airline || airline.status !== "ACTIVE") {
    throw new Error("Không tìm thấy hãng bay ACTIVE với ID đã nhập.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new Error(
      `Email ${email} đã tồn tại. Không thay đổi tài khoản hiện có.`,
    );
  }

  const user = await prisma.user.create({
    data: {
      name: "QR Test Staff",
      email,
      passwordHash: await hashPassword(password),
      role: "AIRLINE_FLIGHT_MANAGER",
      status: "ACTIVE",
      airlineId: airline.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      airlineId: true,
      status: true,
    },
  });

  console.log("Đã tạo tài khoản kiểm thử:", user);
  console.log("Mật khẩu kiểm thử:", password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
