import { prisma } from "../../lib/prisma";
import { sqlIdentifier as ident } from "../../lib/sql-identifier";
import type { Prisma } from "../../generated/prisma/client";

export const interventionActions = [
  "LOCK_AIRLINE", "UNLOCK_AIRLINE", "LOCK_USER", "UNLOCK_USER",
  "HIDE_FLIGHT", "REOPEN_FLIGHT", "CANCEL_BOOKING_EXCEPTION", "MARK_PAYMENT_REVIEW",
] as const;
export type InterventionAction = typeof interventionActions[number];
export type InterventionInput = { action: InterventionAction; entityId: number; reason: string; requestId: string; actorId: number };

const entityTypes: Record<InterventionAction, string> = {
  LOCK_AIRLINE: "AIRLINE", UNLOCK_AIRLINE: "AIRLINE", LOCK_USER: "USER", UNLOCK_USER: "USER",
  HIDE_FLIGHT: "FLIGHT", REOPEN_FLIGHT: "FLIGHT", CANCEL_BOOKING_EXCEPTION: "BOOKING", MARK_PAYMENT_REVIEW: "PAYMENT",
};

export class InterventionError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

export function parseInterventionInput(value: unknown, requestId: unknown, actorId: number): InterventionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.action !== "string" || !interventionActions.includes(input.action as InterventionAction) ||
      !Number.isSafeInteger(input.entityId) || Number(input.entityId) < 1 ||
      typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.trim().length > 1000 ||
      typeof requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(requestId)) return null;
  return { action: input.action as InterventionAction, entityId: Number(input.entityId), reason: input.reason.trim(), requestId, actorId };
}

export type InterventionResult = { status: "applied" | "already_applied" | "already_processed"; auditLogId?: number };

