/** Dữ liệu mẫu chỉ phục vụ dựng và duyệt giao diện; không ghi database. */
import type {
  AdminAirline,
  AdminAuditLog,
  AdminBooking,
  AdminDashboard,
  AdminFlight,
  AdminPayment,
  AdminUser,
} from './models'

export const demoAirlines = [
  { id: 1, code: 'VN', name: 'Vietnam Airlines', status: 'ACTIVE', staffCount: 2, onSaleFlightCount: 1, createdAt: '2026-10-01T08:00:00+07:00' },
  { id: 2, code: 'VJ', name: 'Vietjet Air', status: 'ACTIVE', staffCount: 1, onSaleFlightCount: 1, createdAt: '2026-10-02T08:00:00+07:00' },
] satisfies AdminAirline[]

export const demoUsers = [
  { id: 1, name: 'Quản trị viên Demo', email: 'admin.demo@example.test', role: 'ADMIN', airlineId: null, airlineName: null, status: 'ACTIVE', lastLoginAt: '2026-10-15T08:30:00+07:00' },
  { id: 2, name: 'Nguyễn An', email: 'flight.vn@example.test', role: 'AIRLINE_FLIGHT_MANAGER', airlineId: 1, airlineName: 'Vietnam Airlines', status: 'ACTIVE', lastLoginAt: '2026-10-14T14:10:00+07:00' },
  { id: 3, name: 'Trần Bình', email: 'sales.vn@example.test', role: 'AIRLINE_SALES_MANAGER', airlineId: 1, airlineName: 'Vietnam Airlines', status: 'ACTIVE', lastLoginAt: '2026-10-14T15:20:00+07:00' },
  { id: 4, name: 'Lê Chi', email: 'sales.vj@example.test', role: 'AIRLINE_SALES_MANAGER', airlineId: 2, airlineName: 'Vietjet Air', status: 'ACTIVE', lastLoginAt: null },
  { id: 5, name: 'Khách Demo', email: 'customer.demo@example.test', role: 'CUSTOMER', airlineId: null, airlineName: null, status: 'LOCKED', lastLoginAt: '2026-10-12T09:00:00+07:00' },
] satisfies AdminUser[]

export const demoFlights = [
  { id: 101, flightNumber: 'VN201', airlineId: 1, airlineName: 'Vietnam Airlines', departureCode: 'HAN', arrivalCode: 'SGN', departureTime: '2026-11-01T08:00:00+07:00', arrivalTime: '2026-11-01T10:10:00+07:00', basePrice: 1450000, capacity: 180, availableSeats: 178, status: 'SCHEDULED', saleStatus: 'ON_SALE', bookingCount: 2 },
  { id: 102, flightNumber: 'VJ602', airlineId: 2, airlineName: 'Vietjet Air', departureCode: 'SGN', arrivalCode: 'DAD', departureTime: '2026-11-03T13:30:00+07:00', arrivalTime: '2026-11-03T14:50:00+07:00', basePrice: 890000, capacity: 180, availableSeats: 179, status: 'SCHEDULED', saleStatus: 'ON_SALE', bookingCount: 1 },
  { id: 103, flightNumber: 'VN315', airlineId: 1, airlineName: 'Vietnam Airlines', departureCode: 'HAN', arrivalCode: 'DAD', departureTime: '2026-11-05T11:00:00+07:00', arrivalTime: '2026-11-05T12:20:00+07:00', basePrice: 1190000, capacity: 150, availableSeats: 150, status: 'SCHEDULED', saleStatus: 'HIDDEN', bookingCount: 0 },
] satisfies AdminFlight[]

