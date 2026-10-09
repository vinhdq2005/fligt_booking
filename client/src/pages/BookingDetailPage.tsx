
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { mockBookings } from '../mocks/mockBookings'
import { mockFlights } from '../mocks/mockFlights'
import { getStoredBookings } from '../mocks/bookingStorage'
import type { Booking } from '../mocks/mockBookings'
import '../styles/booking-detail.css'

function BookingDetailPage() {
  const navigate = useNavigate()
  const { bookingId } = useParams()

  const [booking, setBooking] = useState<Booking | undefined>(() =>
    mockBookings.find((item) => item.id === bookingId),
  )

  useEffect(() => {
    const storedBooking = getStoredBookings().find(
      (item) => item.id === bookingId,
    )

    const mockBooking = mockBookings.find(
      (item) => item.id === bookingId,
    )

    setBooking(storedBooking || mockBooking)
  }, [bookingId])

  const flight = booking
    ? mockFlights.find((item) => item.id === booking.flightId)
    : undefined

  if (!booking) {
    return (
      <section className="booking-detail-page">
        <div className="booking-detail-card">
          <h1>Không tìm thấy đặt chỗ</h1>
          <p>Đặt chỗ này không tồn tại trong dữ liệu demo.</p>

          <button
            type="button"
            onClick={() => navigate('/my-bookings')}
          >
            Quay lại danh sách
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="booking-detail-page">
      <div className="booking-detail-content">
        <button
          type="button"
          className="back-bookings-button"
          onClick={() => navigate('/my-bookings')}
        >
          ← Quay lại danh sách
        </button>

        <h1>Chi tiết đặt chỗ</h1>

        <div className="booking-detail-card">
          <div className="booking-detail-header">
            <div>
              <span>Mã đặt chỗ</span>
              <h2>{booking.bookingCode}</h2>
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

          <div className="booking-detail-section">
            <h3>Thông tin chuyến bay</h3>

            {flight ? (
              <>
                <p>
                  <strong>Hãng bay:</strong> {flight.airline}
                </p>
                <p>
                  <strong>Số hiệu chuyến bay:</strong>{' '}
                  {flight.flightNumber}
                </p>
                <p>
                  <strong>Hành trình:</strong> {flight.from} → {flight.to}
                </p>
                <p>
                  <strong>Giờ khởi hành:</strong> {flight.departureTime}
                </p>
                <p>
                  <strong>Giờ đến:</strong> {flight.arrivalTime}
                </p>
                <p>
                  <strong>Thời gian bay:</strong> {flight.duration}
                </p>
              </>
            ) : (
              <p>Không tìm thấy thông tin chuyến bay.</p>
            )}
          </div>

          <div className="booking-detail-section">
            <h3>Thông tin đặt chỗ</h3>
            <p>
              <strong>Hành khách:</strong> {booking.passengerName}
            </p>
            <p>
              <strong>Số lượng hành khách:</strong>{' '}
              {booking.passengerCount}
            </p>
            <p>
              <strong>Ngày đi:</strong> {booking.date || 'Chưa chọn'}
            </p>
            <p>
              <strong>Tổng tiền:</strong>{' '}
              {booking.totalPrice.toLocaleString('vi-VN')} ₫
            </p>
          </div>

          {booking.status === 'pending' && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/payment?flightId=${booking.flightId}&passengers=${booking.passengerCount}&date=${booking.date}`,
                )
              }
            >
              Tiếp tục thanh toán
            </button>
          )}

          <p className="booking-detail-note">
            Đây là thông tin minh họa phục vụ việc thử nghiệm giao diện.
          </p>
        </div>
      </div>
    </section>
  )
}

export default BookingDetailPage