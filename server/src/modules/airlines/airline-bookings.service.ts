import { prisma } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

export type AirlineBookingQuery = {
  page: number; pageSize: number; search: string;
  bookingFromDate?: string; bookingToDate?: string; flightFromDate?: string; flightToDate?: string;
  departureCode?: string; arrivalCode?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  paymentStatus?: "PAID" | "REFUNDED" | "PENDING" | "FAILED" | "NO_PAYMENT";
};

const fields = ["page", "pageSize", "search", "bookingFromDate", "bookingToDate", "flightFromDate", "flightToDate",
  "departureCode", "arrivalCode", "status", "paymentStatus"];
const bookingStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"];
const paymentStatuses = ["PAID", "REFUNDED", "PENDING", "FAILED", "NO_PAYMENT"];
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dayStart = (value: string) => new Date(`${value}T00:00:00+07:00`);
const dateRange = (from?: string, to?: string) => ({
  ...(from ? { gte: dayStart(from) } : {}),
  ...(to ? { lt: new Date(dayStart(to).getTime() + 86400000) } : {}),
});

export function parseAirlineBookingQuery(raw: Record<string, unknown>): AirlineBookingQuery | null {
  if (Object.entries(raw).some(([key, value]) => !fields.includes(key) || typeof value !== "string")) return null;
  const value = raw as Record<string, string | undefined>;
  const page = Number(value.page ?? "1");
  const pageSize = Number(value.pageSize ?? "20");
  const search = (value.search ?? "").trim();
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || search.length > 120) return null;
  for (const key of ["bookingFromDate", "bookingToDate", "flightFromDate", "flightToDate"] as const)
    if (value[key] && !validDate(value[key])) return null;
  if (value.bookingFromDate && value.bookingToDate && value.bookingFromDate > value.bookingToDate ||
      value.flightFromDate && value.flightToDate && value.flightFromDate > value.flightToDate) return null;
  for (const key of ["departureCode", "arrivalCode"] as const)
    if (value[key] && !/^[A-Z]{3}$/.test(value[key])) return null;
  if (value.status && !bookingStatuses.includes(value.status) ||
      value.paymentStatus && !paymentStatuses.includes(value.paymentStatus)) return null;
  return { page, pageSize, search,
    ...(value.bookingFromDate ? { bookingFromDate: value.bookingFromDate } : {}),
    ...(value.bookingToDate ? { bookingToDate: value.bookingToDate } : {}),
    ...(value.flightFromDate ? { flightFromDate: value.flightFromDate } : {}),
    ...(value.flightToDate ? { flightToDate: value.flightToDate } : {}),
    ...(value.departureCode ? { departureCode: value.departureCode } : {}),
    ...(value.arrivalCode ? { arrivalCode: value.arrivalCode } : {}),
    ...(value.status ? { status: value.status as AirlineBookingQuery["status"] } : {}),
    ...(value.paymentStatus ? { paymentStatus: value.paymentStatus as AirlineBookingQuery["paymentStatus"] } : {}),
  };
}

type PaymentState = "PAID" | "REFUNDED" | "PENDING" | "FAILED" | "NO_PAYMENT";
function paymentState(payments: { status: string }[]): PaymentState {
  if (payments.some(item => item.status === "PAID")) return "PAID";
  if (payments.some(item => item.status === "REFUNDED")) return "REFUNDED";
  if (payments.some(item => item.status === "PENDING")) return "PENDING";
  if (payments.some(item => item.status === "FAILED")) return "FAILED";
  return "NO_PAYMENT";
}

function paymentFilter(status: AirlineBookingQuery["paymentStatus"]): Prisma.BookingWhereInput {
  if (!status) return {};
  if (status === "NO_PAYMENT") return { payments: { none: {} } };
  const higher: Record<Exclude<PaymentState, "NO_PAYMENT">, string[]> = {
    PAID: [], REFUNDED: ["PAID"], PENDING: ["PAID", "REFUNDED"], FAILED: ["PAID", "REFUNDED", "PENDING"],
  };
  return { AND: [
    { payments: { some: { status } } },
    ...(higher[status].length ? [{ payments: { none: { status: { in: higher[status] as ("PAID" | "REFUNDED" | "PENDING")[] } } } }] : []),
  ] };
}

export async function listAirlineBookings(airlineId: number, query: AirlineBookingQuery) {
  const flight: Prisma.FlightWhereInput = { airlineId,
    ...(query.departureCode ? { departureCode: query.departureCode } : {}),
    ...(query.arrivalCode ? { arrivalCode: query.arrivalCode } : {}),
    ...(query.flightFromDate || query.flightToDate ? { departureTime: dateRange(query.flightFromDate, query.flightToDate) } : {}),
  };
  const where: Prisma.BookingWhereInput = {
    AND: [{ OR: [{ flight }, { returnFlight: flight }] }, paymentFilter(query.paymentStatus)],
    ...(query.status ? { status: query.status } : {}),
    ...(query.bookingFromDate || query.bookingToDate ? { createdAt: dateRange(query.bookingFromDate, query.bookingToDate) } : {}),
    ...(query.search ? { OR: [
      { bookingCode: { contains: query.search } }, { contactName: { contains: query.search } },
      { contactEmail: { contains: query.search } }, { contactPhone: { contains: query.search } },
      { flight: { flightNumber: { contains: query.search } } },
      { returnFlight: { flightNumber: { contains: query.search } } },
      { passengers: { some: { fullName: { contains: query.search } } } },
    ] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      select: { id: true, bookingCode: true, contactName: true, contactPhone: true, contactEmail: true,
        totalAmount: true, status: true, expiresAt: true, createdAt: true,
        flight: { select: { flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true } },
        returnFlight: { select: { flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true } },
        _count: { select: { passengers: true } }, payments: { select: { status: true } } } }),
  ]);
  return { items: rows.map(({ _count, payments, ...item }) => ({ ...item, passengerCount: _count.passengers,
    paymentStatus: paymentState(payments) })),
    pagination: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) } };
}

export async function getAirlineBooking(airlineId: number, id: number) {
  const row = await prisma.booking.findFirst({ where: { id, OR: [{ flight: { airlineId } }, { returnFlight: { airlineId } }] },
    select: { id: true, bookingCode: true, contactName: true, contactPhone: true, contactEmail: true,
      totalAmount: true, status: true, expiresAt: true, createdAt: true,
      flight: { select: { flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true, arrivalTime: true } },
      returnFlight: { select: { flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true, arrivalTime: true } },
      passengers: { orderBy: { id: "asc" }, select: { id: true, fullName: true, gender: true, dateOfBirth: true,
        nationality: true, tickets: { where: { flight: { airlineId } }, orderBy: { id: "asc" }, select: { flightId: true, ticketCode: true, price: true, status: true, issuedAt: true, usedAt: true, flight: { select: { flightNumber: true } } } } } },
      payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, amount: true, currency: true,
        method: true, status: true, reviewStatus: true, createdAt: true } } } });
  if (!row) return null;
  return { ...row, paymentStatus: paymentState(row.payments) };
}
