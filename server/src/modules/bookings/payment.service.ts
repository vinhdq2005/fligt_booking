
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
      price: number;
      status: string;
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
    // Khóa bản ghi để hạn chế hai yêu cầu thanh toán
    // cùng xử lý một đặt chỗ tại cùng thời điểm.
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
        passengers: {
          include: { ticket: true },
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

    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });

      return { expired: true as const };
    }

    if (booking.flight.status !== "SCHEDULED") {
      throw new Error("Chuyến bay không còn khả dụng.");
    }

    if (booking.passengers.length === 0) {
      throw new Error("Đặt chỗ chưa có hành khách.");
    }

    if (booking.passengers.some((p) => p.ticket !== null)) {
      throw new Error(
        "Đặt chỗ đã có vé; không thể thanh toán lại.",
      );
    }

    // Đây là thanh toán giả lập cho bài tập lớn,
    // không kết nối ngân hàng hay cổng thanh toán thật.
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: "VND",
        method: "MOCK",
        status: "PAID",
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });

    const tickets = [];

    for (const passenger of booking.passengers) {
      const ticket = await tx.ticket.create({
        data: {
          passengerId: passenger.id,
          price: booking.flight.basePrice,
          status: "ISSUED",
        },
      });

      tickets.push(ticket);
    }

    return {
      expired: false as const,
      bookingCode: booking.bookingCode,
      status: "CONFIRMED",
      totalAmount: booking.totalAmount,
      payment,
      tickets,
    };
  });

  if (result.expired) {
    throw new Error("Đặt chỗ đã hết hạn thanh toán.");
  }

  return {
    message: "Thanh toán mô phỏng thành công. Vé đã được phát hành.",
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
      tickets: result.tickets.map((ticket) => ({
        ticketCode: ticket.ticketCode,
        passengerId: ticket.passengerId,
        price: ticket.price,
        status: ticket.status,
      })),
    },
  };
}