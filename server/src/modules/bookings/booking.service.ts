
import { randomInt } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { calculateCurrentPrice } from "../flights/pricing.service";

const BOOKING_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateBookingCode() {
  return Array.from({ length: 6 }, () => BOOKING_CODE_CHARACTERS[randomInt(BOOKING_CODE_CHARACTERS.length)]).join("");
}

type PassengerInput = {
  fullName: string;
  documentNumber: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  nationality: string;
};

export type CreateBookingInput = {
  flightId: number;
  returnFlightId?: number;
  userId?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  passengers: PassengerInput[];
};

export async function createBooking(input: CreateBookingInput) {
  if (!Number.isInteger(input.flightId) || input.flightId < 1) {
    throw new Error("Mã chuyến bay không hợp lệ.");
  }
  if (input.returnFlightId !== undefined &&
      (!Number.isInteger(input.returnFlightId) || input.returnFlightId < 1 || input.returnFlightId === input.flightId)) {
    throw new Error("Mã chuyến bay chiều về không hợp lệ.");
  }

  const contactName = input.contactName.trim();

  if (contactName.length < 2 || contactName.length > 120) {
    throw new Error("Tên người liên hệ phải từ 2 đến 120 ký tự.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail.trim()) ||
      input.contactEmail.trim().length > 255) {
    throw new Error("Email không hợp lệ.");
  }

  if (!/^\+[1-9]\d{7,18}$/.test(input.contactPhone.trim()) ||
      input.contactPhone.trim().length > 20) {
    throw new Error("Số điện thoại không hợp lệ.");
  }

  if (
    !Array.isArray(input.passengers) ||
    input.passengers.length < 1 ||
    input.passengers.length > 9
  ) {
    throw new Error("Số hành khách phải từ 1 đến 9.");
  }

  const passengers = input.passengers.map((p) => {
    const fullName = p.fullName.trim();

    if (fullName.length < 2 || fullName.length > 120) {
      throw new Error("Tên hành khách phải từ 2 đến 120 ký tự.");
    }

    const documentNumber = p.documentNumber.trim();
    if (!/^\d{12}$/.test(documentNumber)) {
      throw new Error("CCCD phải gồm đúng 12 chữ số.");
    }

    if (p.gender !== "MALE" && p.gender !== "FEMALE") {
      throw new Error("Giới tính không hợp lệ.");
    }

    const nationality = p.nationality.trim();
    if (nationality.length < 2 || nationality.length > 80) {
      throw new Error("Quốc tịch phải từ 2 đến 80 ký tự.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth)) {
      throw new Error("Ngày sinh phải có định dạng YYYY-MM-DD.");
    }

    const dateOfBirth = new Date(`${p.dateOfBirth}T00:00:00.000Z`);
    if (
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth.toISOString().slice(0, 10) !== p.dateOfBirth ||
      dateOfBirth > new Date()
    ) {
      throw new Error("Ngày sinh không hợp lệ.");
    }

    return {
      fullName,
      documentNumber,
      gender: p.gender,
      dateOfBirth,
      nationality,
    };
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  const createWithCode = () => prisma.$transaction(async (tx) => {
    const flightIds = [input.flightId, ...(input.returnFlightId ? [input.returnFlightId] : [])];
    for (const flightId of [...flightIds].sort((a, b) => a - b)) {
      const rows = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM Flight WHERE id = ${flightId} FOR UPDATE
      `;
      if (!rows.length) throw new Error("Không tìm thấy chuyến bay.");
    }

    const flights = await tx.flight.findMany({
      where: { id: { in: flightIds } },
      include: { airline: { select: { status: true } } },
    });
    const outbound = flights.find((flight) => flight.id === input.flightId);
    const inbound = input.returnFlightId
      ? flights.find((flight) => flight.id === input.returnFlightId)
      : undefined;
    if (inbound && outbound &&
        (outbound.departureCode !== inbound.arrivalCode ||
         outbound.arrivalCode !== inbound.departureCode ||
         inbound.departureTime < outbound.arrivalTime)) {
      throw new Error("Chuyến về không khớp hành trình hoặc thời gian chiều đi.");
    }

    const prices: number[] = [];
    for (const flightId of flightIds) {
      const flight = flights.find((item) => item.id === flightId);
      if (!flight || flight.status !== "SCHEDULED" || flight.saleStatus !== "ON_SALE" ||
          flight.airline.status !== "ACTIVE" || flight.departureTime <= now) {
        throw new Error("Chuyến bay không còn nhận đặt chỗ.");
      }
      const activeBookings = await tx.booking.findMany({
        where: {
          OR: [{ flightId }, { returnFlightId: flightId }],
          AND: [{ OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: now } },
          ] }],
        },
        select: { status: true, passengers: { select: { id: true } } },
      });
      const confirmedPassengers = activeBookings.reduce(
        (sum, booking) => sum + (booking.status === "CONFIRMED" ? booking.passengers.length : 0), 0,
      );
      const occupiedSeats = activeBookings.reduce(
        (sum, booking) => sum + booking.passengers.length, 0,
      );
      if (occupiedSeats + passengers.length > flight.capacity) {
        throw new Error("Không đủ ghế cho số hành khách yêu cầu.");
      }
      const price = calculateCurrentPrice({
        basePrice: flight.basePrice,
        departureTime: flight.departureTime,
        capacity: flight.capacity,
        confirmedPassengers,
        now,
      }).currentPrice;
      if (!Number.isSafeInteger(price)) throw new Error("Tổng tiền vượt giới hạn cho phép.");
      prices.push(price);
    }

    const totalAmount = prices.reduce((sum, price) => sum + price, 0) * passengers.length;
    if (!Number.isSafeInteger(totalAmount)) throw new Error("Tổng tiền vượt giới hạn cho phép.");

    return tx.booking.create({
      data: {
        bookingCode: generateBookingCode(),
        flightId: input.flightId,
        returnFlightId: input.returnFlightId,
        outboundUnitPrice: prices[0],
        returnUnitPrice: prices[1],
        userId: input.userId,
        contactName,
        contactEmail: input.contactEmail.trim(),
        contactPhone: input.contactPhone.trim(),
        totalAmount,
        status: "PENDING",
        expiresAt,
        passengers: {
          create: passengers,
        },
      },
      include: {
        flight: {
          include: { airline: true },
        },
        returnFlight: { include: { airline: true } },
        passengers: true,
      },
    });
  });

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await createWithCode();
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
        throw error;
      }
    }
  }
  throw new Error("Không thể tạo mã đặt chỗ duy nhất. Vui lòng thử lại.");
}
