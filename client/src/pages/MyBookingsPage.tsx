
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookingByCode, type BookingDetails } from '../api'
import '../styles/my-bookings.css'

const BOOKING_CODES_KEY = 'flight-booking-codes'

function MyBookingsPage() {
  const navigate = useNavigate()

  const [bookings, setBookings] = useState<BookingDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBookings() {
      setLoading(true)
      setError('')

      try {
        const savedCodes: unknown = JSON.parse(
          localStorage.getItem(BOOKING_CODES_KEY) || '[]',
        )

        const codes = Array.isArray(savedCodes)
          ? [...new Set(
              savedCodes.filter(
                (code): code is string =>
                  typeof code === 'string' && code.trim().length > 0,
              ),
            )]
          : []

        if (codes.length === 0) {
          if (!cancelled) {
            setBookings([])
            setLoading(false)
          }
          return
        }

        const results = await Promise.allSettled(
          codes.map((code) => getBookingByCode(code)),
        )

        if (cancelled) return

        const loadedBookings = results
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              item: BookingDetails
            }> => result.status === 'fulfilled',
          )
          .map((result) => result.value.item)
          .filter(Boolean)

        setBookings(loadedBookings)

        if (loadedBookings.length === 0) {
          setError(
            'Không thể tải thông tin đặt chỗ. Hãy kiểm tra backend và kết nối cơ sở dữ liệu.',
          )
        } else if (loadedBookings.length < codes.length) {
          setError(
            'Một số đặt chỗ không tải được. Danh sách bên dưới chỉ hiển thị các đặt chỗ lấy được từ máy chủ.',
          )
        }
      } catch {
        if (!cancelled) {
          setError(
            'Không thể đọc danh sách mã đặt chỗ đã lưu trên trình duyệt.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadBookings()

    return () => {
      cancelled = true
    }
  }, [])

  function formatPrice(value: number) {
    return `${Number(value).toLocaleString('vi-VN')} ₫`
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
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return 'booking-status-paid'
      case 'PENDING':
        return 'booking-status-pending'
      default:
        return 'booking-status-pending'
    }
  }

  return (
    <section className="my-bookings-page">
      <div className="my-bookings-content">
        <h1>Đặt chỗ của tôi</h1>

        <p>
          Thông tin đặt chỗ được tải từ hệ thống backend.
        </p>

        {loading ? (
          <div className="empty-bookings">
            <p>Đang tải danh sách đặt chỗ...</p>
          </div>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : null}

        {!loading && bookings.length === 0 ? (
          <div className="empty-bookings">
            <h2>Bạn chưa có đặt chỗ nào</h2>
            <p>
              Nếu bạn đã đặt vé trước đó, hãy kiểm tra mã đặt chỗ hoặc
              thử lại sau khi backend hoạt động.
            </p>

            <button
              type="button"
              onClick={() => navigate('/')}
            >
              Tìm chuyến bay
            </button>
          </div>
        ) : (
          <div className="my-bookings-list">
            {bookings.map((booking) => (
              <article
                className="my-booking-card"
                key={booking.bookingCode}
              >
                <div className="my-booking-header">
                  <div>
                    <span>Mã đặt chỗ</span>
                    <strong>{booking.bookingCode}</strong>
                  </div>

                  <span
                    className={`booking-status ${getStatusClass(booking.status)}`}
                  >
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="my-booking-info">
                  <p>
                    <strong>Chuyến bay:</strong>{' '}
                    {booking.flight.airline.name}{' '}
                    {booking.flight.flightNumber}
                  </p>

                  <p>
                    <strong>Hành trình:</strong>{' '}
                    {booking.flight.departureCode} →{' '}
                    {booking.flight.arrivalCode}
                  </p>

                  <p>
                    <strong>Ngày đi:</strong>{' '}
                    {booking.flight.departureTime.slice(0, 10)}
                  </p>

                  <p>
                    <strong>Hành khách:</strong>{' '}
                    {booking.passengers.length} người
                  </p>

                  <p>
                    <strong>Tổng tiền:</strong>{' '}
                    {formatPrice(booking.totalAmount)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/my-bookings/${encodeURIComponent(booking.bookingCode)}`,
                    )
                  }
                >
                  Xem chi tiết
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default MyBookingsPage