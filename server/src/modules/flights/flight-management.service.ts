
import { prisma } from "../../lib/prisma";

export type CreateFlightInput = {
  flightNumber: string;
  airlineId: number;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
};

export async function createFlight(input: CreateFlightInput) {
  const flightNumber = input.flightNumber.trim().toUpperCase();
  const departureCode = input.departureCode.trim().toUpperCase();
  const arrivalCode = input.arrivalCode.trim().toUpperCase();

  if (!flightNumber || flightNumber.length > 20) {
    throw new Error("Số hiệu chuyến bay không hợp lệ.");
  }

  if (!/^[A-Z]{3}$/.test(departureCode) ||
      !/^[A-Z]{3}$/.test(arrivalCode) ||
      departureCode === arrivalCode) {
    throw new Error("Mã sân bay đi và đến phải gồm 3 chữ cái và không được trùng nhau.");
  }

  if (!Number.isInteger(input.airlineId) || input.airlineId < 1) {
    throw new Error("Mã hãng bay không hợp lệ.");
  }

  const departureTime = new Date(input.departureTime);
  const arrivalTime = new Date(input.arrivalTime);

  if (Number.isNaN(departureTime.getTime()) ||
      Number.isNaN(arrivalTime.getTime()) ||
      arrivalTime <= departureTime) {
    throw new Error("Thời gian đến phải sau thời gian khởi hành và cả hai phải hợp lệ.");
  }

  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM Airline WHERE id = ${input.airlineId} AND status = 'ACTIVE' FOR UPDATE`;
    if (!rows.length) throw new Error("Hãng bay đang bị khóa hoặc không tồn tại.");
    return tx.flight.create({
      data: {
      flightNumber,
      airlineId: input.airlineId,
      departureCode,
      arrivalCode,
      departureTime,
      arrivalTime,
      capacity: 0,
      basePrice: 0,
      saleStatus: "HIDDEN",
    },
      include: { airline: true },
    });
  });
}

export async function listManagedFlights(airlineId?: number) {
  return prisma.flight.findMany({
    where: airlineId === undefined ? undefined : { airlineId },
    orderBy: { departureTime: "asc" },
    include: {
      airline: true,
      _count: {
        select: { bookings: true },
      },
    },
  });
}
