import { demoAirlines, demoAuditLogs, demoBookings, demoFlights, demoPayments, demoUsers } from './fixtures'
import type {
  AdminAirline, AdminAuditLog, AdminBooking, AdminFlight, AdminPayment, AdminUser,
  InterventionAction, InterventionRequest,
} from './models'

export type AdminDemoState = {
  airlines: AdminAirline[]
  users: AdminUser[]
  flights: AdminFlight[]
  bookings: AdminBooking[]
  payments: AdminPayment[]
  auditLogs: AdminAuditLog[]
}

export type InterventionPlan = {
  action: InterventionAction
  entityId: number
  subject: string
  label: string
  consequences: string[]
  disabledReason?: string
}

export type AdminDemoSession = {
  demoState: AdminDemoState
  runIntervention: (request: InterventionRequest) => ReturnType<typeof applyDemoIntervention>
}

export function createInitialDemoState(): AdminDemoState {
  return {
    airlines: demoAirlines.map((item) => ({ ...item })),
    users: demoUsers.map((item) => ({ ...item })),
    flights: demoFlights.map((item) => ({ ...item })),
    bookings: demoBookings.map((item) => ({ ...item, passengers: item.passengers.map((person) => ({ ...person })), paymentIds: [...item.paymentIds] })),
    payments: demoPayments.map((item) => ({ ...item })),
    auditLogs: demoAuditLogs.map((item) => ({ ...item })),
  }
}

