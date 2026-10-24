import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getBookingByCode,
  type BookingDetails,
} from '../api'
import '../styles/payment-result.css'

function PaymentResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const status = searchParams.get('status')
  const code = searchParams.get('code') || ''
  const flightId = searchParams.get('flightId') || ''
  const outboundId = searchParams.get('outboundId') || ''
  const inboundId = searchParams.get('inboundId') || ''
  const date = searchParams.get('date') || ''
  const returnDate = searchParams.get('returnDate') || ''
  const isRoundTrip = Boolean(outboundId && inboundId)

  const rawPassengers = Number(searchParams.get('passengers') || '1')
  const passengers = Number.isFinite(rawPassengers)
    ? Math.min(9, Math.max(1, Math.floor(rawPassengers)))
    : 1

  const isSuccess = status === 'success'

  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(isSuccess)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBooking() {
      if (!isSuccess) {
        setLoading(false)
        return
      }

      if (!code) {
        setLoadError('Không tìm thấy mã đặt chỗ trong kết quả thanh toán.')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const result = await getBookingByCode(code)

        if (cancelled) return

        if (result.item) {
          setBooking(result.item)
        } else {
          setLoadError('Không tìm thấy thông tin đặt chỗ.')
        }
      } catch (error) {
        if (cancelled) return

        setLoadError(
          error instanceof Error
            ? error.message
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
  }, [isSuccess, code])

  function formatPrice(value: number): string {
    return `${Number(value).toLocaleString('vi-VN')} ₫`
  }

  function formatTime(value: string): string {
    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
      return '--:--'
    }

    return parsed.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  function formatDate(value: string): string {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <section className="payment-result-page">
      <div className="payment-result-content">
        {isSuccess ? (
          loading ? (
            <>
              <h1>Đang xác nhận đặt chỗ</h1>
              <p>Đang tải thông tin từ máy chủ...</p>
            </>
          ) : loadError || !booking ? (
            <>
              <div className="result-icon failure">!</div>
              <h1>Không tải được thông tin đặt chỗ</h1>
              <p role="alert">
                {loadError || 'Không tìm thấy dữ liệu đặt chỗ.'}
              </p>
              <p>
                Mã đặt chỗ: <strong>{code || 'Chưa có'}</strong>
              </p>
              <p>
                Nếu thanh toán đã hoàn tất, hãy thử tải lại trang hoặc kiểm tra
                kết nối backend.
              </p>
              <div className="result-actions">
                <button type="button" onClick={() => window.location.reload()}>
                  Tải lại
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/my-bookings')}
                >
                  Xem đặt chỗ
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="result-icon success">✓</div>

              <h1>Thanh toán thành công</h1>
              <p>Thông tin đặt chỗ được lấy từ backend.</p>

              <div className="booking-code">
                <span>Mã đặt chỗ</span>
                <strong>{booking.bookingCode}</strong>
              </div>

              <div className="result-info">
                {isRoundTrip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                        ✈ CHIỀU ĐI
                      </span>
                      <p style={{ margin: '6px 0 2px' }}><strong>Hãng:</strong> {booking.flight.airline.name}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Chuyến bay:</strong> {booking.flight.flightNumber}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Hành trình:</strong> {booking.flight.departureCode} → {booking.flight.arrivalCode}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Khởi hành:</strong> {formatTime(booking.flight.departureTime)} ({date ? formatDate(date) : booking.flight.departureTime.slice(0, 10)})</p>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                        🛬 CHIỀU VỀ
                      </span>
                      <p style={{ margin: '6px 0 2px' }}><strong>Hãng:</strong> {booking.flight.airline.name}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Chuyến bay:</strong> {booking.flight.flightNumber}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Hành trình:</strong> {booking.flight.arrivalCode} → {booking.flight.departureCode}</p>
                      <p style={{ margin: '0 0 2px' }}><strong>Ngày về:</strong> {returnDate ? formatDate(returnDate) : 'Chưa chọn'}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>
                      <strong>Hãng hàng không:</strong>{' '}
                      {booking.flight.airline.name}
                    </p>

                    <p>
                      <strong>Chuyến bay:</strong>{' '}
                      {booking.flight.flightNumber}
                    </p>

                    <p>
                      <strong>Hành trình:</strong>{' '}
                      {booking.flight.departureCode} →{' '}
                      {booking.flight.arrivalCode}
                    </p>

                    <p>
                      <strong>Giờ khởi hành:</strong>{' '}
                      {formatTime(booking.flight.departureTime)}
                    </p>

                    <p>
                      <strong>Ngày đi:</strong>{' '}
                      {date || booking.flight.departureTime.slice(0, 10)}
                    </p>
                  </>
                )}

                <p>
                  <strong>Số hành khách:</strong>{' '}
                  {booking.passengers.length} người
                </p>

                <p>
                  <strong>Người liên hệ:</strong> {booking.contactName}
                </p>

                <p>
                  <strong>Tổng tiền:</strong>{' '}
                  {formatPrice(booking.totalAmount)}
                </p>

                <p>
                  <strong>Trạng thái đặt chỗ:</strong>{' '}
                  {booking.status}
                </p>

                <p>
                  <strong>Trạng thái thanh toán:</strong>{' '}
                  {booking.payments.some(
                    (payment) => payment.status.toUpperCase() === 'SUCCESS',
                  )
                    ? 'Đã thanh toán'
                    : booking.status.toUpperCase() === 'CONFIRMED'
                      ? 'Đã xác nhận'
                      : booking.payments.length > 0
                        ? booking.payments[booking.payments.length - 1].status
                        : 'Chưa có thông tin thanh toán'}
                </p>

                <div>
                  <strong>Danh sách hành khách:</strong>
                  <ul>
                    {booking.passengers.map((passenger) => (
                      <li key={passenger.id}>
                        {passenger.fullName}
                        {passenger.ticket
                          ? ` — Mã vé: ${passenger.ticket.ticketCode}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="result-actions">
                <button type="button" onClick={() => navigate('/')}>
                  Về trang chủ
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/my-bookings')}
                >
                  Xem đặt chỗ
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <div className="result-icon failure">!</div>

            <h1>Thanh toán thất bại</h1>
            <p>Giao dịch mô phỏng chưa hoàn tất.</p>

            <div className="result-info">
              <p>
                <strong>Số hành khách:</strong> {passengers} người
              </p>
              <p>
                <strong>Ngày đi:</strong> {date ? formatDate(date) : 'Chưa chọn'}
              </p>
              {isRoundTrip && (
                <p>
                  <strong>Ngày về:</strong> {returnDate ? formatDate(returnDate) : 'Chưa chọn'}
                </p>
              )}
              <p>
                Bạn có thể quay lại bước thanh toán để thử lại.
              </p>
              <p>
                Nếu một mã đặt chỗ đã được tạo ở lần thử trước, hệ thống sẽ
                kiểm tra mã tạm đã lưu để tránh tạo thêm đặt chỗ không cần thiết.
              </p>
            </div>

            <div className="result-actions">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isRoundTrip
                      ? `/payment?outboundId=${encodeURIComponent(outboundId)}&inboundId=${encodeURIComponent(inboundId)}&passengers=${passengers}&date=${encodeURIComponent(date)}&returnDate=${encodeURIComponent(returnDate)}`
                      : `/payment?flightId=${encodeURIComponent(flightId)}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
                  )
                }
              >
                Thử lại thanh toán
              </button>

              <button type="button" onClick={() => navigate('/')}>
                Về trang chủ
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default PaymentResultPage