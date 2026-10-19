import type { InterventionAction } from './models'
import type { ListKind } from './previewCatalog'

export type RealInterventionPlan = {
  action: InterventionAction
  entityId: number
  label: string
  subject: string
  consequences: string[]
  disabledReason?: string
}

type Item = Record<string, unknown>
const datePassed = (value: unknown) => !value || new Date(String(value)).getTime() <= Date.now()
const count = (value: unknown) => Number(value ?? 0)

export function getRealInterventionPlan(kind: ListKind, item: Item, actorId: number | undefined): RealInterventionPlan | null {
  const entityId = Number(item.id)
  if (!Number.isSafeInteger(entityId) || entityId < 1) return null
  if (kind === 'airlines') {
    const locking = item.status === 'ACTIVE'
    return {
      action: locking ? 'LOCK_AIRLINE' : 'UNLOCK_AIRLINE', entityId,
      label: locking ? 'Khóa hãng bay' : 'Mở khóa hãng bay', subject: String(item.name ?? item.code ?? entityId),
      consequences: locking
        ? [`${count(item.staffCount)} tài khoản nhân viên sẽ mất quyền truy cập; phiên hiện tại của họ bị thu hồi.`, `${count(item.onSaleFlightCount)} chuyến đang bán và các booking cũ vẫn được giữ, nhưng hãng không thể tạo chuyến hoặc nhận booking mới.`]
        : ['Hãng và nhân viên đủ điều kiện có thể tiếp tục hoạt động. Booking cũ giữ nguyên.'],
    }
  }
  if (kind === 'users') {
    const locking = item.status === 'ACTIVE'
    return {
      action: locking ? 'LOCK_USER' : 'UNLOCK_USER', entityId,
      label: locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản', subject: `${item.name ?? ''} · ${item.email ?? ''}`,
      consequences: locking ? ['Tài khoản mất quyền truy cập ngay và các phiên đăng nhập bị thu hồi.', 'Booking và nhật ký của tài khoản được giữ nguyên.'] : ['Tài khoản có thể đăng nhập lại theo vai trò hiện tại.'],
      disabledReason: locking && entityId === actorId ? 'Không thể tự khóa tài khoản admin đang dùng.'
        : locking && item.role === 'ADMIN' && count(item.activeAdminCount) <= 1 ? 'Không thể khóa admin hoạt động cuối cùng.'
          : !locking && item.airlineId && item.airlineStatus !== 'ACTIVE' ? 'Hãng bay của tài khoản đang bị khóa.' : undefined,
    }
  }
  if (kind === 'flights') {
    const hiding = item.saleStatus === 'ON_SALE'
    const activeBookings = count(item.activeBookingCount)
    return {
      action: hiding ? 'HIDE_FLIGHT' : 'REOPEN_FLIGHT', entityId,
      label: hiding ? 'Tạm ẩn chuyến' : 'Mở bán lại', subject: `${item.flightNumber ?? entityId} · ${item.airlineName ?? ''}`,
      consequences: hiding ? ['Chuyến ngừng nhận booking mới.', `${activeBookings} booking còn hiệu lực vẫn được giữ để xử lý riêng.`]
        : ['Chuyến có thể nhận booking mới theo số chỗ còn.', `${activeBookings} booking còn hiệu lực không thay đổi.`],
      disabledReason: item.status !== 'SCHEDULED' || datePassed(item.departureTime) ? 'Chuyến đã đến giờ bay hoặc không còn theo lịch.'
        : !hiding && item.airlineStatus !== 'ACTIVE' ? 'Hãng bay đang bị khóa.' : undefined,
    }
  }
  if (kind === 'bookings') {
    const payments = Array.isArray(item.payments) ? item.payments as Array<{ status: string }> : []
    const passengers = Array.isArray(item.passengers) ? item.passengers : []
    const paidCount = payments.filter(payment => payment.status === 'PAID').length
    return {
      action: 'CANCEL_BOOKING_EXCEPTION', entityId, label: 'Hủy booking ngoại lệ', subject: String(item.bookingCode ?? entityId),
      consequences: [`Booking chuyển sang Đã hủy; ${passengers.length} chỗ được giải phóng cho chuyến ${item.flightNumber ?? ''}. Vé chưa sử dụng sẽ bị hủy.`,
        paidCount ? `${paidCount} thanh toán đã trả tiền được đánh dấu Cần kiểm tra; hệ thống không tự hoàn tiền.` : 'Không có thanh toán thành công cần đối soát.'],
      disabledReason: item.status !== 'PENDING' && item.status !== 'CONFIRMED' ? 'Booking không còn hiệu lực để hủy.'
        : item.status === 'PENDING' && datePassed(item.expiresAt) ? 'Booking đã hết hạn giữ chỗ.'
          : item.flightStatus !== 'SCHEDULED' || datePassed(item.departureTime) ? 'Chuyến đã đến giờ bay hoặc không còn theo lịch.'
            : item.hasUsedTicket ? 'Booking đã có vé được sử dụng.' : undefined,
    }
  }
  if (kind === 'payments') return {
    action: 'MARK_PAYMENT_REVIEW', entityId, label: 'Đánh dấu cần kiểm tra',
    subject: String(item.providerTransactionId ?? `Giao dịch #${entityId}`),
    consequences: [`Giao dịch của booking ${item.bookingCode ?? ''} được đưa vào danh sách cần đối soát.`, 'Trạng thái thanh toán và số tiền không thay đổi.'],
    disabledReason: item.reviewStatus === 'NEEDS_REVIEW' ? 'Giao dịch đã được đánh dấu cần kiểm tra.' : undefined,
  }
  return null
}
