import { prisma } from "../../lib/prisma";

export class TicketServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TicketServiceError";
  }
}

/**
 * Xác minh QR vé.
 * Chỉ trả về thông tin tối thiểu cần thiết.
 * Không thay đổi trạng thái vé khi quét QR.
 */
export async function verifyTicketQR(qrToken: string) {
  const token = qrToken.trim();

  if (!token || token.length > 64) {
    throw new TicketServiceError("Mã QR không hợp lệ.", 400);
  }

  const ticket = await prisma.ticket.findUnique({
    where: {
      qrToken: token,
    },
    select: {
      ticketCode: true,
      status: true,
      issuedAt: true,
      usedAt: true,
      passenger: {
        select: {
          fullName: true,
          booking: {
            select: {
              status: true,
              flight: {
                select: {
                  flightNumber: true,
                  departureCode: true,
                  arrivalCode: true,
                  departureTime: true,
                  status: true,
                  airline: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new TicketServiceError(
      "Không tìm thấy vé tương ứng với mã QR.",
      404,
    );
  }

  const { passenger } = ticket;
  const { booking } = passenger;
  const { flight } = booking;

  const valid =
    ticket.status === "ISSUED" &&
    booking.status === "CONFIRMED" &&
    flight.status !== "CANCELLED";

  let message = "Vé hợp lệ, có thể làm thủ tục check-in.";

  if (ticket.status === "USED") {
    message = "Vé đã được sử dụng trước đó.";
  } else if (ticket.status === "CANCELLED") {
    message = "Vé đã bị hủy.";
  } else if (booking.status !== "CONFIRMED") {
    message = "Đặt chỗ chưa được xác nhận.";
  } else if (flight.status === "CANCELLED") {
    message = "Chuyến bay đã bị hủy.";
  }

  return {
    valid,
    ticket: {
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      usedAt: ticket.usedAt,
    },
    passenger: {
      fullName: passenger.fullName,
    },
    booking: {
      status: booking.status,
    },
    flight: {
      flightNumber: flight.flightNumber,
      departureCode: flight.departureCode,
      arrivalCode: flight.arrivalCode,
      departureTime: flight.departureTime,
      status: flight.status,
      airlineCode: flight.airline.code,
      airlineName: flight.airline.name,
    },
    message,
  };
}

/**
 * Check-in vé cho nhân viên hãng hàng không.
 * Khóa bản ghi trong transaction để hạn chế check-in đồng thời.
 */
export async function checkInTicketQR(
  qrToken: string,
  staff: {
    id: number;
    role: string;
    airlineId: number | null;
  },
) {
  const token = qrToken.trim();

  if (!token || token.length > 64) {
    throw new TicketServiceError("Mã QR không hợp lệ.", 400);
  }

  if (
    staff.role !== "AIRLINE_FLIGHT_MANAGER" ||
    staff.airlineId === null
  ) {
    throw new TicketServiceError(
      "Bạn không có quyền check-in vé.",
      403,
    );
  }

  return prisma.$transaction(async (tx) => {
    const ticketRows = await tx.$queryRaw<{ id: number }[]>`
      SELECT \`id\`
      FROM \`Ticket\`
      WHERE \`qrToken\` = ${token}
      FOR UPDATE
    `;

    if (ticketRows.length === 0) {
      const prismaTicket = await tx.ticket.findUnique({
        where: {
          qrToken: token,
        },
        select: {
          id: true,
          status: true,
          usedAt: true,
        },
      });

      if (!prismaTicket) {
        throw new TicketServiceError(
          "Không tìm thấy vé.",
          404,
        );
      }

      if (prismaTicket.status === "USED") {
        throw new TicketServiceError(
          "Vé đã được check-in trước đó.",
          409,
        );
      }

      throw new TicketServiceError(
        "Không thể khóa bản ghi vé để check-in. Vui lòng thử lại.",
        500,
      );
    }

    const ticket = await tx.ticket.findUnique({
      where: {
        qrToken: token,
      },
      select: {
        id: true,
        ticketCode: true,
        status: true,
        usedAt: true,
        passenger: {
          select: {
            fullName: true,
            booking: {
              select: {
                status: true,
                flight: {
                  select: {
                    flightNumber: true,
                    departureTime: true,
                    status: true,
                    airlineId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new TicketServiceError(
        "Không tìm thấy vé.",
        404,
      );
    }

    const booking = ticket.passenger.booking;
    const flight = booking.flight;

    if (flight.airlineId !== staff.airlineId) {
      throw new TicketServiceError(
        "Bạn không có quyền check-in vé của hãng hàng không này.",
        403,
      );
    }

    if (ticket.status === "USED") {
      throw new TicketServiceError(
        "Vé đã được check-in trước đó.",
        409,
      );
    }

    if (ticket.status === "CANCELLED") {
      throw new TicketServiceError(
        "Vé đã bị hủy.",
        409,
      );
    }

    if (booking.status !== "CONFIRMED") {
      throw new TicketServiceError(
        "Đặt chỗ chưa được xác nhận.",
        409,
      );
    }

    if (flight.status === "CANCELLED") {
      throw new TicketServiceError(
        "Chuyến bay đã bị hủy.",
        409,
      );
    }

    if (flight.departureTime <= new Date()) {
      throw new TicketServiceError(
        "Đã quá giờ khởi hành, không thể check-in.",
        409,
      );
    }

    const usedAt = new Date();

    await tx.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        status: "USED",
        usedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: staff.id,
        action: "TICKET_CHECK_IN",
        entityType: "Ticket",
        entityId: String(ticket.id),
        before: {
          status: ticket.status,
        },
        after: {
          status: "USED",
          usedAt: usedAt.toISOString(),
        },
      },
    });

    return {
      message: "Check-in thành công.",
      item: {
        ticketCode: ticket.ticketCode,
        passengerName: ticket.passenger.fullName,
        flightNumber: flight.flightNumber,
        status: "USED",
        usedAt,
      },
    };
  });
}