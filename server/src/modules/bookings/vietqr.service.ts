import { prisma } from "../../lib/prisma";

type PendingBooking = {
  id: number;
  bookingCode: string;
  totalAmount: number;
  status: string;
  expiresAt: Date | null;
};

type VietQrConfig = {
  bankId: string;
  accountNo: string;
  accountName: string;
};

export class VietQrError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function buildVietQrPayment(booking: PendingBooking, config: VietQrConfig, now = new Date()) {
  if (booking.status !== "PENDING") throw new VietQrError(409, "Đặt chỗ không còn chờ thanh toán.");
  if (booking.expiresAt && booking.expiresAt <= now) throw new VietQrError(409, "Đặt chỗ đã hết hạn giữ chỗ.");
  if (!Number.isSafeInteger(booking.totalAmount) || booking.totalAmount <= 0 || booking.totalAmount > 9999999999999) {
    throw new VietQrError(409, "Số tiền đặt chỗ không hợp lệ để tạo VietQR.");
  }
  const bankId = config.bankId.trim();
  const accountNo = config.accountNo.trim();
  const accountName = config.accountName.trim();
  if (!/^[A-Za-z0-9]{2,20}$/.test(bankId) || !/^[A-Za-z0-9]{1,19}$/.test(accountNo) || !accountName) {
    throw new VietQrError(503, "VietQR chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống.");
  }

  const transferContent = `FB${booking.id}`;
  const imageUrl = new URL(`https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.svg`);
  imageUrl.searchParams.set("amount", String(booking.totalAmount));
  imageUrl.searchParams.set("addInfo", transferContent);
  imageUrl.searchParams.set("accountName", accountName);

  return {
    bookingCode: booking.bookingCode,
    amount: booking.totalAmount,
    currency: "VND" as const,
    bankId,
    accountNo,
    accountName,
    transferContent,
    imageUrl: imageUrl.toString(),
    expiresAt: booking.expiresAt,
  };
}

export async function getVietQrPayment(bookingCode: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: bookingCode.trim() },
    select: { id: true, bookingCode: true, totalAmount: true, status: true, expiresAt: true },
  });
  if (!booking) throw new VietQrError(404, "Không tìm thấy đặt chỗ.");
  return buildVietQrPayment(booking, {
    bankId: process.env.VIETQR_BANK_ID ?? "",
    accountNo: process.env.VIETQR_ACCOUNT_NO ?? "",
    accountName: process.env.VIETQR_ACCOUNT_NAME ?? "",
  });
}
