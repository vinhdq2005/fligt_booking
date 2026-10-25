
import { prisma } from "../../lib/prisma";

export async function getBookingByCode(bookingCode: string) {
  const code = bookingCode.trim();

  if (!code) {
    throw new Error("Mã đặt chỗ không hợp lệ.");
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      bookingCode: true,
      flightId: true,
      returnFlightId: true,
      outboundUnitPrice: true,
      returnUnitPrice: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      totalAmount: true,
      status: true,
      expiresAt: true,
      createdAt: true,

      flight: {
        select: {
          flightNumber: true,
          departureCode: true,
          arrivalCode: true,
          departureTime: true,
          arrivalTime: true,
          basePrice: true,
          airline: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },

      returnFlight: {
        select: {
          flightNumber: true,
          departureCode: true,
          arrivalCode: true,
          departureTime: true,
          arrivalTime: true,
          basePrice: true,
          airline: { select: { code: true, name: true } },
        },
      },

      passengers: {
        select: {
          id: true,
          fullName: true,
          tickets: {
            orderBy: { id: "asc" },
            select: {
              flightId: true,
              ticketCode: true,
              qrToken: true,
              price: true,
              status: true,
              issuedAt: true,
            },
          },
        },
      },

      payments: {
        select: {
          amount: true,
          currency: true,
          method: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error("Không tìm thấy đặt chỗ.");
  }

  return {
    ...booking,
    passengers: booking.passengers.map((passenger) => ({
      ...passenger,
      ticket: passenger.tickets.find((ticket) => ticket.flightId === booking.flightId) ?? null,
    })),
  };
}
