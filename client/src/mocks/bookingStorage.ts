
import type { Booking } from './mockBookings'

const STORAGE_KEY = 'flight-booking-demo'

export function getStoredBookings(): Booking[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)

    if (!data) {
      return []
    }

    const parsed: unknown = JSON.parse(data)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is Booking =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.bookingCode === 'string' &&
        typeof item.flightId === 'string' &&
        typeof item.passengerName === 'string' &&
        typeof item.passengerCount === 'number' &&
        typeof item.totalPrice === 'number' &&
        (item.status === 'paid' || item.status === 'pending') &&
        typeof item.date === 'string',
    )
  } catch {
    return []
  }
}

export function saveBooking(booking: Booking): void {
  const bookings = getStoredBookings()

  const existingIndex = bookings.findIndex(
    (item) => item.bookingCode === booking.bookingCode,
  )

  if (existingIndex !== -1) {
    return
  }

  bookings.unshift(booking)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings))
}