export function getInterventionPlan(state: AdminDemoState, kind: string, entityId: number, now = new Date()): InterventionPlan | null {
  if (kind === 'airlines') {
    const airline = state.airlines.find((item) => item.id === entityId)
    if (!airline) return null
    const locking = airline.status === 'ACTIVE'
    const onSale = state.flights.filter((flight) => flight.airlineId === airline.id && flight.saleStatus === 'ON_SALE').length
    const staff = state.users.filter((user) => user.airlineId === airline.id && user.status === 'ACTIVE').length
    return {
      action: locking ? 'LOCK_AIRLINE' : 'UNLOCK_AIRLINE', entityId, subject: airline.name,
      label: locking ? 'Khóa hoạt động hãng' : 'Mở lại hoạt động hãng',
      consequences: locking
        ? [`${staff} nhân viên đang hoạt động sẽ không được tạo/mở bán chuyến mới khi backend áp dụng quyền này.`, `${onSale} chuyến đang bán và booking cũ không bị tự động hủy.`]
        : ['Hãng được phép tiếp tục quản lý và mở bán chuyến khi backend áp dụng quyền này.', 'Booking cũ giữ nguyên.'],
    }
  }

  if (kind === 'users') {
    const user = state.users.find((item) => item.id === entityId)
    if (!user) return null
    const locking = user.status === 'ACTIVE'
    const activeAdmins = state.users.filter((item) => item.role === 'ADMIN' && item.status === 'ACTIVE').length
    return {
      action: locking ? 'LOCK_USER' : 'UNLOCK_USER', entityId, subject: `${user.name} · ${user.email}`,
      label: locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      consequences: locking
        ? ['Tài khoản sẽ không được truy cập bằng quyền hiện tại khi backend áp dụng khóa.', 'Booking và lịch sử thao tác của tài khoản vẫn được giữ.']
        : ['Tài khoản được phép truy cập lại theo vai trò hiện có khi backend áp dụng mở khóa.'],
      disabledReason: locking && user.id === 1 ? 'Không thể tự khóa tài khoản admin đang dùng.'
        : locking && user.role === 'ADMIN' && activeAdmins <= 1 ? 'Không thể khóa admin hoạt động cuối cùng.' : undefined,
    }
  }

  if (kind === 'flights') {
    const flight = state.flights.find((item) => item.id === entityId)
    if (!flight) return null
    const hiding = flight.saleStatus === 'ON_SALE'
    const activeBookings = state.bookings.filter((booking) => booking.flightId === flight.id && ['PENDING', 'CONFIRMED'].includes(booking.status)).length
    const airline = state.airlines.find((item) => item.id === flight.airlineId)
    return {
      action: hiding ? 'HIDE_FLIGHT' : 'REOPEN_FLIGHT', entityId, subject: `${flight.flightNumber} · ${flight.airlineName}`,
      label: hiding ? 'Tạm ẩn chuyến' : 'Mở bán lại',
      consequences: hiding
        ? ['Chuyến ngừng nhận booking mới.', `${activeBookings} booking còn hiệu lực vẫn được giữ để xử lý riêng.`]
        : ['Chuyến có thể nhận booking mới theo số chỗ còn.', `${activeBookings} booking hiện có không thay đổi.`],
      disabledReason: flight.status !== 'SCHEDULED' ? 'Chỉ can thiệp mở bán với chuyến còn theo lịch.'
        : !hiding && new Date(flight.departureTime) <= now ? 'Không thể mở bán chuyến đã đến giờ khởi hành.'
          : !hiding && airline?.status === 'LOCKED' ? 'Hãng đang bị khóa; chưa thể mở bán chuyến.' : undefined,
    }
  }

  if (kind === 'bookings') {
    const booking = state.bookings.find((item) => item.id === entityId)
    if (!booking) return null
    const paid = state.payments.filter((payment) => payment.bookingId === booking.id && payment.status === 'PAID')
    const flight = state.flights.find((item) => item.id === booking.flightId)
    const active = booking.status === 'PENDING' || booking.status === 'CONFIRMED'
    const seatCount = booking.passengers.length
    return {
      action: 'CANCEL_BOOKING_EXCEPTION', entityId, subject: booking.bookingCode,
      label: 'Hủy booking ngoại lệ',
      consequences: [
        `Booking chuyển sang Đã hủy; ${seatCount} chỗ được trả lại cho chuyến ${booking.flightNumber}.`,
        paid.length ? `${paid.length} thanh toán đã trả tiền sẽ được đánh dấu Cần kiểm tra; không tự ghi đã hoàn tiền.` : 'Không có thanh toán thành công cần đối soát.',
      ],
      disabledReason: !active ? 'Booking đã hủy hoặc hết hạn, không thể hủy lần nữa.'
        : !flight ? 'Không tìm thấy chuyến bay liên quan.'
          : flight.status !== 'SCHEDULED' || new Date(flight.departureTime) <= now ? 'Chuyến đã đến giờ bay hoặc không còn theo lịch; cần quy trình hỗ trợ riêng.'
          : flight.availableSeats + seatCount > flight.capacity ? 'Số chỗ của chuyến không nhất quán; cần kiểm tra dữ liệu.' : undefined,
    }
  }

  if (kind === 'payments') {
    const payment = state.payments.find((item) => item.id === entityId)
    if (!payment) return null
    return {
      action: 'MARK_PAYMENT_REVIEW', entityId, subject: payment.providerTransactionId ?? `Giao dịch #${payment.id}`,
      label: 'Đánh dấu cần kiểm tra',
      consequences: [`Giao dịch của booking ${payment.bookingCode} được đưa vào danh sách cần đối soát.`, 'Trạng thái thanh toán và số tiền không thay đổi.'],
      disabledReason: payment.reviewStatus === 'NEEDS_REVIEW' ? 'Giao dịch đã nằm trong danh sách cần kiểm tra.' : undefined,
    }
  }

  return null
}

