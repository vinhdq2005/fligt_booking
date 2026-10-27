import { prisma } from "../../lib/prisma";
import { sqlIdentifier as ident } from "../../lib/sql-identifier";
import type { Prisma } from "../../generated/prisma/client";
import { calculateCurrentPrice } from "../flights/pricing.service";

export class AirlineWorkspaceError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

export type AirlineWorkspaceQuery = {
  page: number; pageSize: number; search: string; sort: "departureTime" | "flightNumber" | "capacity" | "basePrice" | "status" | "saleStatus" | "createdAt";
  direction: "asc" | "desc"; departureCode?: string; arrivalCode?: string; departureDate?: string;
  fromDate?: string; toDate?: string; status?: "SCHEDULED" | "BOARDING" | "DEPARTED" | "COMPLETED" | "CANCELLED";
  saleStatus?: "ON_SALE" | "HIDDEN"; salesStage?: "AWAITING_SALE";
};

const sortFields = ["departureTime", "flightNumber", "capacity", "basePrice", "status", "saleStatus", "createdAt"];
const statuses = ["SCHEDULED", "BOARDING", "DEPARTED", "COMPLETED", "CANCELLED"];
const queryFields = ["page", "pageSize", "search", "sort", "direction", "departureCode", "arrivalCode", "departureDate", "fromDate", "toDate", "status", "saleStatus", "salesStage"];
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dateBounds = (value: string) => ({ gte: new Date(`${value}T00:00:00Z`), lt: new Date(new Date(`${value}T00:00:00Z`).getTime() + 86400000) });

export function parseAirlineWorkspaceQuery(raw: Record<string, unknown>): AirlineWorkspaceQuery | null {
  if (Object.entries(raw).some(([key, value]) => !queryFields.includes(key) || typeof value !== "string")) return null;
  const value = raw as Record<string, string | undefined>;
  const page = Number(value.page ?? "1");
  const pageSize = Number(value.pageSize ?? "20");
  const search = (value.search ?? "").trim();
  const sort = value.sort ?? "departureTime";
  const direction = value.direction ?? "asc";
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      search.length > 120 || !sortFields.includes(sort) || (direction !== "asc" && direction !== "desc")) return null;
  for (const key of ["departureCode", "arrivalCode"] as const) if (value[key] && !/^[A-Z]{3}$/.test(value[key])) return null;
  for (const key of ["departureDate", "fromDate", "toDate"] as const) if (value[key] && !validDate(value[key])) return null;
  if (value.fromDate && value.toDate && value.fromDate > value.toDate) return null;
  if (value.status && !statuses.includes(value.status)) return null;
  if (value.saleStatus && value.saleStatus !== "ON_SALE" && value.saleStatus !== "HIDDEN") return null;
  if (value.salesStage && value.salesStage !== "AWAITING_SALE") return null;
  return { page, pageSize, search, sort: sort as AirlineWorkspaceQuery["sort"], direction,
    ...(value.departureCode ? { departureCode: value.departureCode } : {}),
    ...(value.arrivalCode ? { arrivalCode: value.arrivalCode } : {}),
    ...(value.departureDate ? { departureDate: value.departureDate } : {}),
    ...(value.fromDate ? { fromDate: value.fromDate } : {}), ...(value.toDate ? { toDate: value.toDate } : {}),
    ...(value.status ? { status: value.status as AirlineWorkspaceQuery["status"] } : {}),
    ...(value.saleStatus ? { saleStatus: value.saleStatus as AirlineWorkspaceQuery["saleStatus"] } : {}),
    ...(value.salesStage ? { salesStage: value.salesStage as AirlineWorkspaceQuery["salesStage"] } : {}) };
}

const defaultQuery: AirlineWorkspaceQuery = { page: 1, pageSize: 20, search: "", sort: "departureTime", direction: "asc" };

export async function getAirlineWorkspace(airlineId: number, query: AirlineWorkspaceQuery = defaultQuery) {
  const now = new Date();
  const starts = [query.departureDate, query.fromDate].filter((value): value is string => Boolean(value)).map(value => dateBounds(value).gte);
  const ends = [query.departureDate, query.toDate].filter((value): value is string => Boolean(value)).map(value => dateBounds(value).lt);
  const departureTime = starts.length || ends.length ? {
    ...(starts.length ? { gte: new Date(Math.max(...starts.map(value => value.getTime()))) } : {}),
    ...(ends.length ? { lt: new Date(Math.min(...ends.map(value => value.getTime()))) } : {}),
  } : undefined;
  const where: Prisma.FlightWhereInput = { airlineId,
    ...(query.departureCode ? { departureCode: query.departureCode } : {}),
    ...(query.arrivalCode ? { arrivalCode: query.arrivalCode } : {}),
    ...(departureTime ? { departureTime } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.saleStatus ? { saleStatus: query.saleStatus } : {}),
    ...(query.search ? { OR: [{ flightNumber: { contains: query.search } }, { departureCode: { contains: query.search } }, { arrivalCode: { contains: query.search } }] } : {}),
    ...(query.salesStage === "AWAITING_SALE" ? { AND: [{ saleStatus: "HIDDEN", status: "SCHEDULED", departureTime: { gt: now } }] } : {}) };
  const [airline, total, onSaleFlights, capacity, confirmedSeats, revenue, flights] = await Promise.all([
    prisma.airline.findUnique({ where: { id: airlineId }, select: { id: true, code: true, name: true, status: true } }),
    prisma.flight.count({ where }), prisma.flight.count({ where: { AND: [where, { saleStatus: "ON_SALE" }] } }),
    prisma.flight.aggregate({ where, _sum: { capacity: true } }),
    prisma.ticket.count({ where: { status: { in: ["ISSUED", "USED"] }, flight: where } }),
    prisma.payment.aggregate({ where: { status: "PAID", booking: { flight: where } }, _sum: { amount: true } }),
    prisma.flight.findMany({ where, orderBy: [{ [query.sort]: query.direction }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      include: { bookings: { select: { status: true, expiresAt: true, passengers: { select: { id: true } },
        payments: { where: { status: "PAID" }, select: { amount: true } } } },
        returnBookings: { select: { status: true, expiresAt: true, passengers: { select: { id: true } } } } } }),
  ]);
  if (!airline) throw new AirlineWorkspaceError(404, "Không tìm thấy hãng bay.");
  const items = flights.map(flight => {
    const allBookings = [...flight.bookings, ...flight.returnBookings];
    const confirmedBookings = allBookings.filter(booking => booking.status === "CONFIRMED");
    const soldSeats = confirmedBookings.reduce((sum, booking) => sum + booking.passengers.length, 0);
    const heldSeats = allBookings.filter(booking => booking.status === "PENDING" && booking.expiresAt && booking.expiresAt > now)
      .reduce((sum, booking) => sum + booking.passengers.length, 0);
    const simulatedRevenue = flight.bookings.flatMap(booking => booking.payments).reduce((sum, payment) => sum + payment.amount, 0);
    const currentPrice = flight.status === "SCHEDULED" && flight.departureTime > now && flight.basePrice > 0 && flight.capacity > 0
      ? calculateCurrentPrice({ basePrice: flight.basePrice, departureTime: flight.departureTime, capacity: flight.capacity,
        confirmedPassengers: soldSeats, now }).currentPrice : null;
    return { id: flight.id, flightNumber: flight.flightNumber, departureCode: flight.departureCode, arrivalCode: flight.arrivalCode,
      departureTime: flight.departureTime, arrivalTime: flight.arrivalTime, capacity: flight.capacity, basePrice: flight.basePrice,
      status: flight.status, saleStatus: flight.saleStatus, createdAt: flight.createdAt, confirmedSeats: soldSeats, heldSeats,
      availableSeats: Math.max(0, flight.capacity - soldSeats - heldSeats),
      occupancyPercent: flight.capacity ? Number((soldSeats / flight.capacity * 100).toFixed(2)) : 0,
      confirmedBookings: confirmedBookings.length, simulatedRevenue, currentPrice };
  });
  return { airline, items, pagination: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) },
    summary: { flights: total, onSaleFlights, confirmedSeats, capacity: capacity._sum.capacity ?? 0, simulatedRevenue: revenue._sum.amount ?? 0 } };
}

