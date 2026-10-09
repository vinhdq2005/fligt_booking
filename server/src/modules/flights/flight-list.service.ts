import { prisma } from "../../lib/prisma";

export type FlightFilters = {
  from?: string;
  to?: string;
  date?: string;
  status: "all" | "fresh" | "expired";
  page: number;
  pageSize: number;
};

export async function listFlights(filters: FlightFilters) {
  const now = new Date();
  const searchWhere = {
    ...(filters.from ? { departureCode: filters.from } : {}),
    ...(filters.to ? { arrivalCode: filters.to } : {}),
    ...(filters.date ? { outboundDate: new Date(`${filters.date}T00:00:00.000Z`) } : {}),
  };
  const withStatus = (status: "all" | "fresh" | "expired") => ({
    search: {
      is: {
        ...searchWhere,
        ...(status === "fresh" ? { expiresAt: { gt: now } } : {}),
        ...(status === "expired" ? { expiresAt: { lte: now } } : {}),
      },
    },
  });

  const [total, freshTotal, expiredTotal, offers] = await Promise.all([
    prisma.flightOffer.count({ where: withStatus(filters.status) }),
    prisma.flightOffer.count({ where: withStatus("fresh") }),
    prisma.flightOffer.count({ where: withStatus("expired") }),
    prisma.flightOffer.findMany({
      where: withStatus(filters.status),
      include: {
        search: true,
        segments: { orderBy: { position: "asc" } },
      },
      orderBy: { id: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return {
    items: offers.map((offer) => ({
      id: offer.id,
      searchId: offer.searchId,
      category: offer.category,
      price: offer.price,
      currency: offer.search.currency,
      totalDurationMinutes: offer.totalDurationMinutes,
      departureCode: offer.search.departureCode,
      arrivalCode: offer.search.arrivalCode,
      outboundDate: offer.search.outboundDate,
      fetchedAt: offer.search.fetchedAt,
      expiresAt: offer.search.expiresAt,
      status: offer.search.expiresAt > now ? "fresh" : "expired",
      segments: offer.segments.map((segment) => ({
        id: segment.id,
        position: segment.position,
        flightNumber: segment.flightNumber,
        airlineName: segment.airlineName,
        departureCode: segment.departureCode,
        arrivalCode: segment.arrivalCode,
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
        durationMinutes: segment.durationMinutes,
      })),
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      pageCount: Math.ceil(total / filters.pageSize),
    },
    summary: { fresh: freshTotal, expired: expiredTotal, total: freshTotal + expiredTotal },
  };
}
