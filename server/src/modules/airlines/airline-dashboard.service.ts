import { prisma } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

export type AirlineDashboardQuery = {
  fromDate?: string; toDate?: string; departureCode?: string; arrivalCode?: string;
  flightNumber?: string; flightId?: number; status?: "SCHEDULED" | "BOARDING" | "DEPARTED" | "COMPLETED" | "CANCELLED";
  saleStatus?: "ON_SALE" | "HIDDEN";
};

const fields = ["fromDate", "toDate", "departureCode", "arrivalCode", "flightNumber", "flightId", "status", "saleStatus"];
const statuses = ["SCHEDULED", "BOARDING", "DEPARTED", "COMPLETED", "CANCELLED"];
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const localDay = (value: Date) => new Date(value.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const startOfDay = (value: string) => new Date(`${value}T00:00:00+07:00`);

export function parseAirlineDashboardQuery(raw: Record<string, unknown>): AirlineDashboardQuery | null {
  if (Object.entries(raw).some(([key, value]) => !fields.includes(key) || typeof value !== "string")) return null;
  const value = raw as Record<string, string | undefined>;
  if (value.fromDate && !validDate(value.fromDate) || value.toDate && !validDate(value.toDate) ||
      value.fromDate && value.toDate && value.fromDate > value.toDate) return null;
  if (value.departureCode && !/^[A-Z]{3}$/.test(value.departureCode) ||
      value.arrivalCode && !/^[A-Z]{3}$/.test(value.arrivalCode)) return null;
  if (value.flightNumber && value.flightNumber.trim().length > 20 ||
      value.flightId && (!Number.isSafeInteger(Number(value.flightId)) || Number(value.flightId) < 1) ||
      value.status && !statuses.includes(value.status) ||
      value.saleStatus && value.saleStatus !== "ON_SALE" && value.saleStatus !== "HIDDEN") return null;
  return {
    ...(value.fromDate ? { fromDate: value.fromDate } : {}), ...(value.toDate ? { toDate: value.toDate } : {}),
    ...(value.departureCode ? { departureCode: value.departureCode } : {}),
    ...(value.arrivalCode ? { arrivalCode: value.arrivalCode } : {}),
    ...(value.flightNumber?.trim() ? { flightNumber: value.flightNumber.trim() } : {}),
    ...(value.flightId ? { flightId: Number(value.flightId) } : {}),
    ...(value.status ? { status: value.status as AirlineDashboardQuery["status"] } : {}),
    ...(value.saleStatus ? { saleStatus: value.saleStatus as AirlineDashboardQuery["saleStatus"] } : {}),
  };
}

type Metrics = { ticketsSold: number; paidBookings: number; revenue: number };
const emptyMetrics = (): Metrics => ({ ticketsSold: 0, paidBookings: 0, revenue: 0 });
const addMetrics = (target: Metrics, source: Metrics) => {
  target.ticketsSold += source.ticketsSold;
  target.paidBookings += source.paidBookings;
  target.revenue += source.revenue;
};

export async function getAirlineDashboard(airlineId: number, query: AirlineDashboardQuery) {
  const where: Prisma.FlightWhereInput = {
    airlineId,
    ...(query.flightId ? { id: query.flightId } : {}),
    ...(query.flightNumber ? { flightNumber: { contains: query.flightNumber } } : {}),
    ...(query.departureCode ? { departureCode: query.departureCode } : {}),
    ...(query.arrivalCode ? { arrivalCode: query.arrivalCode } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.saleStatus ? { saleStatus: query.saleStatus } : {}),
    ...(query.fromDate || query.toDate ? { departureTime: {
      ...(query.fromDate ? { gte: startOfDay(query.fromDate) } : {}),
      ...(query.toDate ? { lt: new Date(startOfDay(query.toDate).getTime() + 86400000) } : {}),
    } } : {}),
  };
  const flights = await prisma.flight.findMany({ where, orderBy: [{ departureTime: "desc" }, { id: "desc" }],
    select: { id: true, flightNumber: true, departureCode: true, arrivalCode: true, departureTime: true,
      capacity: true, basePrice: true, status: true, saleStatus: true } });
  const ids = flights.map(flight => flight.id);
  const [tickets, payments] = ids.length ? await Promise.all([
    prisma.ticket.findMany({ where: { flightId: { in: ids }, status: { in: ["ISSUED", "USED"] } },
      select: { flightId: true, issuedAt: true } }),
    prisma.payment.findMany({ where: { status: "PAID", booking: { passengers: { some: { tickets: { some: { flightId: { in: ids } } } } } } },
      select: { bookingId: true, amount: true, createdAt: true,
        booking: { select: { passengers: { select: { tickets: { select: { flightId: true, price: true } } } } } } } }),
  ]) : [[], []];

  const byFlight = new Map<number, Metrics>(ids.map(id => [id, emptyMetrics()]));
  const salesByFlight = new Map<number, Map<string, Metrics>>();
  const saleDay = (flightId: number, date: Date) => {
    let days = salesByFlight.get(flightId);
    if (!days) { days = new Map(); salesByFlight.set(flightId, days); }
    const key = localDay(date);
    let metrics = days.get(key);
    if (!metrics) { metrics = emptyMetrics(); days.set(key, metrics); }
    return metrics;
  };
  for (const ticket of tickets) {
    const flightId = ticket.flightId;
    byFlight.get(flightId)!.ticketsSold++;
    saleDay(flightId, ticket.issuedAt).ticketsSold++;
  }
  const bookingIdsByFlight = new Map<number, Set<number>>();
  const paidBookingIds = new Set<number>();
  for (const payment of payments) {
    const values = new Map<number, number>();
    for (const passenger of payment.booking.passengers) {
      for (const ticket of passenger.tickets) {
        values.set(ticket.flightId, (values.get(ticket.flightId) ?? 0) + ticket.price);
      }
    }
    const totalValue = [...values.values()].reduce((sum, value) => sum + value, 0);
    if (!totalValue && payment.amount !== 0) continue;
    const flightValues = [...values].sort(([a], [b]) => a - b);
    let allocated = 0;
    for (const [index, [flightId, value]] of flightValues.entries()) {
      const amount = index === flightValues.length - 1
        ? payment.amount - allocated
        : totalValue ? Number(BigInt(payment.amount) * BigInt(value) / BigInt(totalValue)) : 0;
      allocated += amount;
      const metrics = byFlight.get(flightId);
      if (!metrics) continue;
      metrics.revenue += amount;
      const day = saleDay(flightId, payment.createdAt);
      day.revenue += amount;
      let bookingIds = bookingIdsByFlight.get(flightId);
      if (!bookingIds) { bookingIds = new Set(); bookingIdsByFlight.set(flightId, bookingIds); }
      if (!bookingIds.has(payment.bookingId)) {
        bookingIds.add(payment.bookingId);
        paidBookingIds.add(payment.bookingId);
        metrics.paidBookings++;
        day.paidBookings++;
      }
    }
  }

  const departureDays = new Map<string, Metrics>();
  const departureBookingIds = new Map<string, Set<number>>();
  const routes = new Map<string, Metrics & { departureCode: string; arrivalCode: string; flights: number }>();
  const routeBookingIds = new Map<string, Set<number>>();
  const summary = { ...emptyMetrics(), flights: flights.length, onSaleFlights: 0, capacity: 0, occupancyPercent: 0 };
  const items = flights.map(flight => {
    const metrics = byFlight.get(flight.id)!;
    const day = localDay(flight.departureTime);
    const dayMetrics = departureDays.get(day) ?? emptyMetrics();
    addMetrics(dayMetrics, metrics);
    departureDays.set(day, dayMetrics);
    const dayBookings = departureBookingIds.get(day) ?? new Set<number>();
    for (const id of bookingIdsByFlight.get(flight.id) ?? []) dayBookings.add(id);
    departureBookingIds.set(day, dayBookings);
    const routeKey = `${flight.departureCode}-${flight.arrivalCode}`;
    const route = routes.get(routeKey) ?? { ...emptyMetrics(), departureCode: flight.departureCode,
      arrivalCode: flight.arrivalCode, flights: 0 };
    addMetrics(route, metrics);
    route.flights++;
    routes.set(routeKey, route);
    const routeBookings = routeBookingIds.get(routeKey) ?? new Set<number>();
    for (const id of bookingIdsByFlight.get(flight.id) ?? []) routeBookings.add(id);
    routeBookingIds.set(routeKey, routeBookings);
    addMetrics(summary, metrics);
    summary.capacity += flight.capacity;
    if (flight.saleStatus === "ON_SALE") summary.onSaleFlights++;
    return { ...flight, ...metrics, occupancyPercent: flight.capacity ? Number((metrics.ticketsSold / flight.capacity * 100).toFixed(2)) : 0 };
  });
  summary.paidBookings = paidBookingIds.size;
  for (const [day, metrics] of departureDays) metrics.paidBookings = departureBookingIds.get(day)!.size;
  for (const [routeKey, metrics] of routes) metrics.paidBookings = routeBookingIds.get(routeKey)!.size;
  summary.occupancyPercent = summary.capacity ? Number((summary.ticketsSold / summary.capacity * 100).toFixed(2)) : 0;
  return { summary, flights: items,
    departureSeries: [...departureDays].sort(([a], [b]) => a.localeCompare(b)).map(([date, metrics]) => ({ date, ...metrics })),
    routes: [...routes.values()].sort((a, b) => b.revenue - a.revenue || b.ticketsSold - a.ticketsSold),
    salesSeriesByFlight: Object.fromEntries([...salesByFlight].map(([id, days]) => [id,
      [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, metrics]) => ({ date, ...metrics }))])),
  };
}
