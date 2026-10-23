
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBookingByCode, type BookingDetails } from '../api'
import '../styles/booking-detail.css'

function BookingDetailPage() {
  const navigate = useNavigate()
  const { bookingId } = useParams()

  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBooking() {
      if (!bookingId) {
        setError('Không tìm thấy mã đặt chỗ trên đường dẫn.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await getBookingByCode(bookingId)

        if (cancelled) return

        if (result.item) {
          setBooking(result.item)
        } else {
          setError('Không tìm thấy đặt chỗ trong cơ sở dữ liệu.')
        }
      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải thông tin đặt chỗ từ máy chủ.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadBooking()

    return () => {
      cancelled = true
    }
  }, [bookingId])

  function formatPrice(value: number) {
    return `${Number(value).toLocaleString('vi-VN')} ₫`
  }

  function formatDateTime(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value || 'Chưa có thông tin'
    }

    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  function getStatusLabel(status: string) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return 'Đã xác nhận'
      case 'PENDING':
        return 'Chờ thanh toán'
      case 'CANCELLED':
        return 'Đã hủy'
      case 'EXPIRED':
        return 'Đã hết hạn'
      default:
        return status
    }
  }

  function getStatusClass(status: string) {
    return status.toUpperCase() === 'CONFIRMED'
      ? 'booking-status-paid'
      : 'booking-status-pending'
  }

  if (loading) {
    return (
      <section className="booking-detail-page">
        <div className="booking-detail-card">
          <p>Đang tải thông tin đặt chỗ...</p>
        </div>
      </section>
    )
  }

  if (error || !booking) {
    return (
      <section className="booking-detail-page">
        <div className="booking-detail-card">
          <h1>Không tải được đặt chỗ</h1>
          <p role="alert">
            {error || 'Không tìm thấy đặt chỗ trong cơ sở dữ liệu.'}
          </p>

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
              className={`booking-status ${getStatusClass(booking.status)}`}
            >
              {getStatusLabel(booking.status)}
            </span>
          </div>

          <div className="booking-detail-section">
            <h3>Thông tin chuyến bay</h3>

            <p>
              <strong>Hãng bay:</strong>{' '}
              {booking.flight.airline.name}
            </p>

            <p>
              <strong>Số hiệu chuyến bay:</strong>{' '}
              {booking.flight.flightNumber}
            </p>

            <p>
              <strong>Hành trình:</strong>{' '}
              {booking.flight.departureCode} →{' '}
              {booking.flight.arrivalCode}
            </p>

            <p>
              <strong>Giờ khởi hành:</strong>{' '}
              {formatDateTime(booking.flight.departureTime)}
            </p>

            <p>
              <strong>Giờ đến:</strong>{' '}
              {formatDateTime(booking.flight.arrivalTime)}
            </p>
          </div>

          <div className="booking-detail-section">
            <h3>Thông tin đặt chỗ</h3>

            <p>
              <strong>Người liên hệ:</strong>{' '}
              {booking.contactName}
            </p>

            <p>
              <strong>Số lượng hành khách:</strong>{' '}
              {booking.passengers.length}
            </p>

            <p>
              <strong>Tổng tiền:</strong>{' '}
              {formatPrice(booking.totalAmount)}
            </p>

            <p>
              <strong>Ngày tạo đặt chỗ:</strong>{' '}
              {formatDateTime(booking.createdAt)}
            </p>

            <p>
              <strong>Hạn thanh toán:</strong>{' '}
              {formatDateTime(booking.expiresAt)}
            </p>
          </div>

          <div className="booking-detail-section">
            <h3>Danh sách hành khách</h3>

            {booking.passengers.length > 0 ? (
              <ul>
                {booking.passengers.map((passenger) => (
                  <li key={passenger.id}>
                    <strong>{passenger.fullName}</strong>

                    {passenger.ticket && (
                      <span>
                        {' '}— Mã vé: {passenger.ticket.ticketCode}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có thông tin hành khách.</p>
            )}
          </div>

          <div className="booking-detail-section">
            <h3>Thông tin thanh toán</h3>

            {booking.payments.length > 0 ? (
              booking.payments.map((payment, index) => (
                <div key={`${payment.createdAt}-${index}`}>
                  <p>
                    <strong>Số tiền:</strong>{' '}
                    {formatPrice(payment.amount)}
                  </p>
                  <p>
                    <strong>Phương thức:</strong> {payment.method}
                  </p>
                  <p>
                    <strong>Trạng thái:</strong> {payment.status}
                  </p>
                  <p>
                    <strong>Thời gian:</strong>{' '}
                    {formatDateTime(payment.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p>Chưa có thông tin thanh toán.</p>
            )}
          </div>

          {booking.status.toUpperCase() === 'PENDING' && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/payment?flightId=${encodeURIComponent(String(
                    // Cần dùng ID chuyến bay của booking nếu API trả về trường này.
                    (booking as BookingDetails & { flightId?: number }).flightId ?? '',
                  ))}&passengers=${booking.passengers.length}&date=${encodeURIComponent(
                    booking.flight.departureTime.slice(0, 10),
                  )}`,
                )
              }
            >
              Tiếp tục thanh toán
            </button>
          )}

          <p className="booking-detail-note">
            Thông tin đặt chỗ được tải từ hệ thống backend.
          </p>
        </div>
      </div>
    </section>
  )
}

export default BookingDetailPage