export async function runAdminIntervention(input: InterventionInput): Promise<InterventionResult> {
  const entityType = entityTypes[input.action];
  const checkPrevious = async () => {
    const previous = await prisma.auditLog.findUnique({ where: { requestId: input.requestId } });
    if (!previous) return null;
    if (previous.actorId !== input.actorId || previous.action !== input.action || previous.entityType !== entityType ||
        previous.entityId !== String(input.entityId) || previous.reason !== input.reason) {
      throw new InterventionError(409, "Mã yêu cầu đã được dùng cho thao tác khác.");
    }
    return { status: "already_processed" as const, auditLogId: previous.id };
  };
  const previous = await checkPrevious();
  if (previous) return previous;

  try {
    return await prisma.$transaction(async tx => {
      let before: Record<string, unknown>;
      let after: Record<string, unknown>;
      const now = new Date();
      if (input.action === "LOCK_AIRLINE" || input.action === "UNLOCK_AIRLINE") {
        const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Airline")} WHERE ${ident("id")} = ${input.entityId} FOR UPDATE`;
        if (!rows.length) throw new InterventionError(404, "Không tìm thấy hãng bay.");
        const airline = await tx.airline.findUniqueOrThrow({ where: { id: input.entityId }, select: { status: true } });
        const status = input.action === "LOCK_AIRLINE" ? "LOCKED" : "ACTIVE";
        if (airline.status === status) return { status: "already_applied" };
        before = { status: airline.status }; after = { status };
        await tx.airline.update({ where: { id: input.entityId }, data: { status } });
        if (status === "LOCKED") await tx.authSession.deleteMany({ where: { user: { airlineId: input.entityId } } });
      } else if (input.action === "LOCK_USER" || input.action === "UNLOCK_USER") {
        // Lock all active admin rows in one order so two admins cannot lock each other as the last admin.
        await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("User")} WHERE ${ident("role")} = 'ADMIN' AND ${ident("status")} = 'ACTIVE' ORDER BY ${ident("id")} FOR UPDATE`;
        const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("User")} WHERE ${ident("id")} = ${input.entityId} FOR UPDATE`;
        if (!rows.length) throw new InterventionError(404, "Không tìm thấy tài khoản.");
        const user = await tx.user.findUniqueOrThrow({ where: { id: input.entityId }, select: { status: true, role: true, airlineId: true } });
        const status = input.action === "LOCK_USER" ? "LOCKED" : "ACTIVE";
        if (user.status === status) return { status: "already_applied" };
        if (status === "LOCKED" && input.actorId === input.entityId) throw new InterventionError(409, "Không thể tự khóa tài khoản admin đang dùng.");
        if (status === "LOCKED" && user.role === "ADMIN" && await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }) <= 1)
          throw new InterventionError(409, "Không thể khóa admin hoạt động cuối cùng.");
        if (status === "ACTIVE" && user.airlineId) {
          const airline = await tx.airline.findUnique({ where: { id: user.airlineId }, select: { status: true } });
          if (airline?.status !== "ACTIVE") throw new InterventionError(409, "Hãng bay đang bị khóa.");
        }
        before = { status: user.status }; after = { status };
        await tx.user.update({ where: { id: input.entityId }, data: { status } });
        if (status === "LOCKED") await tx.authSession.deleteMany({ where: { userId: input.entityId } });
      } else if (input.action === "HIDE_FLIGHT" || input.action === "REOPEN_FLIGHT") {
        const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Flight")} WHERE ${ident("id")} = ${input.entityId} FOR UPDATE`;
        if (!rows.length) throw new InterventionError(404, "Không tìm thấy chuyến bay.");
        const flight = await tx.flight.findUniqueOrThrow({ where: { id: input.entityId }, include: { airline: { select: { status: true } } } });
        const saleStatus = input.action === "HIDE_FLIGHT" ? "HIDDEN" : "ON_SALE";
        if (flight.saleStatus === saleStatus) return { status: "already_applied" };
        if (flight.status !== "SCHEDULED" || flight.departureTime <= now) throw new InterventionError(409, "Chuyến bay không còn hợp lệ để can thiệp bán vé.");
        if (saleStatus === "ON_SALE" && flight.airline.status !== "ACTIVE") throw new InterventionError(409, "Hãng bay đang bị khóa.");
        if (saleStatus === "ON_SALE" && (flight.basePrice < 1 || flight.capacity < 1)) throw new InterventionError(409, "Chuyến bay chưa có số ghế bán ra hoặc giá gốc.");
        const activeBookings = await tx.booking.count({ where: { AND: [
          { OR: [{ flightId: input.entityId }, { returnFlightId: input.entityId }] },
          { OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: now } }] },
        ] } });
        before = { saleStatus: flight.saleStatus, activeBookings }; after = { saleStatus, activeBookings };
        await tx.flight.update({ where: { id: input.entityId }, data: { saleStatus } });
      } else if (input.action === "CANCEL_BOOKING_EXCEPTION") {
        // Payment serializes on Booking; lock it before reading state to avoid a stale snapshot.
        const rows = await tx.$queryRaw<{ flightId: number; returnFlightId: number | null }[]>`SELECT ${ident("flightId")}, ${ident("returnFlightId")} FROM ${ident("Booking")} WHERE ${ident("id")} = ${input.entityId} FOR UPDATE`;
        if (!rows.length) throw new InterventionError(404, "Không tìm thấy booking.");
        for (const flightId of [rows[0].flightId, rows[0].returnFlightId].filter((id): id is number => id !== null).sort((a, b) => a - b)) {
          await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Flight")} WHERE ${ident("id")} = ${flightId} FOR UPDATE`;
        }
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.entityId }, include: { flight: true, returnFlight: true, passengers: { include: { tickets: true } }, payments: true } });
        if (booking.status === "CANCELLED") return { status: "already_applied" };
        if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") throw new InterventionError(409, "Booking không còn hiệu lực để hủy.");
        if (booking.status === "PENDING" && (!booking.expiresAt || booking.expiresAt <= now)) throw new InterventionError(409, "Booking đã hết hạn giữ chỗ.");
        if ([booking.flight, booking.returnFlight].some(flight => flight && (flight.status !== "SCHEDULED" || flight.departureTime <= now))) throw new InterventionError(409, "Chuyến bay đã đến giờ hoặc không còn theo lịch.");
        if (booking.passengers.some(person => person.tickets.some(ticket => ticket.status === "USED"))) throw new InterventionError(409, "Booking đã có vé được sử dụng.");
        const ticketIds = booking.passengers.flatMap(person => person.tickets.filter(ticket => ticket.status === "ISSUED").map(ticket => ticket.id));
        const paidIds = booking.payments.filter(payment => payment.status === "PAID").map(payment => payment.id);
        before = { status: booking.status, ticketIds, paidPaymentIds: paidIds, seatCount: booking.passengers.length };
        after = { status: "CANCELLED", ticketStatus: "CANCELLED", paidPaymentReviewStatus: "NEEDS_REVIEW", seatCountReleased: booking.passengers.length };
        await tx.booking.update({ where: { id: input.entityId }, data: { status: "CANCELLED" } });
        if (ticketIds.length) await tx.ticket.updateMany({ where: { id: { in: ticketIds } }, data: { status: "CANCELLED" } });
        if (paidIds.length) await tx.payment.updateMany({ where: { id: { in: paidIds } }, data: { reviewStatus: "NEEDS_REVIEW" } });
      } else {
        const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Payment")} WHERE ${ident("id")} = ${input.entityId} FOR UPDATE`;
        if (!rows.length) throw new InterventionError(404, "Không tìm thấy thanh toán.");
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.entityId }, select: { reviewStatus: true, status: true, amount: true } });
        if (payment.reviewStatus === "NEEDS_REVIEW") return { status: "already_applied" };
        before = { reviewStatus: payment.reviewStatus, status: payment.status, amount: payment.amount };
        after = { reviewStatus: "NEEDS_REVIEW", status: payment.status, amount: payment.amount };
        await tx.payment.update({ where: { id: input.entityId }, data: { reviewStatus: "NEEDS_REVIEW" } });
      }
      const audit = await tx.auditLog.create({ data: { requestId: input.requestId, actorId: input.actorId, action: input.action,
        entityType, entityId: String(input.entityId), reason: input.reason,
        before: before as Prisma.InputJsonValue, after: after as Prisma.InputJsonValue, result: "SUCCESS" } });
      return { status: "applied", auditLogId: audit.id };
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const retry = await checkPrevious();
      if (retry) return retry;
    }
    throw error;
  }
}
