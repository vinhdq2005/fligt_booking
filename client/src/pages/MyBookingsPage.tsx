import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookingByCode, type BookingDetails } from '../api'
import '../styles/my-bookings.css'

function MyBookingsPage() {
  const navigate = useNavigate()

  const [bookingCode, setBookingCode] = useState('')
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  function formatPrice(value: number) {
    return `${Number(value).toLocaleString('vi-VN')} ₫`
  }

  function formatDate(value: string) {
    if (!value) return 'Chưa có thông tin'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return date.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
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
        return status || 'Chưa xác định'
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

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = bookingCode.trim()

    if (!code) {
      setError('Vui lòng nhập mã đặt chỗ.')
      setBooking(null)
      setSearched(true)
      return
    }

    setLoading(true)
    setError('')
    setBooking(null)
    setSearched(true)

    try {
      const result = await getBookingByCode(code)
      if (result?.item) {
        setBooking(result.item)
      } else {
        setError('Không tìm thấy đặt chỗ với mã này. Vui lòng kiểm tra lại.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tra cứu đặt chỗ.'
      setError(
        message.toLowerCase().includes('404')
          ? 'Không tìm thấy đặt chỗ với mã này. Vui lòng kiểm tra lại.'
          : 'Không thể tra cứu đặt chỗ lúc này. Vui lòng thử lại sau.',
      )
    } finally {
      setLoading(false)
    }
  }

  function clearSearch() {
    setBookingCode('')
    setBooking(null)
    setError('')
    setSearched(false)
  }

  return (
    <div className="modern-lookup-container">
      <div className="modern-lookup-hero">
        <div className="lookup-card-glass">
          <div className="lookup-left-info">
            <h1>Tra cứu đặt chỗ</h1>
            <p>Nhập mã đặt chỗ để xem thông tin chuyến bay, hành khách và vé điện tử.</p>
            
            <div className="lookup-features">
              <div className="feature-item">
                <span className="feature-icon">📅</span>
                <span>Thông tin chuyến bay</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">👤</span>
                <span>Thông tin hành khách</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎫</span>
                <span>Vé điện tử</span>
              </div>
            </div>
          </div>

          <div className="lookup-right-form">
            <form onSubmit={handleSearch} className="glass-form-box">
              <label htmlFor="booking-code">Mã đặt chỗ</label>
              <div className="input-group-modern">
                <input
                  id="booking-code"
                  type="text"
                  value={bookingCode}
                  onChange={(event) => setBookingCode(event.target.value.toUpperCase())}
                  placeholder="VD: MYCKG8"
                  autoComplete="off"
                  required
                />
              </div>
              <button type="submit" className="btn-modern-lookup" disabled={loading}>
                {loading ? 'Đang tra cứu...' : 'Tra cứu'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <div className="lookup-alert error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="lookup-alert">
          <p>Đang tải thông tin đặt chỗ...</p>
        </div>
      )}

      {booking && !loading && (
        <div className="my-bookings-list" style={{ maxWidth: '900px', margin: '30px auto', padding: '0 20px' }}>
          <article className="my-booking-card">
            <div className="my-booking-header">
              <div>
                <span>Mã đặt chỗ</span>
                <strong>{booking.bookingCode}</strong>
              </div>
              <span className={`booking-status ${getStatusClass(booking.status)}`}>
                {getStatusLabel(booking.status)}
              </span>
            </div>

            <div className="my-booking-info">
              <p><strong>Hãng bay:</strong> {booking.flight.airline.name}</p>
              <p><strong>Chiều đi:</strong> {booking.flight.flightNumber}</p>
              <p><strong>Hành trình chiều đi:</strong> {booking.flight.departureCode} → {booking.flight.arrivalCode}</p>
              <p><strong>Ngày đi:</strong> {formatDate(booking.flight.departureTime)}</p>

              {booking.returnFlight && (
                <>
                  <p><strong>Chiều về:</strong> {booking.returnFlight.flightNumber} · {booking.returnFlight.airline.name}</p>
                  <p><strong>Hành trình chiều về:</strong> {booking.returnFlight.departureCode} → {booking.returnFlight.arrivalCode}</p>
                  <p><strong>Ngày về:</strong> {formatDate(booking.returnFlight.departureTime)}</p>
                </>
              )}

              <p><strong>Hành khách:</strong> {booking.passengers.length} người</p>
              <p><strong>Tổng tiền:</strong> {formatPrice(booking.totalAmount)}</p>
            </div>

            <div className="booking-lookup-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate(`/my-bookings/${encodeURIComponent(booking.bookingCode)}`)}
              >
                Xem chi tiết
              </button>
              <button type="button" className="outline-button" onClick={clearSearch}>
                Tra cứu mã khác
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default MyBookingsPage
