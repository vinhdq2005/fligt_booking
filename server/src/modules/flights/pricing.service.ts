
type PricingInput = {
  basePrice: number;
  departureTime: Date;
  capacity: number;
  confirmedPassengers: number;
  now?: Date;
};

// Hệ số theo thời gian còn lại đến giờ khởi hành.
const TIME_RULES = [
  { hours: 30 * 24, multiplier: 0.90 },
  { hours: 14 * 24, multiplier: 0.97 },
  { hours: 7 * 24, multiplier: 1.05 },
  { hours: 3 * 24, multiplier: 1.15 },
  { hours: 24, multiplier: 1.25 },
  { hours: 6, multiplier: 1.40 },
  { hours: 1, multiplier: 1.50 },
  { hours: 0, multiplier: 1.60 },
];

function getTimeMultiplier(hoursLeft: number): number {
  for (const rule of TIME_RULES) {
    if (hoursLeft > rule.hours) {
      return rule.multiplier;
    }
  }

  return 1.60;
}

// Hệ số theo tỷ lệ ghế đã được xác nhận.
function getOccupancyMultiplier(
  occupancyPercent: number,
): number {
  if (occupancyPercent >= 85) return 1.40;
  if (occupancyPercent >= 70) return 1.25;
  if (occupancyPercent >= 50) return 1.10;
  if (occupancyPercent >= 30) return 1.00;
  return 0.95;
}

function getDepartureMultiplier(
  departureTime: Date,
): number {
  // Dùng múi giờ địa phương của máy chủ.
  const day = departureTime.getDay();
  const hour = departureTime.getHours();

  const isWeekend = day === 0 || day === 6;

  const isPeakHour =
    (hour >= 6 && hour < 9) ||
    (hour >= 17 && hour < 20);

  let multiplier = 1.0;

  if (isWeekend) multiplier *= 1.05;
  if (isPeakHour) multiplier *= 1.08;

  return multiplier;
}

export function calculateCurrentPrice(input: PricingInput) {
  const {
    basePrice,
    departureTime,
    capacity,
    confirmedPassengers,
    now = new Date(),
  } = input;

  if (
    !Number.isFinite(basePrice) ||
    basePrice <= 0 ||
    !Number.isInteger(capacity) ||
    capacity <= 0 ||
    !Number.isInteger(confirmedPassengers) ||
    confirmedPassengers < 0 ||
    confirmedPassengers > capacity ||
    Number.isNaN(departureTime.getTime()) ||
    Number.isNaN(now.getTime())
  ) {
    throw new Error("Dữ liệu tính giá không hợp lệ.");
  }

  const hoursLeft =
    (departureTime.getTime() - now.getTime()) /
    (60 * 60 * 1000);

  if (hoursLeft <= 0) {
    throw new Error("Chuyến bay đã khởi hành.");
  }

  const occupancyPercent =
    (confirmedPassengers / capacity) * 100;

  const timeMultiplier =
    getTimeMultiplier(hoursLeft);

  const occupancyMultiplier =
    getOccupancyMultiplier(occupancyPercent);

  const departureMultiplier =
    getDepartureMultiplier(departureTime);

  const rawPrice =
    basePrice *
    timeMultiplier *
    occupancyMultiplier *
    departureMultiplier;

  // Giới hạn giá từ 70% đến 220% giá niêm yết.
  const minPrice = basePrice * 0.7;
  const maxPrice = basePrice * 2.2;

  const boundedPrice = Math.min(
    maxPrice,
    Math.max(minPrice, rawPrice),
  );

  // Làm tròn đến 1.000 VNĐ.
  const currentPrice =
    Math.round(boundedPrice / 1000) * 1000;

  return {
    basePrice,
    currentPrice,
    occupancyPercent: Number(
      occupancyPercent.toFixed(2),
    ),
    timeMultiplier,
    occupancyMultiplier,
    departureMultiplier,
    pricedAt: now,
  };
}