export async function setAirlineSalesSettings(input: { airlineId: number; flightId: number; actorId: number; capacity: number; basePrice: number }) {
  if (!Number.isSafeInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000 ||
      !Number.isSafeInteger(input.basePrice) || input.basePrice < 1000 || input.basePrice > 1_000_000_000)
    throw new AirlineWorkspaceError(400, "Số ghế phải từ 1–10.000 và giá gốc từ 1.000–1.000.000.000 VND.");
  return prisma.$transaction(async tx => {
    const airline = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Airline")} WHERE ${ident("id")} = ${input.airlineId} AND ${ident("status")} = 'ACTIVE' FOR UPDATE`;
    if (!airline.length) throw new AirlineWorkspaceError(409, "Hãng bay đang bị khóa.");
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Flight")} WHERE ${ident("id")} = ${input.flightId} AND ${ident("airlineId")} = ${input.airlineId} FOR UPDATE`;
    if (!rows.length) throw new AirlineWorkspaceError(404, "Không tìm thấy chuyến bay của hãng.");
    const flight = await tx.flight.findUniqueOrThrow({ where: { id: input.flightId } });
    if (flight.status !== "SCHEDULED" || flight.departureTime <= new Date()) throw new AirlineWorkspaceError(409, "Chuyến không còn hợp lệ để đặt số ghế và giá.");
    const occupied = await tx.passenger.count({ where: { booking: {
      AND: [{ OR: [{ flightId: input.flightId }, { returnFlightId: input.flightId }] },
        { OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: new Date() } }] }],
    } } });
    if (input.capacity < occupied) throw new AirlineWorkspaceError(409, `Số ghế bán ra không thể nhỏ hơn ${occupied} chỗ đã bán/đang giữ.`);
    await tx.flight.update({ where: { id: input.flightId }, data: { capacity: input.capacity, basePrice: input.basePrice } });
    // Retire any rules saved by the previous UI; pricing now follows calculateCurrentPrice only.
    await tx.pricingRule.deleteMany({ where: { flightId: input.flightId } });
    await tx.auditLog.create({ data: { actorId: input.actorId, action: "SET_AIRLINE_SALES", entityType: "FLIGHT", entityId: String(input.flightId),
      before: { capacity: flight.capacity, basePrice: flight.basePrice }, after: { capacity: input.capacity, basePrice: input.basePrice }, result: "SUCCESS" } });
    return { flightId: input.flightId, capacity: input.capacity, basePrice: input.basePrice };
  });
}

export async function setAirlineSaleStatus(input: { airlineId: number; flightId: number; actorId: number; saleStatus: "ON_SALE" | "HIDDEN" }) {
  return prisma.$transaction(async tx => {
    const airline = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Airline")} WHERE ${ident("id")} = ${input.airlineId} AND ${ident("status")} = 'ACTIVE' FOR UPDATE`;
    if (!airline.length) throw new AirlineWorkspaceError(409, "Hãng bay đang bị khóa.");
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT ${ident("id")} FROM ${ident("Flight")} WHERE ${ident("id")} = ${input.flightId} AND ${ident("airlineId")} = ${input.airlineId} FOR UPDATE`;
    if (!rows.length) throw new AirlineWorkspaceError(404, "Không tìm thấy chuyến bay của hãng.");
    const flight = await tx.flight.findUniqueOrThrow({ where: { id: input.flightId } });
    if (flight.saleStatus === input.saleStatus) return { status: "already_applied" as const };
    if (flight.status !== "SCHEDULED" || flight.departureTime <= new Date()) throw new AirlineWorkspaceError(409, "Chuyến không còn hợp lệ để thay đổi mở bán.");
    if (input.saleStatus === "ON_SALE") {
      if (flight.capacity < 1 || flight.basePrice < 1000) throw new AirlineWorkspaceError(409, "Cần đặt số ghế bán ra và giá gốc trước khi mở bán.");
      const lastAdminAction = await tx.auditLog.findFirst({ where: { entityType: "FLIGHT", entityId: String(input.flightId), action: { in: ["HIDE_FLIGHT", "REOPEN_FLIGHT"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (lastAdminAction?.action === "HIDE_FLIGHT") throw new AirlineWorkspaceError(409, "Admin đang tạm ẩn chuyến. Cần admin mở lại trước.");
    }
    await tx.flight.update({ where: { id: input.flightId }, data: { saleStatus: input.saleStatus } });
    await tx.auditLog.create({ data: { actorId: input.actorId, action: input.saleStatus === "ON_SALE" ? "PUBLISH_AIRLINE_FLIGHT" : "PAUSE_AIRLINE_SALES",
      entityType: "FLIGHT", entityId: String(input.flightId), before: { saleStatus: flight.saleStatus }, after: { saleStatus: input.saleStatus }, result: "SUCCESS" } });
    return { status: "applied" as const };
  });
}
