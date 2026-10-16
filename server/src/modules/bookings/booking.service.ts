
import { prisma } from "../../lib/prisma";

type PassengerInput = {
  fullName: string;
  documentNumber: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  nationality: string;
};

export type CreateBookingInput = {
  flightId: number;
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

  return prisma.$transaction(async (tx) => {
    // Khóa dòng chuyến bay để các yêu cầu đặt chỗ đồng thời
    // không cùng kiểm tra một số ghế còn trống.
    const lockedFlights = await tx.$queryRaw<{ id: number }[]>`
      SELECT id
      FROM Flight
      WHERE id = ${input.flightId}
      FOR UPDATE
    `;

    if (lockedFlights.length === 0) {
      throw new Error("Không tìm thấy chuyến bay.");
    }

    const flight = await tx.flight.findUnique({
      where: { id: input.flightId },
      include: { airline: { select: { status: true } } },
    });

    if (
      !flight ||
      flight.status !== "SCHEDULED" ||
      flight.saleStatus !== "ON_SALE" ||
      flight.airline.status !== "ACTIVE" ||
      flight.departureTime <= now
    ) {
      throw new Error("Chuyến bay không còn nhận đặt chỗ.");
    }

    const activeBookings = await tx.booking.findMany({
      where: {
        flightId: flight.id,
        userId: input.userId,
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
    });

    const occupiedSeats = activeBookings.reduce(
      (total, booking) => total + booking.passengers.length,
      0,
    );

    if (occupiedSeats + passengers.length > flight.capacity) {
      throw new Error("Không đủ ghế cho số hành khách yêu cầu.");
    }

    const totalAmount = flight.basePrice * passengers.length;

    if (!Number.isSafeInteger(totalAmount)) {
      throw new Error("Tổng tiền vượt giới hạn cho phép.");
    }

    return tx.booking.create({
      data: {
        flightId: flight.id,
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
        passengers: true,
      },
    });
  });
}
