import { prisma } from "../../lib/prisma";

export async function listAirportCodes(): Promise<string[]> {
  const [departures, arrivals] = await Promise.all([
    prisma.flight.findMany({ distinct: ["departureCode"], select: { departureCode: true } }),
    prisma.flight.findMany({ distinct: ["arrivalCode"], select: { arrivalCode: true } }),
  ]);

  return [...new Set([
    ...departures.map(({ departureCode }) => departureCode),
    ...arrivals.map(({ arrivalCode }) => arrivalCode),
  ])].sort();
}
