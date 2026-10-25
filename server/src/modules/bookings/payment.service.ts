import { prisma } from "../../lib/prisma";

type PayBookingResult = {
  message: string;
  item: {
    bookingCode: string;
    status: string;
    totalAmount: number;
    payment: {
      id: number;
      amount: number;
      currency: string;
      method: string;
      status: string;
    };
    tickets: Array<{
      ticketCode: string;
      passengerId: number;
      flightId: number;
      price: number;
      status: string;
      qrToken: string;
    }>;
  };
};

export async function payBooking(
  bookingCode: string,
): Promise<PayBookingResult> {
  const code = bookingCode.trim();

  if (!code) {
    throw new Error("Mã đặt chỗ không hợp lệ.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Khóa booking để hạn chế hai yêu cầu thanh toán đồng thời.
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id
      FROM Booking
      WHERE bookingCode = ${code}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new Error("Không tìm thấy đặt chỗ.");
    }

    const booking = await tx.booking.findUnique({
      where: { bookingCode: code },
      include: {
        flight: true,
        returnFlight: true,
        passengers: {
          include: {
            tickets: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw new Error("Không tìm thấy đặt chỗ.");
    }

    if (booking.status !== "PENDING") {
      throw new Error(
        "Đặt chỗ không ở trạng thái chờ thanh toán.",
      );
    }

    // Booking đã hết thời gian thanh toán.
    if (
      booking.expiresAt &&
      booking.expiresAt <= new Date()
    ) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });

      return { expired: true as const };
    }

    if (booking.flight.status !== "SCHEDULED") {
      throw new Error("Chuyến bay không còn khả dụng.");
    }
    if (booking.returnFlight && booking.returnFlight.status !== "SCHEDULED") {
      throw new Error("Chuyến bay không còn khả dụng.");
    }

    if (booking.passengers.length === 0) {
      throw new Error("Đặt chỗ chưa có hành khách.");
    }

    // Không phát hành vé trùng cho cùng hành khách.
    if (booking.passengers.some((p) => p.tickets.length > 0)) {
      throw new Error(
        "Đặt chỗ đã có vé; không thể thanh toán lại.",
      );
    }

    // Sử dụng giá đã chốt khi tạo booking.
    const passengerCount = booking.passengers.length;
    const totalAmount = booking.totalAmount;

    const outboundPrice = booking.outboundUnitPrice ?? totalAmount / passengerCount;
    const returnPrice = booking.returnFlight ? booking.returnUnitPrice : null;
    if (!Number.isSafeInteger(totalAmount) || totalAmount < 0 ||
        !Number.isSafeInteger(outboundPrice) || outboundPrice < 0 ||
        (booking.returnFlight && (!Number.isSafeInteger(returnPrice) || returnPrice === null || returnPrice < 0)) ||
        (outboundPrice + (returnPrice ?? 0)) * passengerCount !== totalAmount) {
      throw new Error(
        "Tổng tiền đặt chỗ không hợp lệ để phát hành vé.",
      );
    }

    // Thanh toán mô phỏng, chưa kết nối cổng thanh toán thật.
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: totalAmount,
        currency: "VND",
        method: "MOCK",
        status: "PAID",
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });

    const tickets: Array<{
      ticketCode: string;
      passengerId: number;
      flightId: number;
      price: number;
      status: string;
      qrToken: string;
    }> = [];

    for (const passenger of booking.passengers) {
      for (const [flightId, price] of [
        [booking.flightId, outboundPrice],
        ...(booking.returnFlightId && returnPrice !== null ? [[booking.returnFlightId, returnPrice]] : []),
      ]) {
        const ticket = await tx.ticket.create({
          data: { passengerId: passenger.id, flightId, price, status: "ISSUED" },
        });
        tickets.push({
          ticketCode: ticket.ticketCode,
          passengerId: ticket.passengerId,
          flightId: ticket.flightId,
          price: ticket.price,
          status: ticket.status,
          qrToken: ticket.qrToken,
        });
      }
    }

    return {
      expired: false as const,
      bookingCode: booking.bookingCode,
      status: "CONFIRMED",
      totalAmount,
      payment,
      tickets,
    };
  });

  if (result.expired) {
    throw new Error("Đặt chỗ đã hết hạn thanh toán.");
  }

  return {
    message:
      "Thanh toán mô phỏng thành công. Vé đã được phát hành.",
    item: {
      bookingCode: result.bookingCode,
      status: result.status,
      totalAmount: result.totalAmount,
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        method: result.payment.method,
        status: result.payment.status,
      },
      tickets: result.tickets,
    },
  };
}