export const demoBookings = [
  { id: 501, bookingCode: 'BK-DEMO-001', flightId: 101, flightNumber: 'VN201', airlineId: 1, airlineName: 'Vietnam Airlines', contactName: 'Phạm Mai', contactEmail: 'mai@example.test', contactPhoneMasked: '09******21', totalAmount: 2900000, status: 'CONFIRMED', expiresAt: null, createdAt: '2026-10-14T09:00:00+07:00', passengers: [{ id: 1, fullName: 'Phạm Mai', documentNumberMasked: '********1234' }, { id: 2, fullName: 'Phạm Minh', documentNumberMasked: '********5678' }], paymentIds: [801] },
  { id: 502, bookingCode: 'BK-DEMO-002', flightId: 101, flightNumber: 'VN201', airlineId: 1, airlineName: 'Vietnam Airlines', contactName: 'Đỗ Nam', contactEmail: 'nam@example.test', contactPhoneMasked: '09******45', totalAmount: 1450000, status: 'EXPIRED', expiresAt: '2026-10-14T09:10:00+07:00', createdAt: '2026-10-14T09:00:00+07:00', passengers: [{ id: 3, fullName: 'Đỗ Nam', documentNumberMasked: null }], paymentIds: [802] },
  { id: 503, bookingCode: 'BK-DEMO-003', flightId: 102, flightNumber: 'VJ602', airlineId: 2, airlineName: 'Vietjet Air', contactName: 'Bùi Hà', contactEmail: 'ha@example.test', contactPhoneMasked: '09******67', totalAmount: 890000, status: 'CONFIRMED', expiresAt: null, createdAt: '2026-10-13T10:00:00+07:00', passengers: [{ id: 4, fullName: 'Bùi Hà', documentNumberMasked: '********9012' }], paymentIds: [803] },
] satisfies AdminBooking[]

export const demoPayments = [
  { id: 801, bookingId: 501, bookingCode: 'BK-DEMO-001', airlineId: 1, airlineName: 'Vietnam Airlines', providerTransactionId: 'TX-DEMO-801', amount: 2900000, currency: 'VND', method: 'MOCK', status: 'PAID', reviewStatus: 'NONE', createdAt: '2026-10-14T09:03:00+07:00' },
  { id: 802, bookingId: 502, bookingCode: 'BK-DEMO-002', airlineId: 1, airlineName: 'Vietnam Airlines', providerTransactionId: null, amount: 1450000, currency: 'VND', method: 'MOCK', status: 'FAILED', reviewStatus: 'NEEDS_REVIEW', createdAt: '2026-10-14T09:02:00+07:00' },
  { id: 803, bookingId: 503, bookingCode: 'BK-DEMO-003', airlineId: 2, airlineName: 'Vietjet Air', providerTransactionId: 'TX-DEMO-803', amount: 890000, currency: 'VND', method: 'MOCK', status: 'PAID', reviewStatus: 'NONE', createdAt: '2026-10-13T10:04:00+07:00' },
] satisfies AdminPayment[]

export const demoAuditLogs = [
  { id: 901, actorId: 1, actorName: 'Quản trị viên Demo', actorRole: 'ADMIN', action: 'HIDE_FLIGHT', entityType: 'FLIGHT', entityId: 103, result: 'SUCCESS', reason: 'Kiểm tra lịch bay trước khi tiếp tục bán', before: { saleStatus: 'ON_SALE' }, after: { saleStatus: 'HIDDEN' }, createdAt: '2026-10-14T16:00:00+07:00' },
  { id: 902, actorId: 1, actorName: 'Quản trị viên Demo', actorRole: 'ADMIN', action: 'LOCK_USER', entityType: 'USER', entityId: 5, result: 'SUCCESS', reason: 'Yêu cầu hỗ trợ tài khoản', before: { status: 'ACTIVE' }, after: { status: 'LOCKED' }, createdAt: '2026-10-14T17:00:00+07:00' },
] satisfies AdminAuditLog[]

export const demoDashboard = {
  activeAirlines: 2,
  activeUsers: 4,
  lockedUsers: 1,
  onSaleFlights: 2,
  hiddenFlights: 1,
  bookingsByStatus: { PENDING: 0, CONFIRMED: 2, CANCELLED: 0, EXPIRED: 1 },
  simulatedPaidAmount: 3790000,
  failedPayments: 1,
  needsReviewPayments: 1,
} satisfies AdminDashboard
