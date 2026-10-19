
type PricingInput = {
  basePrice: number;
  departureTime: Date;
  capacity: number;
  confirmedPassengers: number;
  now?: Date;
};

const TIME_RULES = [
  { hours: 30 * 24, multiplier: 0.95 },
  { hours: 14 * 24, multiplier: 1.0 },
  { hours: 7 * 24, multiplier: 1.03 },
  { hours: 3 * 24, multiplier: 1.08 },
  { hours: 24, multiplier: 1.12 },
  { hours: 0, multiplier: 1.15 },
];

function getTimeMultiplier(hoursLeft: number): number {
  for (const rule of TIME_RULES) {
    if (hoursLeft > rule.hours) {
      return rule.multiplier;
    }
  }

  return 1.15;
}

function getOccupancyMultiplier(
  occupancyPercent: number,
): number {
  if (occupancyPercent >= 85) return 1.25;
  if (occupancyPercent >= 70) return 1.15;
  if (occupancyPercent >= 50) return 1.05;
  if (occupancyPercent >= 30) return 1.0;
  return 0.95;
}

function getDepartureMultiplier(departureTime: Date): number {
  // Dùng giờ địa phương của máy chủ.
  // Cần cấu hình múi giờ sân bay trước khi triển khai thực tế.
  const day = departureTime.getDay();
  const hour = departureTime.getHours();

  const isWeekend = day === 0 || day === 6;
  const isPeakHour =
    (hour >= 6 && hour < 9) ||
    (hour >= 17 && hour < 20);

  let multiplier = 1.0;

  if (isWeekend) multiplier *= 1.05;
  if (isPeakHour) multiplier *= 1.05;

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
    basePrice < 0 ||
    !Number.isInteger(capacity) ||
    capacity <= 0 ||
    !Number.isFinite(confirmedPassengers) ||
    confirmedPassengers < 0 ||
    Number.isNaN(departureTime.getTime())
  ) {
    throw new Error("Dữ liệu tính giá không hợp lệ.");
  }

  const hoursLeft =
    (departureTime.getTime() - now.getTime()) /
    (60 * 60 * 1000);

  if (hoursLeft <= 0) {
    throw new Error("Chuyến bay đã khởi hành.");
  }

  const occupancyPercent = Math.min(
    100,
    (confirmedPassengers / capacity) * 100,
  );

  const timeMultiplier = getTimeMultiplier(hoursLeft);
  const occupancyMultiplier =
    getOccupancyMultiplier(occupancyPercent);
  const departureMultiplier =
    getDepartureMultiplier(departureTime);

  const rawPrice =
    basePrice *
    timeMultiplier *
    occupancyMultiplier *
    departureMultiplier;

  const currentPrice = Math.round(
    Math.min(basePrice * 1.5, Math.max(basePrice * 0.8, rawPrice)) /
      1000,
  ) * 1000;

  return {
    basePrice,
    currentPrice,
    occupancyPercent: Number(occupancyPercent.toFixed(2)),
    timeMultiplier,
    occupancyMultiplier,
    departureMultiplier,
    pricedAt: now,
  };
}
