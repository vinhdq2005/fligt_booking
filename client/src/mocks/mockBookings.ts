
export type Booking = {
  id: string
  bookingCode: string
  flightId: string
  passengerName: string
  passengerCount: number
  totalPrice: number
  status: 'paid' | 'pending'
  date: string
}

export const mockBookings: Booking[] = [
  {
    id: 'booking-001',
    bookingCode: 'FB20261007',
    flightId: 'flight-001',
    passengerName: 'Người dùng demo',
    passengerCount: 1,
    totalPrice: 1500000,
    status: 'paid',
    date: '2026-10-10',
  },
  {
    id: 'booking-002',
    bookingCode: 'FB20261008',
    flightId: 'flight-003',
    passengerName: 'Người dùng demo',
    passengerCount: 2,
    totalPrice: 1900000,
    status: 'pending',
    date: '2026-10-12',
  },
]