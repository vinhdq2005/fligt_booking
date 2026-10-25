import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVietQrPayment, VietQrError } from "./vietqr.service";

const booking = {
  id: 65,
  bookingCode: "booking-round-trip-65",
  totalAmount: 4236000,
  status: "PENDING",
  expiresAt: new Date("2026-11-01T10:15:00Z"),
};
const config = { bankId: "970415", accountNo: "1234567890", accountName: "NGUYEN VAN A" };
const now = new Date("2026-11-01T10:00:00Z");

test("VietQR uses the locked booking total and a booking-specific transfer reference", () => {
  const result = buildVietQrPayment(booking, config, now);
  const url = new URL(result.imageUrl);
  assert.equal(url.hostname, "img.vietqr.io");
  assert.equal(url.searchParams.get("amount"), String(booking.totalAmount));
  assert.equal(url.searchParams.get("addInfo"), "FB65");
  assert.equal(result.amount, booking.totalAmount);
  assert.equal(result.expiresAt, booking.expiresAt);
});

test("VietQR cannot be loaded for an expired or confirmed booking", () => {
  assert.throws(() => buildVietQrPayment(booking, config, booking.expiresAt), (error) => error instanceof VietQrError && error.statusCode === 409);
  assert.throws(() => buildVietQrPayment({ ...booking, status: "CONFIRMED" }, config, now), (error) => error instanceof VietQrError && error.statusCode === 409);
});
