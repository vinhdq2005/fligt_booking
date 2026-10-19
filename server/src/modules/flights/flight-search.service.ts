import { prisma } from "../../lib/prisma";
import { calculateCurrentPrice } from "./pricing.service";

export type FlightSearchInput = {
  from: string;
  to: string;
  date: string;
  airline?: string;
};

export async function searchFlights(input: FlightSearchInput) {
  const from = input.from.trim().toUpperCase();
  const to = input.to.trim().toUpperCase();
  const airline = input.airline?.trim().toUpperCase();

  if (airline && !/^[A-Z0-9]{2,10}$/.test(airline)) {
    throw new Error("Mã hãng bay không hợp lệ.");
  }

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
        gt: now,
      },
      status: "SCHEDULED",
      saleStatus: "ON_SALE",
      airline: { status: "ACTIVE", ...(airline ? { code: airline } : {}) },
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
          status: true,
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
    // Số ghế đã bán thực sự: chỉ tính booking CONFIRMED.
    const confirmedPassengers = bookings.reduce(
      (total, booking) =>
        booking.status === "CONFIRMED"
          ? total + booking.passengers.length
          : total,
      0,
    );

    // Ghế đang sử dụng: gồm CONFIRMED và PENDING còn hạn.
    const occupiedSeats = bookings.reduce(
      (total, booking) => total + booking.passengers.length,
      0,
    );

    const availableSeats = Math.max(
      0,
      flight.capacity - occupiedSeats,
    );

    const pricing = calculateCurrentPrice({
      basePrice: flight.basePrice,
      departureTime: flight.departureTime,
      capacity: flight.capacity,
      confirmedPassengers,
      now,
    });

    return {
      ...flight,
      occupiedSeats,
      availableSeats,
      confirmedPassengers,
      currentPrice: pricing.currentPrice,
      pricingDetails: {
        occupancyPercent: pricing.occupancyPercent,
        timeMultiplier: pricing.timeMultiplier,
        occupancyMultiplier: pricing.occupancyMultiplier,
        departureMultiplier: pricing.departureMultiplier,
        pricedAt: pricing.pricedAt,
      },
    };
  });
}

export async function getFlightById(id: number) {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Mã chuyến bay không hợp lệ.");
  }

  const now = new Date();

  const flight = await prisma.flight.findFirst({
    where: { id, saleStatus: "ON_SALE", airline: { status: "ACTIVE" } },
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
          status: true,
          passengers: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!flight) {
    return null;
  }

  if (
    flight.status !== "SCHEDULED" ||
    flight.departureTime <= now
  ) {
    throw new Error("Chuyến bay không còn khả dụng.");
  }

  const confirmedPassengers = flight.bookings.reduce(
    (total, booking) =>
      booking.status === "CONFIRMED"
        ? total + booking.passengers.length
        : total,
    0,
  );

  const occupiedSeats = flight.bookings.reduce(
    (total, booking) => total + booking.passengers.length,
    0,
  );

  const availableSeats = Math.max(
    0,
    flight.capacity - occupiedSeats,
  );

  const pricing = calculateCurrentPrice({
    basePrice: flight.basePrice,
    departureTime: flight.departureTime,
    capacity: flight.capacity,
    confirmedPassengers,
    now,
  });

  const { bookings, ...flightData } = flight;

  return {
    ...flightData,
    occupiedSeats,
    availableSeats,
    confirmedPassengers,
    currentPrice: pricing.currentPrice,
    pricingDetails: {
      occupancyPercent: pricing.occupancyPercent,
      timeMultiplier: pricing.timeMultiplier,
      occupancyMultiplier: pricing.occupancyMultiplier,
      departureMultiplier: pricing.departureMultiplier,
      pricedAt: pricing.pricedAt,
    },
  };
}
