import type { AdminDemoState } from './demoInterventions'

export type ListKind = 'airlines' | 'users' | 'flights' | 'bookings' | 'payments' | 'audit-logs'
export type DetailSection = { title: string; fields: Array<{ label: string; value: string }> }
export type CatalogRow = {
  id: number
  cells: string[]
  sortValues: Array<string | number>
  searchText: string
  filters: Record<string, string>
  rangeDate?: string
  sections: DetailSection[]
}
export type SelectControl = { key: string; label: string; options: Array<{ value: string; label: string }> }
export type DateControl = { key: string; label: string }
export type CatalogPage = {
  title: string
  description: string
  columns: string[]
  searchPlaceholder: string
  selects: SelectControl[]
  dates?: DateControl[]
  rangeLabel?: string
  rows: CatalogRow[]
}

export const formatDateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
  : '—'
export const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`
const localDate = (value: string) => value.slice(0, 10)
const yesNo = (value: boolean) => value ? 'Có' : 'Không'

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên', CUSTOMER: 'Khách hàng',
  AIRLINE_FLIGHT_MANAGER: 'Quản lý chuyến', AIRLINE_SALES_MANAGER: 'Quản lý bán vé',
}
const actionLabels: Record<string, string> = {
  LOCK_AIRLINE: 'Khóa hãng', UNLOCK_AIRLINE: 'Mở hãng', LOCK_USER: 'Khóa tài khoản', UNLOCK_USER: 'Mở tài khoản',
  HIDE_FLIGHT: 'Tạm ẩn chuyến', REOPEN_FLIGHT: 'Mở bán lại', CANCEL_BOOKING_EXCEPTION: 'Hủy booking ngoại lệ',
  MARK_PAYMENT_REVIEW: 'Đánh dấu cần kiểm tra',
}
const statusLabels: Record<string, string> = {
  ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', ON_SALE: 'Đang bán', HIDDEN: 'Tạm ẩn',
  SCHEDULED: 'Theo lịch', BOARDING: 'Lên máy bay', DEPARTED: 'Đã khởi hành', COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy', PENDING: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', EXPIRED: 'Hết hạn',
  PAID: 'Đã thanh toán', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền',
  NONE: 'Bình thường', NEEDS_REVIEW: 'Cần kiểm tra', RESOLVED: 'Đã xử lý',
  SUCCESS: 'Thành công',
}
export const displayStatus = (value: string) => statusLabels[value] ?? value
const options = (values: string[], labels = statusLabels) => values.map((value) => ({ value, label: labels[value] ?? value }))
const section = (title: string, fields: Array<[string, string]>): DetailSection => ({
  title, fields: fields.map(([label, value]) => ({ label, value })),
})
const joined = (values: string[]) => values.length ? values.join(', ') : 'Không có'
const auditSummary = (logs: AdminDemoState['auditLogs'], entityType: string, entityId: number) => {
  const related = logs.filter((log) => log.entityType === entityType && log.entityId === entityId)
  return related.length ? related.map((log) => `${actionLabels[log.action] ?? log.action}: ${log.reason}`).join('; ') : 'Chưa có can thiệp'
}

export function createPreviewCatalog(state: AdminDemoState): Record<ListKind, CatalogPage> {
  const { airlines, users, flights, bookings, payments, auditLogs } = state
  const airlineSelect: SelectControl = { key: 'airlineId', label: 'Hãng bay', options: airlines.map(({ id, name }) => ({ value: String(id), label: name })) }
  return {
  airlines: {
    title: 'Hãng bay', description: 'Danh sách hãng bay trong hệ thống.', searchPlaceholder: 'Mã hoặc tên hãng',
    columns: ['MÃ HÃNG', 'TÊN HÃNG', 'TRẠNG THÁI', 'NHÂN VIÊN', 'CHUYẾN ĐANG BÁN'],
    selects: [{ key: 'status', label: 'Trạng thái', options: options(['ACTIVE', 'LOCKED']) }],
    rows: airlines.map((item) => ({
      id: item.id,
      cells: [item.code, item.name, displayStatus(item.status), String(item.staffCount), String(item.onSaleFlightCount)],
      sortValues: [item.code, item.name, item.status, item.staffCount, item.onSaleFlightCount],
      searchText: `${item.code} ${item.name}`,
      filters: { status: item.status },
      sections: [
        section('Thông tin hãng', [['Mã hãng', item.code], ['Tên hãng', item.name], ['Trạng thái', displayStatus(item.status)], ['Ngày tạo', formatDateTime(item.createdAt)]]),
        section('Liên quan', [
          ['Nhân viên', joined(users.filter((user) => user.airlineId === item.id).map((user) => user.name))],
          ['Chuyến bay', joined(flights.filter((flight) => flight.airlineId === item.id).map((flight) => flight.flightNumber))],
          ['Booking', String(bookings.filter((booking) => booking.airlineId === item.id).length)],
        ]),
        section('Nhật ký liên quan', [['Can thiệp', auditSummary(auditLogs, 'AIRLINE', item.id)]]),
      ],
    })),
  },
  users: {
    title: 'Tài khoản', description: 'Tài khoản khách hàng và nhân viên các hãng bay.', searchPlaceholder: 'Tên hoặc email',
    columns: ['HỌ TÊN', 'EMAIL', 'VAI TRÒ', 'HÃNG BAY', 'TRẠNG THÁI', 'ĐĂNG NHẬP GẦN NHẤT'],
    selects: [
      { key: 'role', label: 'Vai trò', options: options(['ADMIN', 'CUSTOMER', 'AIRLINE_FLIGHT_MANAGER', 'AIRLINE_SALES_MANAGER'], roleLabels) },
      airlineSelect,
      { key: 'status', label: 'Trạng thái', options: options(['ACTIVE', 'LOCKED']) },
    ],
    rows: users.map((item) => ({
      id: item.id,
      cells: [item.name, item.email, roleLabels[item.role], item.airlineName ?? '—', displayStatus(item.status), formatDateTime(item.lastLoginAt)],
      sortValues: [item.name, item.email, item.role, item.airlineName ?? '', item.status, item.lastLoginAt ?? ''],
      searchText: `${item.name} ${item.email}`,
      filters: { role: item.role, airlineId: item.airlineId === null ? '' : String(item.airlineId), status: item.status },
      sections: [
        section('Hồ sơ', [['Họ tên', item.name], ['Email', item.email], ['Đăng nhập gần nhất', formatDateTime(item.lastLoginAt)]]),
        section('Quyền truy cập', [['Vai trò', roleLabels[item.role]], ['Hãng bay', item.airlineName ?? 'Không thuộc hãng'], ['Trạng thái', displayStatus(item.status)]]),
        section('Nhật ký liên quan', [['Can thiệp', auditSummary(auditLogs, 'USER', item.id)]]),
      ],
    })),
  },
  flights: {
    title: 'Chuyến bay', description: 'Chuyến nội bộ do hãng tạo, có thể mở bán trong hệ thống demo.', searchPlaceholder: 'Mã chuyến bay',
    columns: ['MÃ CHUYẾN', 'HÃNG BAY', 'TUYẾN', 'GIỜ ĐI', 'GIÁ', 'CHỖ CÒN', 'MỞ BÁN'],
    selects: [
      airlineSelect,
      { key: 'departureCode', label: 'Sân bay đi', options: options(['HAN', 'SGN']) },
      { key: 'arrivalCode', label: 'Sân bay đến', options: options(['SGN', 'DAD']) },
      { key: 'status', label: 'Trạng thái bay', options: options(['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED']) },
      { key: 'saleStatus', label: 'Mở bán', options: options(['ON_SALE', 'HIDDEN']) },
    ],
    dates: [{ key: 'departureDate', label: 'Ngày bay' }],
    rows: flights.map((item) => ({
      id: item.id,
      cells: [item.flightNumber, item.airlineName, `${item.departureCode} → ${item.arrivalCode}`, formatDateTime(item.departureTime), formatMoney(item.basePrice), `${item.availableSeats}/${item.capacity}`, displayStatus(item.saleStatus)],
      sortValues: [item.flightNumber, item.airlineName, `${item.departureCode}-${item.arrivalCode}`, item.departureTime, item.basePrice, item.availableSeats, item.saleStatus],
      searchText: `${item.flightNumber} ${item.airlineName}`,
      filters: { airlineId: String(item.airlineId), departureCode: item.departureCode, arrivalCode: item.arrivalCode, status: item.status, saleStatus: item.saleStatus, departureDate: localDate(item.departureTime) },
      sections: [
        section('Lịch bay', [['Mã chuyến', item.flightNumber], ['Hãng bay', item.airlineName], ['Tuyến', `${item.departureCode} → ${item.arrivalCode}`], ['Giờ đi', formatDateTime(item.departureTime)], ['Giờ đến', formatDateTime(item.arrivalTime)]]),
        section('Bán vé nội bộ', [['Trạng thái bay', displayStatus(item.status)], ['Mở bán', displayStatus(item.saleStatus)], ['Giá cơ bản', formatMoney(item.basePrice)], ['Chỗ còn', `${item.availableSeats}/${item.capacity}`], ['Có booking', yesNo(item.bookingCount > 0)]]),
        section('Booking liên quan', [['Mã booking', joined(bookings.filter((booking) => booking.flightId === item.id).map((booking) => `${booking.bookingCode} (${displayStatus(booking.status)})`))]]),
        section('Can thiệp đã ghi', [['Nhật ký', auditSummary(auditLogs, 'FLIGHT', item.id)]]),
      ],
    })),
  },
  bookings: {
    title: 'Booking', description: 'Tra cứu booking của mọi hãng trong hệ thống demo.', searchPlaceholder: 'Mã booking hoặc khách liên hệ',
    columns: ['MÃ BOOKING', 'HÃNG BAY', 'CHUYẾN', 'KHÁCH LIÊN HỆ', 'TỔNG TIỀN', 'TRẠNG THÁI', 'NGÀY TẠO'],
    selects: [airlineSelect, { key: 'status', label: 'Trạng thái', options: options(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']) }],
    dates: [{ key: 'departureDate', label: 'Ngày bay' }], rangeLabel: 'Ngày tạo',
    rows: bookings.map((item) => {
      const flight = flights.find((candidate) => candidate.id === item.flightId)
      const relatedPayments = payments.filter((payment) => payment.bookingId === item.id)
      return {
        id: item.id,
        cells: [item.bookingCode, item.airlineName, item.flightNumber, item.contactName, formatMoney(item.totalAmount), displayStatus(item.status), formatDateTime(item.createdAt)],
        sortValues: [item.bookingCode, item.airlineName, item.flightNumber, item.contactName, item.totalAmount, item.status, item.createdAt],
        searchText: `${item.bookingCode} ${item.contactName} ${item.flightNumber}`,
        filters: { airlineId: String(item.airlineId), status: item.status, departureDate: flight ? localDate(flight.departureTime) : '' },
        rangeDate: localDate(item.createdAt),
        sections: [
          section('Booking', [['Mã booking', item.bookingCode], ['Trạng thái', displayStatus(item.status)], ['Tổng tiền', formatMoney(item.totalAmount)], ['Ngày tạo', formatDateTime(item.createdAt)], ['Giữ chỗ đến', formatDateTime(item.expiresAt)]]),
          section('Chuyến bay', [['Hãng bay', item.airlineName], ['Mã chuyến', item.flightNumber], ['Tuyến', flight ? `${flight.departureCode} → ${flight.arrivalCode}` : '—'], ['Giờ đi', formatDateTime(flight?.departureTime ?? null)]]),
          section('Liên hệ và hành khách', [['Khách liên hệ', item.contactName], ['Email', item.contactEmail ?? '—'], ['Điện thoại', item.contactPhoneMasked ?? '—'], ['Hành khách', joined(item.passengers.map((person) => `${person.fullName} (${person.documentNumberMasked ?? 'chưa có giấy tờ'})`))]]),
          section('Thanh toán', [['Giao dịch', joined(relatedPayments.map((payment) => `#${payment.id}: ${displayStatus(payment.status)} · ${displayStatus(payment.reviewStatus)} · ${formatMoney(payment.amount)}`))]]),
          section('Nhật ký liên quan', [['Can thiệp', auditSummary(auditLogs, 'BOOKING', item.id)]]),
        ],
      }
    }),
  },
  payments: {
    title: 'Thanh toán', description: 'Giao dịch mô phỏng để tra cứu và đối soát.', searchPlaceholder: 'Mã giao dịch hoặc booking',
    columns: ['GIAO DỊCH', 'BOOKING', 'HÃNG BAY', 'SỐ TIỀN', 'TRẠNG THÁI', 'KIỂM TRA', 'THỜI GIAN'],
    selects: [airlineSelect, { key: 'status', label: 'Trạng thái', options: options(['PENDING', 'PAID', 'FAILED', 'REFUNDED']) }, { key: 'reviewStatus', label: 'Kiểm tra', options: options(['NONE', 'NEEDS_REVIEW', 'RESOLVED']) }],
    rangeLabel: 'Ngày giao dịch',
    rows: payments.map((item) => {
      const booking = bookings.find((candidate) => candidate.id === item.bookingId)
      return {
        id: item.id,
        cells: [item.providerTransactionId ?? `#${item.id}`, item.bookingCode, item.airlineName, formatMoney(item.amount), displayStatus(item.status), displayStatus(item.reviewStatus), formatDateTime(item.createdAt)],
        sortValues: [item.providerTransactionId ?? '', item.bookingCode, item.airlineName, item.amount, item.status, item.reviewStatus, item.createdAt],
        searchText: `${item.providerTransactionId ?? item.id} ${item.bookingCode}`,
        filters: { airlineId: String(item.airlineId), status: item.status, reviewStatus: item.reviewStatus },
        rangeDate: localDate(item.createdAt),
        sections: [
          section('Giao dịch', [['Mã giao dịch', item.providerTransactionId ?? `#${item.id}`], ['Phương thức', item.method], ['Số tiền', formatMoney(item.amount)], ['Trạng thái', displayStatus(item.status)], ['Ngày tạo', formatDateTime(item.createdAt)]]),
          section('Đối soát', [['Tình trạng kiểm tra', displayStatus(item.reviewStatus)], ['Mã booking', item.bookingCode], ['Trạng thái booking', booking ? displayStatus(booking.status) : '—'], ['Hãng bay', item.airlineName]]),
          section('Nhật ký liên quan', [['Can thiệp', auditSummary(auditLogs, 'PAYMENT', item.id)]]),
        ],
      }
    }),
  },
  'audit-logs': {
    title: 'Nhật ký', description: 'Lịch sử can thiệp quản trị, chỉ đọc.', searchPlaceholder: 'Người thực hiện hoặc lý do',
    columns: ['THỜI GIAN', 'NGƯỜI THỰC HIỆN', 'HÀNH ĐỘNG', 'ĐỐI TƯỢNG', 'KẾT QUẢ'],
    selects: [
      { key: 'actorId', label: 'Người thực hiện', options: users.filter((user) => user.role === 'ADMIN').map((user) => ({ value: String(user.id), label: user.name })) },
      { key: 'action', label: 'Hành động', options: options([...new Set(auditLogs.map((log) => log.action))], actionLabels) },
      { key: 'entityType', label: 'Đối tượng', options: options(['AIRLINE', 'USER', 'FLIGHT', 'BOOKING', 'PAYMENT'], {}) },
    ],
    rangeLabel: 'Thời gian',
    rows: auditLogs.map((item) => ({
      id: item.id,
      cells: [formatDateTime(item.createdAt), item.actorName, actionLabels[item.action] ?? item.action, `${item.entityType} #${item.entityId}`, displayStatus(item.result)],
      sortValues: [item.createdAt, item.actorName, item.action, `${item.entityType}-${item.entityId}`, item.result],
      searchText: `${item.actorName} ${item.reason} ${item.action}`,
      filters: { actorId: String(item.actorId), action: item.action, entityType: item.entityType },
      rangeDate: localDate(item.createdAt),
      sections: [
        section('Thao tác', [['Thời gian', formatDateTime(item.createdAt)], ['Người thực hiện', item.actorName], ['Vai trò', roleLabels[item.actorRole]], ['Hành động', actionLabels[item.action] ?? item.action], ['Đối tượng', `${item.entityType} #${item.entityId}`], ['Kết quả', displayStatus(item.result)], ['Lý do', item.reason]]),
        section('Thay đổi', [['Trước', JSON.stringify(item.before) ?? '—'], ['Sau', JSON.stringify(item.after) ?? '—']]),
      ],
    })),
  },
  }
}
