import { prisma } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

export const listKinds = ["airlines", "users", "flights", "bookings", "payments", "audit-logs"] as const;
export type ListKind = typeof listKinds[number];
const statusValues = {
  airlines: ["ACTIVE", "LOCKED"], users: ["ACTIVE", "LOCKED"],
  flights: ["SCHEDULED", "BOARDING", "DEPARTED", "COMPLETED", "CANCELLED"],
  bookings: ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"],
  payments: ["PENDING", "PAID", "FAILED", "REFUNDED"], "audit-logs": ["SUCCESS", "FAILED"],
};
const sortFields: Record<ListKind, string[]> = {
  airlines: ["code", "name", "status", "createdAt"],
  users: ["name", "email", "role", "status", "lastLoginAt", "createdAt"],
  flights: ["flightNumber", "departureTime", "basePrice", "status", "saleStatus", "createdAt"],
  bookings: ["bookingCode", "contactName", "totalAmount", "status", "createdAt"],
  payments: ["id", "amount", "status", "reviewStatus", "createdAt"],
  "audit-logs": ["createdAt", "action", "entityType", "result"],
};
const allowedFilters: Record<ListKind, string[]> = {
  airlines: ["status"],
  users: ["role", "airlineId", "status"],
  flights: ["airlineId", "departureCode", "arrivalCode", "departureDate", "status", "saleStatus"],
  bookings: ["airlineId", "status", "departureDate", "fromDate", "toDate"],
  payments: ["airlineId", "status", "reviewStatus", "fromDate", "toDate"],
  "audit-logs": ["actorId", "action", "entityType", "fromDate", "toDate"],
};

export type ReadQuery = {
  page: number; pageSize: number; search: string; sort: string; direction: "asc" | "desc";
  filters: Record<string, string>;
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const numericFilter = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
const dateBounds = (value: string) => ({ gte: new Date(`${value}T00:00:00+07:00`), lt: new Date(new Date(`${value}T00:00:00+07:00`).getTime() + 86400000) });
const createdRange = (filters: Record<string, string>) => ({
  ...(filters.fromDate ? { gte: new Date(`${filters.fromDate}T00:00:00+07:00`) } : {}),
  ...(filters.toDate ? { lt: new Date(new Date(`${filters.toDate}T00:00:00+07:00`).getTime() + 86400000) } : {}),
});

export function parseReadQuery(kind: ListKind, raw: Record<string, unknown>): ReadQuery | null {
  if (Object.entries(raw).some(([key, value]) => !["page", "pageSize", "search", "sort", "direction", ...allowedFilters[kind]].includes(key) || typeof value !== "string")) return null;
  const query = raw as Record<string, string>;
  const page = Number(query.page ?? "1");
  const pageSize = Number(query.pageSize ?? "10");
  const search = (query.search ?? "").trim();
  const sort = query.sort ?? (kind === "airlines" ? "code" : kind === "users" ? "name" : kind === "flights" ? "departureTime" : "createdAt");
  const direction = query.direction ?? "desc";
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      search.length > 120 || !sortFields[kind].includes(sort) || (direction !== "asc" && direction !== "desc")) return null;
  const filters = Object.fromEntries(allowedFilters[kind].filter(key => query[key]).map(key => [key, query[key]]));
  if (Object.entries(filters).some(([key, value]) => {
    if (["fromDate", "toDate", "departureDate"].includes(key)) return !isDate(value);
    if (["airlineId", "actorId"].includes(key)) return !numericFilter(value);
    if (key === "status") return !statusValues[kind].includes(value);
    if (key === "role") return !["ADMIN", "CUSTOMER", "AIRLINE_FLIGHT_MANAGER", "AIRLINE_SALES_MANAGER"].includes(value);
    if (key === "saleStatus") return !["ON_SALE", "HIDDEN"].includes(value);
    if (key === "reviewStatus") return !["NONE", "NEEDS_REVIEW", "RESOLVED"].includes(value);
    if (key === "entityType") return !["AIRLINE", "USER", "FLIGHT", "BOOKING", "PAYMENT"].includes(value);
    if (key === "departureCode" || key === "arrivalCode") return !/^[A-Z]{3}$/.test(value);
    return value.length > 80;
  }) || (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)) return null;
  return { page, pageSize, search, sort, direction, filters };
}

