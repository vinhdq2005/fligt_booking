
import { prisma } from "../../lib/prisma";

export type FlightSearchInput = {
  from: string;
  to: string;
  date: string;
};

export async function searchFlights(input: FlightSearchInput) {
  const from = input.from.trim().toUpperCase();
  const to = input.to.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    throw new Error("Mã sân bay phải gồm 3 chữ cái.");
  }

  if (from === to) {
    throw new Error("Sân bay đi và sân bay đến không được trùng nhau.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Ngày bay phải có định dạng YYYY-MM-DD.");
  }

  const start = new Date(`${input.date}T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    start.toISOString().slice(0, 10) !== input.date
  ) {
    throw new Error("Ngày bay không hợp lệ.");
  }

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();

  const flights = await prisma.flight.findMany({
    where: {
      departureCode: from,
      arrivalCode: to,
      departureTime: {
        gte: start,
        lt: end,
      },
      status: "SCHEDULED",
    },
    include: {
      airline: true,
      bookings: {
        where: {
          OR: [
            { status: "CONFIRMED" },
            {
              status: "PENDING",
              expiresAt: { gt: now },
            },
          ],
        },
        select: {
          passengers: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: {
      departureTime: "asc",
    },
  });

  return flights.map(({ bookings, ...flight }) => {
    const occupiedSeats = bookings.reduce(
      (total, booking) => total + booking.passengers.length,
      0,
    );

    return {
      ...flight,
      occupiedSeats,
      availableSeats: Math.max(0, flight.capacity - occupiedSeats),
    };
  });
}

export async function getFlightById(id: number) {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Mã chuyến bay không hợp lệ.");
  }

  return prisma.flight.findUnique({
    where: { id },
    include: {
      airline: true,
    },
  });
}