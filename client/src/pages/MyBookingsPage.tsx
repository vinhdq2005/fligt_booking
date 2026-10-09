
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockFlights } from '../mocks/mockFlights'
import { mockBookings } from '../mocks/mockBookings'
import { getStoredBookings } from '../mocks/bookingStorage'
import type { Booking } from '../mocks/mockBookings'
import '../styles/my-bookings.css'

function MyBookingsPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>(mockBookings)

  useEffect(() => {
    const storedBookings = getStoredBookings()

    const mergedBookings = [
      ...storedBookings,
      ...mockBookings.filter(
        (mockBooking) =>
          !storedBookings.some(
            (storedBooking) =>
              storedBooking.bookingCode === mockBooking.bookingCode,
          ),
      ),
    ]

    setBookings(mergedBookings)
  }, [])

  return (
    <section className="my-bookings-page">
      <div className="my-bookings-content">
        <h1>Đặt chỗ của tôi</h1>

        <p className="demo-notice">
          Danh sách đặt chỗ minh họa được lưu trên trình duyệt.
        </p>

        {bookings.length === 0 ? (
          <div className="empty-bookings">
            <h2>Bạn chưa có đặt chỗ nào</h2>
            <p>Hãy tìm chuyến bay để bắt đầu hành trình.</p>

            <button
              type="button"
              onClick={() => navigate('/')}
            >
              Tìm chuyến bay
            </button>
          </div>
        ) : (
          <div className="my-bookings-list">
            {bookings.map((booking) => {
              const flight = mockFlights.find(
                (item) => item.id === booking.flightId,
              )

              return (
                <article
                  className="my-booking-card"
                  key={booking.id}
                >
                  <div className="my-booking-header">
                    <div>
                      <span>Mã đặt chỗ</span>
                      <strong>{booking.bookingCode}</strong>
                    </div>

                    <span
                      className={`booking-status ${
                        booking.status === 'paid'
                          ? 'booking-status-paid'
                          : 'booking-status-pending'
                      }`}
                    >
                      {booking.status === 'paid'
                        ? 'Đã thanh toán'
                        : 'Chưa thanh toán'}
                    </span>
                  </div>

                  <div className="my-booking-info">
                    <p>
                      <strong>Chuyến bay:</strong>{' '}
                      {flight
                        ? `${flight.airline} ${flight.flightNumber}`
                        : 'Không xác định'}
                    </p>

                    <p>
                      <strong>Ngày đi:</strong>{' '}
                      {booking.date || 'Chưa chọn'}
                    </p>

                    <p>
                      <strong>Hành khách:</strong>{' '}
                      {booking.passengerCount} người
                    </p>

                    <p>
                      <strong>Tổng tiền:</strong>{' '}
                      {booking.totalPrice.toLocaleString('vi-VN')} ₫
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/my-bookings/${booking.id}`)
                    }
                  >
                    Xem chi tiết
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default MyBookingsPage