import { prisma } from "../../lib/prisma";
import { calculateCurrentPrice } from "./pricing.service";

export type FlightSearchInput = {
  from: string;
  to: string;
  date: string;
  airline?: string;
};

export type FlightCalendarInput = Omit<FlightSearchInput, "date"> & {
  start: string;
  end: string;
  passengers: number;
};

export async function getFlightCalendarPrices(input: FlightCalendarInput) {
  const from = input.from.trim().toUpperCase();
  const to = input.to.trim().toUpperCase();
  const airline = input.airline?.trim().toUpperCase();
  const parseDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const day = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value ? day : null;
  };
  const start = parseDay(input.start);
  const end = parseDay(input.end);
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to ||
      (airline && !/^[A-Z0-9]{2,10}$/.test(airline)) || !start || !end ||
      end <= start || end.getTime() - start.getTime() > 63 * 86400000 ||
      !Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > 9) {
    throw new Error("Thông tin lịch giá không hợp lệ.");
  }

  const now = new Date();
  const flights = await prisma.flight.findMany({
    where: {
      departureCode: from,
      arrivalCode: to,
      departureTime: { gte: start, lt: end, gt: now },
      status: "SCHEDULED",
      saleStatus: "ON_SALE",
      airline: { status: "ACTIVE", ...(airline ? { code: airline } : {}) },
    },
    include: {
      bookings: { where: { OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: { gt: now } },
      ] }, select: { status: true, passengers: { select: { id: true } } } },
      returnBookings: { where: { OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: { gt: now } },
      ] }, select: { status: true, passengers: { select: { id: true } } } },
    },
  });

  const lowestByDate = new Map<string, number>();
  for (const flight of flights) {
    const bookings = [...flight.bookings, ...flight.returnBookings];
    const occupied = bookings.reduce((sum, booking) => sum + booking.passengers.length, 0);
    if (flight.capacity - occupied < input.passengers) continue;
    const confirmed = bookings.reduce((sum, booking) =>
      sum + (booking.status === "CONFIRMED" ? booking.passengers.length : 0), 0);
    const price = calculateCurrentPrice({
      basePrice: flight.basePrice,
      departureTime: flight.departureTime,
      capacity: flight.capacity,
      confirmedPassengers: confirmed,
      now,
    }).currentPrice;
    const date = flight.departureTime.toISOString().slice(0, 10);
    lowestByDate.set(date, Math.min(lowestByDate.get(date) ?? Infinity, price));
  }
  return [...lowestByDate].sort(([left], [right]) => left.localeCompare(right))
    .map(([date, price]) => ({ date, price }));
}

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
      returnBookings: {
        where: { OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", expiresAt: { gt: now } },
        ] },
        select: { status: true, passengers: { select: { id: true } } },
      },
    },
    orderBy: {
      departureTime: "asc",
    },
  });

  return flights.map(({ bookings, returnBookings, ...flight }) => {
    const allBookings = [...bookings, ...returnBookings];
    // Số ghế đã bán thực sự: chỉ tính booking CONFIRMED.
    const confirmedPassengers = allBookings.reduce(
      (total, booking) =>
        booking.status === "CONFIRMED"
          ? total + booking.passengers.length
          : total,
      0,
    );

    // Ghế đang sử dụng: gồm CONFIRMED và PENDING còn hạn.
    const occupiedSeats = allBookings.reduce(
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
      returnBookings: {
        where: { OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", expiresAt: { gt: now } },
        ] },
        select: { status: true, passengers: { select: { id: true } } },
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

  const allBookings = [...flight.bookings, ...flight.returnBookings];
  const confirmedPassengers = allBookings.reduce(
    (total, booking) =>
      booking.status === "CONFIRMED"
        ? total + booking.passengers.length
        : total,
    0,
  );

  const occupiedSeats = allBookings.reduce(
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

  const { bookings, returnBookings, ...flightData } = flight;

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