export function applyDemoIntervention(state: AdminDemoState, request: InterventionRequest, now = new Date()) {
  const kindByAction: Record<InterventionAction, string> = {
    LOCK_AIRLINE: 'airlines', UNLOCK_AIRLINE: 'airlines', LOCK_USER: 'users', UNLOCK_USER: 'users',
    HIDE_FLIGHT: 'flights', REOPEN_FLIGHT: 'flights', CANCEL_BOOKING_EXCEPTION: 'bookings', MARK_PAYMENT_REVIEW: 'payments',
  }
  const plan = getInterventionPlan(state, kindByAction[request.action], request.entityId, now)
  if (!plan || plan.action !== request.action) throw new Error('Trạng thái bản ghi đã thay đổi. Hãy mở lại chi tiết để kiểm tra.')
  if (plan.disabledReason) throw new Error(plan.disabledReason)
  const reason = request.reason.trim()
  if (reason.length < 10) throw new Error('Vui lòng nhập lý do ít nhất 10 ký tự.')

  let next: AdminDemoState = { ...state }
  let entityType: AdminAuditLog['entityType']
  let before: Record<string, unknown>
  let after: Record<string, unknown>

  switch (request.action) {
    case 'LOCK_AIRLINE':
    case 'UNLOCK_AIRLINE': {
      entityType = 'AIRLINE'
      const status = request.action === 'LOCK_AIRLINE' ? 'LOCKED' : 'ACTIVE'
      const old = state.airlines.find((item) => item.id === request.entityId)!
      before = { status: old.status }
      after = { status }
      next = { ...next, airlines: state.airlines.map((item) => item.id === old.id ? { ...item, status } : item) }
      break
    }
    case 'LOCK_USER':
    case 'UNLOCK_USER': {
      entityType = 'USER'
      const status = request.action === 'LOCK_USER' ? 'LOCKED' : 'ACTIVE'
      const old = state.users.find((item) => item.id === request.entityId)!
      before = { status: old.status }
      after = { status }
      next = { ...next, users: state.users.map((item) => item.id === old.id ? { ...item, status } : item) }
      break
    }
    case 'HIDE_FLIGHT':
    case 'REOPEN_FLIGHT': {
      entityType = 'FLIGHT'
      const saleStatus = request.action === 'HIDE_FLIGHT' ? 'HIDDEN' : 'ON_SALE'
      const old = state.flights.find((item) => item.id === request.entityId)!
      before = { saleStatus: old.saleStatus }
      after = { saleStatus }
      next = { ...next, flights: state.flights.map((item) => item.id === old.id ? { ...item, saleStatus } : item) }
      break
    }
    case 'CANCEL_BOOKING_EXCEPTION': {
      entityType = 'BOOKING'
      const booking = state.bookings.find((item) => item.id === request.entityId)!
      const flight = state.flights.find((item) => item.id === booking.flightId)!
      const paidIds = state.payments.filter((payment) => payment.bookingId === booking.id && payment.status === 'PAID').map((payment) => payment.id)
      before = { status: booking.status, availableSeats: flight.availableSeats, paidPaymentReview: paidIds.map((id) => state.payments.find((payment) => payment.id === id)?.reviewStatus) }
      after = { status: 'CANCELLED', availableSeats: flight.availableSeats + booking.passengers.length, paidPaymentReview: paidIds.length ? 'NEEDS_REVIEW' : 'unchanged' }
      next = {
        ...next,
        bookings: state.bookings.map((item) => item.id === booking.id ? { ...item, status: 'CANCELLED' } : item),
        flights: state.flights.map((item) => item.id === flight.id ? { ...item, availableSeats: flight.availableSeats + booking.passengers.length } : item),
        payments: state.payments.map((item) => paidIds.includes(item.id) ? { ...item, reviewStatus: 'NEEDS_REVIEW' } : item),
      }
      break
    }
    case 'MARK_PAYMENT_REVIEW': {
      entityType = 'PAYMENT'
      const payment = state.payments.find((item) => item.id === request.entityId)!
      before = { reviewStatus: payment.reviewStatus, status: payment.status, amount: payment.amount }
      after = { reviewStatus: 'NEEDS_REVIEW', status: payment.status, amount: payment.amount }
      next = { ...next, payments: state.payments.map((item) => item.id === payment.id ? { ...item, reviewStatus: 'NEEDS_REVIEW' } : item) }
      break
    }
  }

  const actor = state.users.find((item) => item.id === 1)!
  const log: AdminAuditLog = {
    id: Math.max(0, ...state.auditLogs.map((item) => item.id)) + 1,
    actorId: actor.id, actorName: actor.name, actorRole: 'ADMIN',
    action: request.action, entityType, entityId: request.entityId,
    result: 'SUCCESS', reason, before, after, createdAt: now.toISOString(),
  }
  next = { ...next, auditLogs: [log, ...state.auditLogs] }
  return { state: next, log, message: `${plan.label} (mô phỏng) đã hoàn tất. Dữ liệu sẽ trở về ban đầu khi tải lại trang.` }
}
