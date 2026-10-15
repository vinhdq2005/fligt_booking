/** Hợp đồng hiển thị cho UI admin giai đoạn 1; chưa phải response của API hiện có. */
export type AdminRole =
  | 'ADMIN'
  | 'CUSTOMER'
  | 'AIRLINE_FLIGHT_MANAGER'
  | 'AIRLINE_SALES_MANAGER'

export type AccountStatus = 'ACTIVE' | 'LOCKED'
export type AirlineStatus = 'ACTIVE' | 'LOCKED'
export type FlightStatus = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED'
export type SaleStatus = 'ON_SALE' | 'HIDDEN'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type ReviewStatus = 'NONE' | 'NEEDS_REVIEW' | 'RESOLVED'

export type PageResult<T> = {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pageCount: number
  }
}

export type DateRangeFilter = { fromDate?: string; toDate?: string }
export type AirlineFilter = { search?: string; status?: AirlineStatus }
export type UserFilter = { search?: string; role?: AdminRole; airlineId?: number; status?: AccountStatus }
export type FlightFilter = {
  search?: string
  airlineId?: number
  departureCode?: string
  arrivalCode?: string
  departureDate?: string
  saleStatus?: SaleStatus
  status?: FlightStatus
}
export type BookingFilter = DateRangeFilter & {
  search?: string
  airlineId?: number
  status?: BookingStatus
  departureDate?: string
}
export type PaymentFilter = DateRangeFilter & {
  search?: string
  airlineId?: number
  status?: PaymentStatus
  reviewStatus?: ReviewStatus
}
export type AuditFilter = DateRangeFilter & {
  actorId?: number
  action?: string
  entityType?: AuditEntityType
}

export type AdminAirline = {
  id: number
  code: string
  name: string
  status: AirlineStatus
  staffCount: number
  onSaleFlightCount: number
  createdAt: string
}

export type AdminUser = {
  id: number
  name: string
  email: string
  role: AdminRole
  airlineId: number | null
  airlineName: string | null
  status: AccountStatus
  lastLoginAt: string | null
}

export type AdminFlight = {
  id: number
  flightNumber: string
  airlineId: number
  airlineName: string
  departureCode: string
  arrivalCode: string
  departureTime: string
  arrivalTime: string
  basePrice: number
  capacity: number
  availableSeats: number
  status: FlightStatus
  saleStatus: SaleStatus
  bookingCount: number
}

export type AdminPassenger = {
  id: number
  fullName: string
  documentNumberMasked: string | null
}

export type AdminBooking = {
  id: number
  bookingCode: string
  flightId: number
  flightNumber: string
  airlineId: number
  airlineName: string
  contactName: string
  contactEmail: string | null
  contactPhoneMasked: string | null
  totalAmount: number
  status: BookingStatus
  expiresAt: string | null
  createdAt: string
  passengers: AdminPassenger[]
  paymentIds: number[]
}

export type AdminPayment = {
  id: number
  bookingId: number
  bookingCode: string
  airlineId: number
  airlineName: string
  providerTransactionId: string | null
  amount: number
  currency: 'VND'
  method: string
  status: PaymentStatus
  reviewStatus: ReviewStatus
  createdAt: string
}

export type AuditEntityType = 'AIRLINE' | 'USER' | 'FLIGHT' | 'BOOKING' | 'PAYMENT'
export type AuditResult = 'SUCCESS' | 'FAILED'
export type AdminAuditLog = {
  id: number
  actorId: number
  actorName: string
  actorRole: AdminRole
  action: string
  entityType: AuditEntityType
  entityId: number
  result: AuditResult
  reason: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

export type AdminDashboard = {
  activeAirlines: number
  activeUsers: number
  lockedUsers: number
  onSaleFlights: number
  hiddenFlights: number
  bookingsByStatus: Record<BookingStatus, number>
  simulatedPaidAmount: number
  failedPayments: number
  needsReviewPayments: number
}

/** Hành động UI sẽ gọi API tương ứng ở giai đoạn backend; reason là bắt buộc. */
export type InterventionAction =
  | 'LOCK_AIRLINE'
  | 'UNLOCK_AIRLINE'
  | 'LOCK_USER'
  | 'UNLOCK_USER'
  | 'HIDE_FLIGHT'
  | 'REOPEN_FLIGHT'
  | 'CANCEL_BOOKING_EXCEPTION'
  | 'MARK_PAYMENT_REVIEW'

export type InterventionRequest = {
  action: InterventionAction
  entityId: number
  reason: string
}
