
import { prisma } from "../../lib/prisma";

export type CreateAirlineInput = {
  code: string;
  name: string;
};

export async function listAirlines() {
  return prisma.airline.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: { flights: true },
      },
    },
  });
}

export async function listPublicAirlines() {
  return prisma.airline.findMany({
    select: { code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createAirline(input: CreateAirlineInput) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    throw new Error("Mã hãng bay phải có 2-10 ký tự chữ hoặc số.");
  }

  if (name.length < 2 || name.length > 120) {
    throw new Error("Tên hãng bay phải dài từ 2 đến 120 ký tự.");
  }

  return prisma.airline.create({
    data: { code, name },
  });
}
