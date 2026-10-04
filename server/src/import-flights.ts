import "dotenv/config";
import { prisma } from "./lib/prisma";

function vietnamTime(value: string): Date {
  // SerpApi trả giờ địa phương dạng "YYYY-MM-DD HH:mm".
  // MVP chỉ lấy chuyến nội địa Việt Nam (UTC+7).
  const result = new Date(value.replace(" ", "T") + ":00+07:00");
  if (Number.isNaN(result.getTime())) {
    throw new Error(`Giờ bay không hợp lệ: ${value}`);
  }
  return result;
}

async function main() {
  const [departureCode, arrivalCode, dateText] = process.argv.slice(2);
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) throw new Error("Thiếu SERPAPI_API_KEY trong server/.env");
  if (!/^[A-Z]{3}$/.test(departureCode ?? "") ||
      !/^[A-Z]{3}$/.test(arrivalCode ?? "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateText ?? "")) {
    throw new Error("Cách dùng: npx tsx src/import-flights.ts HAN SGN YYYY-MM-DD");
  }

  const outboundDate = new Date(`${dateText}T00:00:00.000Z`);

  // Đã có dữ liệu còn hạn thì không gọi SerpApi lần nữa.
  const cached = await prisma.flightSearch.findFirst({
    where: {
      departureCode,
      arrivalCode,
      outboundDate,
      adults: 1,
      travelClass: 1,
      currency: "VND",
    },
    orderBy: { fetchedAt: "desc" },
  });

  if (cached) {
    console.log(`Đã có dữ liệu, search ID: ${cached.id}. Không gọi SerpApi.`);
    return;
  }

  const params = new URLSearchParams({
    engine: "google_flights",
    type: "2",
    departure_id: departureCode,
    arrival_id: arrivalCode,
    outbound_date: dateText,
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
      departureCode,
      arrivalCode,
      outboundDate,
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

  console.log(`Đã lưu search ID ${saved.id} với ${offers.length} lựa chọn chuyến bay.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });