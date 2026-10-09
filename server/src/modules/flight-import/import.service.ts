import { prisma } from "../../lib/prisma";
import { InvalidImportRequestError } from "./errors";

export type ImportRequest = {
  departureCode: string;
  arrivalCode: string;
  dateText: string;
};

function outboundDateOf(request: ImportRequest): Date {
  const { departureCode, arrivalCode, dateText } = request;
  if (!/^[A-Z]{3}$/.test(departureCode) ||
      !/^[A-Z]{3}$/.test(arrivalCode) ||
      departureCode === arrivalCode ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new InvalidImportRequestError("Cần mã sân bay đi/đến khác nhau và ngày dạng YYYY-MM-DD.");
  }

  const outboundDate = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(outboundDate.getTime()) ||
      outboundDate.toISOString().slice(0, 10) !== dateText) {
    throw new InvalidImportRequestError(`Ngày bay không hợp lệ: ${dateText}`);
  }
  return outboundDate;
}

export async function getImportStatus(request: ImportRequest) {
  const outboundDate = outboundDateOf(request);
  const latest = await prisma.flightSearch.findFirst({
    where: {
      departureCode: request.departureCode,
      arrivalCode: request.arrivalCode,
      outboundDate,
      adults: 1,
      travelClass: 1,
      currency: "VND",
    },
    orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
    select: { id: true, expiresAt: true },
  });

  if (!latest) return { status: "missing" as const };
  return {
    status: latest.expiresAt > new Date() ? "fresh" as const : "expired" as const,
    latestId: latest.id,
  };
}

function vietnamTime(value: string): Date {
  // SerpApi trả giờ địa phương dạng "YYYY-MM-DD HH:mm" cho chuyến nội địa.
  const result = new Date(value.replace(" ", "T") + ":00+07:00");
  if (Number.isNaN(result.getTime())) {
    throw new Error(`Giờ bay không hợp lệ: ${value}`);
  }
  return result;
}

export async function importFlights(request: ImportRequest, confirmed: boolean) {
  // Kiểm tra lại ngay trước khi nhập, vì trạng thái có thể đổi sau lúc admin xem trước.
  const current = await getImportStatus(request);
  if (current.status === "fresh") {
    return { status: "already_fresh" as const, searchId: current.latestId };
  }
  if (!confirmed) {
    return { status: "confirmation_required" as const, reason: current.status };
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("Thiếu SERPAPI_API_KEY trong server/.env");

  const params = new URLSearchParams({
    engine: "google_flights",
    type: "2",
    departure_id: request.departureCode,
    arrival_id: request.arrivalCode,
    outbound_date: request.dateText,
    adults: "1",
    travel_class: "1",
    currency: "VND",
    gl: "vn",
    hl: "vi",
    api_key: apiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  const result: any = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error ?? `SerpApi trả HTTP ${response.status}`);
  }

  const groups: [string, any[]][] = [
    ["best", result.best_flights ?? []],
    ["other", result.other_flights ?? []],
  ];
  const offers = groups.flatMap(([category, items]) =>
    items.map((item, position) => {
      if (!Number.isInteger(item.price) || !Array.isArray(item.flights)) {
        throw new Error("Kết quả SerpApi thiếu giá hoặc danh sách chặng.");
      }
      return {
        category,
        position,
        price: item.price,
        totalDurationMinutes: item.total_duration ?? null,
        segments: {
          create: item.flights.map((flight: any, segmentPosition: number) => ({
            position: segmentPosition,
            flightNumber: flight.flight_number,
            airlineName: flight.airline,
            departureCode: flight.departure_airport.id,
            arrivalCode: flight.arrival_airport.id,
            departureTime: vietnamTime(flight.departure_airport.time),
            arrivalTime: vietnamTime(flight.arrival_airport.time),
            durationMinutes: flight.duration ?? null,
          })),
        },
      };
    }),
  );

  const insights = result.price_insights;
  const saved = await prisma.flightSearch.create({
    data: {
      departureCode: request.departureCode,
      arrivalCode: request.arrivalCode,
      outboundDate: outboundDateOf(request),
      adults: 1,
      travelClass: 1,
      currency: "VND",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lowestPrice: insights?.lowest_price ?? null,
      priceLevel: insights?.price_level ?? null,
      typicalPriceLow: insights?.typical_price_range?.[0] ?? null,
      typicalPriceHigh: insights?.typical_price_range?.[1] ?? null,
      offers: { create: offers },
    },
  });

  return { status: "imported" as const, searchId: saved.id, offerCount: offers.length };
}