const pagination = (total: number, query: ReadQuery) => ({ page: query.page, pageSize: query.pageSize, total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) });
const pageArgs = (query: ReadQuery) => ({ skip: (query.page - 1) * query.pageSize, take: query.pageSize });
const order = (query: ReadQuery) => [{ [query.sort]: query.direction }, { id: "asc" }] as never;
const maskDocument = (value: string | null) => value ? `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : null;
const maskPhone = (value: string | null) => value ? `${value.slice(0, 3)}${"*".repeat(Math.max(0, value.length - 5))}${value.slice(-2)}` : null;
const iso = (value: Date | null) => value?.toISOString() ?? null;

const flightInclude = {
  airline: { select: { name: true } },
  bookings: { select: { status: true, expiresAt: true, passengers: { select: { id: true } } } },
  returnBookings: { select: { status: true, expiresAt: true, passengers: { select: { id: true } } } },
  _count: { select: { bookings: true } },
} satisfies Prisma.FlightInclude;
const bookingInclude = {
  flight: { select: { flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true, airlineId: true, airline: { select: { name: true } } } },
  passengers: { select: { id: true, fullName: true, documentNumber: true } },
  payments: { select: { id: true, amount: true, status: true, reviewStatus: true } },
} as const;
const paymentInclude = { booking: { select: { bookingCode: true, status: true, flight: { select: { airlineId: true, airline: { select: { name: true } } } } } } } as const;
const auditInclude = { actor: { select: { name: true, role: true } } } as const;

function mapFlight(item: Prisma.FlightGetPayload<{ include: typeof flightInclude }>) {
  const { bookings, returnBookings, _count, airline, ...flight } = item;
  const now = new Date();
  const occupied = [...bookings, ...returnBookings].filter(booking => booking.status === "CONFIRMED" || (booking.status === "PENDING" && booking.expiresAt && booking.expiresAt > now)).reduce((sum, booking) => sum + booking.passengers.length, 0);
  return { ...flight, airlineName: airline.name, availableSeats: Math.max(0, flight.capacity - occupied), bookingCount: _count.bookings + returnBookings.length };
}
function mapBooking(item: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>) {
  const { flight, passengers, payments, ...booking } = item;
  return { ...booking, flightNumber: flight.flightNumber, departureCode: flight.departureCode, arrivalCode: flight.arrivalCode,
    departureTime: flight.departureTime, airlineId: flight.airlineId, airlineName: flight.airline.name,
    contactPhoneMasked: maskPhone(booking.contactPhone), contactPhone: undefined,
    passengers: passengers.map(person => ({ id: person.id, fullName: person.fullName, documentNumberMasked: maskDocument(person.documentNumber) })),
    payments, paymentIds: payments.map(payment => payment.id),
  };
}
function mapPayment(item: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>) {
  const { booking, ...payment } = item;
  return { ...payment, bookingCode: booking.bookingCode, bookingStatus: booking.status, airlineId: booking.flight.airlineId, airlineName: booking.flight.airline.name };
}
function mapAudit(item: Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>) {
  const { actor, ...log } = item;
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /password|token|secret|documentnumber|qrcode/i.test(key) ? "[REDACTED]" : redact(entry)]));
    return value;
  };
  return { ...log, before: redact(log.before), after: redact(log.after), entityId: Number(log.entityId), actorName: actor.name, actorRole: actor.role };
}

export async function listAdminData(kind: ListKind, query: ReadQuery) {
  const f = query.filters;
  const search = query.search;
  const args = pageArgs(query);
  if (kind === "airlines") {
    const where: Prisma.AirlineWhereInput = { ...(f.status ? { status: f.status as "ACTIVE" | "LOCKED" } : {}), ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}) };
    const [total, items] = await Promise.all([prisma.airline.count({ where }), prisma.airline.findMany({ where, ...args, orderBy: order(query), include: { _count: { select: { users: true, flights: { where: { saleStatus: "ON_SALE" } } } } } })]);
    return { items: items.map(({ _count, ...item }) => ({ ...item, staffCount: _count.users, onSaleFlightCount: _count.flights })), pagination: pagination(total, query) };
  }
  if (kind === "users") {
    const where: Prisma.UserWhereInput = { ...(f.role ? { role: f.role as Prisma.EnumUserRoleFilter["equals"] } : {}), ...(f.status ? { status: f.status as "ACTIVE" | "LOCKED" } : {}), ...(f.airlineId ? { airlineId: Number(f.airlineId) } : {}), ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}) };
    const [total, items] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, ...args, orderBy: order(query), select: { id: true, name: true, email: true, role: true, airlineId: true, status: true, lastLoginAt: true, airline: { select: { name: true } } } })]);
    return { items: items.map(({ airline, ...item }) => ({ ...item, airlineName: airline?.name ?? null })), pagination: pagination(total, query) };
  }
  if (kind === "flights") {
    const where: Prisma.FlightWhereInput = { ...(f.airlineId ? { airlineId: Number(f.airlineId) } : {}), ...(f.departureCode ? { departureCode: f.departureCode } : {}), ...(f.arrivalCode ? { arrivalCode: f.arrivalCode } : {}), ...(f.departureDate ? { departureTime: dateBounds(f.departureDate) } : {}), ...(f.status ? { status: f.status as Prisma.EnumFlightStatusFilter["equals"] } : {}), ...(f.saleStatus ? { saleStatus: f.saleStatus as "ON_SALE" | "HIDDEN" } : {}), ...(search ? { OR: [{ flightNumber: { contains: search } }, { airline: { name: { contains: search } } }] } : {}) };
    const [total, items] = await Promise.all([prisma.flight.count({ where }), prisma.flight.findMany({ where, ...args, orderBy: order(query), include: flightInclude })]);
    return { items: items.map(mapFlight), pagination: pagination(total, query) };
  }
  if (kind === "bookings") {
    const where: Prisma.BookingWhereInput = { ...(f.airlineId || f.departureDate ? { flight: { ...(f.airlineId ? { airlineId: Number(f.airlineId) } : {}), ...(f.departureDate ? { departureTime: dateBounds(f.departureDate) } : {}) } } : {}), ...(f.status ? { status: f.status as Prisma.EnumBookingStatusFilter["equals"] } : {}), ...(f.fromDate || f.toDate ? { createdAt: createdRange(f) } : {}), ...(search ? { OR: [{ bookingCode: { contains: search } }, { contactName: { contains: search } }, { flight: { flightNumber: { contains: search } } }] } : {}) };
    const [total, items] = await Promise.all([prisma.booking.count({ where }), prisma.booking.findMany({ where, ...args, orderBy: order(query), include: bookingInclude })]);
    return { items: items.map(mapBooking), pagination: pagination(total, query) };
  }
  if (kind === "payments") {
    const where: Prisma.PaymentWhereInput = { ...(f.airlineId ? { booking: { flight: { airlineId: Number(f.airlineId) } } } : {}), ...(f.status ? { status: f.status as Prisma.EnumPaymentStatusFilter["equals"] } : {}), ...(f.reviewStatus ? { reviewStatus: f.reviewStatus as "NONE" | "NEEDS_REVIEW" | "RESOLVED" } : {}), ...(f.fromDate || f.toDate ? { createdAt: createdRange(f) } : {}), ...(search ? { OR: [{ providerTransactionId: { contains: search } }, { booking: { bookingCode: { contains: search } } }, ...(numericFilter(search) ? [{ id: Number(search) }] : [])] } : {}) };
    const [total, items] = await Promise.all([prisma.payment.count({ where }), prisma.payment.findMany({ where, ...args, orderBy: order(query), include: paymentInclude })]);
    return { items: items.map(mapPayment), pagination: pagination(total, query) };
  }
  const where: Prisma.AuditLogWhereInput = { ...(f.actorId ? { actorId: Number(f.actorId) } : {}), ...(f.action ? { action: f.action } : {}), ...(f.entityType ? { entityType: f.entityType } : {}), ...(f.fromDate || f.toDate ? { createdAt: createdRange(f) } : {}), ...(search ? { OR: [{ reason: { contains: search } }, { actor: { name: { contains: search } } }, { action: { contains: search } }] } : {}) };
  const [total, items] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, ...args, orderBy: order(query), include: auditInclude })]);
  return { items: items.map(mapAudit), pagination: pagination(total, query) };
}

export async function getAdminDetail(kind: ListKind, id: number) {
  const withAudit = async <T extends object>(item: T | null) => {
    if (!item) return null;
    const entityType = ({ airlines: "AIRLINE", users: "USER", flights: "FLIGHT", bookings: "BOOKING", payments: "PAYMENT" } as Partial<Record<ListKind, string>>)[kind];
    if (!entityType) return item;
    const auditTrail = await prisma.auditLog.findMany({ where: { entityType, entityId: String(id) }, include: auditInclude, orderBy: { createdAt: "desc" }, take: 20 });
    return { ...item, auditTrail: auditTrail.map(mapAudit) };
  };
  if (kind === "airlines") {
    const item = await prisma.airline.findUnique({ where: { id }, include: { users: { select: { id: true, name: true, role: true, status: true }, take: 20 }, flights: { select: { id: true, flightNumber: true, saleStatus: true }, take: 20 }, _count: { select: { users: true, flights: { where: { saleStatus: "ON_SALE" } } } } } });
    return withAudit(item && { ...item, staffCount: item._count.users, onSaleFlightCount: item._count.flights });
  }
  if (kind === "users") {
    const item = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true, status: true, airlineId: true, lastLoginAt: true, createdAt: true, airline: { select: { name: true, status: true } } } });
    if (!item) return null;
    const activeAdminCount = item.role === "ADMIN" ? await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }) : null;
    return withAudit({ ...item, airlineName: item.airline?.name ?? null, airlineStatus: item.airline?.status ?? null, activeAdminCount });
  }
  if (kind === "flights") {
    const item = await prisma.flight.findUnique({ where: { id }, include: { airline: { select: { name: true, status: true } }, bookings: { select: { bookingCode: true, status: true, expiresAt: true, passengers: { select: { id: true } } } }, returnBookings: { select: { bookingCode: true, status: true, expiresAt: true, passengers: { select: { id: true } } } }, _count: { select: { bookings: true } } } });
    if (!item) return null;
    const now = new Date();
    const allBookings = [...item.bookings, ...item.returnBookings];
    const occupied = allBookings.filter(booking => booking.status === "CONFIRMED" || (booking.status === "PENDING" && booking.expiresAt && booking.expiresAt > now)).reduce((sum, booking) => sum + booking.passengers.length, 0);
    const { bookings, returnBookings, airline, _count, ...flight } = item;
    const activeBookingCount = allBookings.filter(booking => booking.status === "CONFIRMED" || (booking.status === "PENDING" && booking.expiresAt && booking.expiresAt > now)).length;
    return withAudit({ ...flight, airlineName: airline.name, airlineStatus: airline.status, availableSeats: Math.max(0, flight.capacity - occupied), bookingCount: _count.bookings + returnBookings.length, activeBookingCount, bookings: allBookings.slice(0, 30).map(({ passengers, ...booking }) => booking) });
  }
  if (kind === "bookings") {
    const item = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
    if (!item) return null;
    const [flight, ticketStatuses] = await Promise.all([
      prisma.flight.findUnique({ where: { id: item.flightId }, select: { status: true } }),
      prisma.ticket.findMany({ where: { passenger: { bookingId: id } }, select: { status: true } }),
    ]);
    return withAudit({ ...mapBooking(item), flightStatus: flight?.status, hasUsedTicket: ticketStatuses.some(ticket => ticket.status === "USED") });
  }
  if (kind === "payments") {
    const item = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
    return withAudit(item && mapPayment(item));
  }
  const item = await prisma.auditLog.findUnique({ where: { id }, include: auditInclude });
  return item && mapAudit(item);
}

export async function getAdminOptions() {
  const [airlines, airports, admins, actions] = await Promise.all([
    prisma.airline.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.flight.findMany({ select: { departureCode: true, arrivalCode: true }, distinct: ["departureCode", "arrivalCode"] }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ select: { action: true }, distinct: ["action"] }),
  ]);
  return { airlines, airports: [...new Set(airports.flatMap(item => [item.departureCode, item.arrivalCode]))].sort(), admins, actions: actions.map(item => item.action) };
}

export async function getAdminOverview(fromDate?: string, toDate?: string) {
  if ((fromDate && !isDate(fromDate)) || (toDate && !isDate(toDate)) || (fromDate && toDate && fromDate > toDate)) return null;
  const range = createdRange({ ...(fromDate ? { fromDate } : {}), ...(toDate ? { toDate } : {}) });
  const [activeAirlines, activeUsers, lockedUsers, onSaleFlights, hiddenFlights, bookings, paid, failedPayments, needsReviewPayments] = await Promise.all([
    prisma.airline.count({ where: { status: "ACTIVE" } }), prisma.user.count({ where: { status: "ACTIVE" } }), prisma.user.count({ where: { status: "LOCKED" } }),
    prisma.flight.count({ where: { saleStatus: "ON_SALE" } }), prisma.flight.count({ where: { saleStatus: "HIDDEN" } }),
    prisma.booking.groupBy({ by: ["status"], where: { createdAt: range }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: "PAID", createdAt: range }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: range } }), prisma.payment.count({ where: { reviewStatus: "NEEDS_REVIEW", createdAt: range } }),
  ]);
  return { activeAirlines, activeUsers, lockedUsers, onSaleFlights, hiddenFlights,
    bookingsByStatus: Object.fromEntries(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"].map(status => [status, bookings.find(item => item.status === status)?._count._all ?? 0])),
    simulatedPaidAmount: paid._sum.amount ?? 0, failedPayments, needsReviewPayments };
}
