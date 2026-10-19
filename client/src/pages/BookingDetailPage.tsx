
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getBookingByCode, type BookingDetails } from '../api'
import '../styles/booking-detail.css'

type TicketInfo = {
  id?: number | string
  ticketCode?: string | null
  qrToken?: string | null
  status?: string | null
}

type PassengerWithTicket = BookingDetails['passengers'][number] & {
  ticket?: TicketInfo | null
}

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
      case 'ISSUED':
        return 'Đã phát hành'
      case 'USED':
        return 'Đã check-in'
      case 'REFUNDED':
        return 'Đã hoàn tiền'
      default:
        return status || 'Chưa xác định'
    }
  }

  function getStatusClass(status: string) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'ISSUED':
        return 'booking-status-paid'
      case 'USED':
        return 'booking-status-used'
      case 'CANCELLED':
      case 'EXPIRED':
      case 'REFUNDED':
        return 'booking-status-cancelled'
      default:
        return 'booking-status-pending'
    }
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

  const passengers = booking.passengers as PassengerWithTicket[]

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
              {passengers.length}
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
            <h3>Vé điện tử và mã QR</h3>

            {booking.status.toUpperCase() !== 'CONFIRMED' ? (
              <p>
                Vé điện tử và QR sẽ hiển thị khi đặt chỗ được xác nhận
                và vé đã được phát hành.
              </p>
            ) : passengers.some(
                (passenger) =>
                  passenger.ticket?.qrToken &&
                  passenger.ticket?.ticketCode,
              ) ? (
              <div className="customer-tickets">
                {passengers.map((passenger, index) => {
                  const ticket = passenger.ticket
                  const qrToken = ticket?.qrToken
                  const ticketCode = ticket?.ticketCode

                  return (
                    <article
                      className="customer-ticket"
                      key={ticket?.id ?? ticketCode ?? passenger.id ?? index}
                    >
                      <h4>Hành khách {index + 1}</h4>

                      <p>
                        <strong>Họ và tên:</strong>{' '}
                        {passenger.fullName}
                      </p>

                      {ticketCode && (
                        <p>
                          <strong>Mã vé:</strong> {ticketCode}
                        </p>
                      )}

                      {ticket?.status && (
                        <p>
                          <strong>Trạng thái vé:</strong>{' '}
                          {getStatusLabel(ticket.status)}
                        </p>
                      )}

                      {qrToken && ticketCode ? (
                        <div className="customer-ticket-qr">
                          <QRCodeSVG
                            value={qrToken}
                            size={200}
                            level="M"
                            includeMargin
                            title={`QR vé ${ticketCode}`}
                          />
                          <p>QR vé điện tử</p>
                          <small>
                            Xuất trình mã QR này cho nhân viên hãng bay
                            khi làm thủ tục.
                          </small>
                        </div>
                      ) : (
                        <p>
                          Vé này chưa có QR. Vui lòng tải lại sau khi vé
                          được phát hành.
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p>
                Đặt chỗ đã xác nhận nhưng dữ liệu QR chưa có trong thông
                tin vé trả về từ máy chủ. Cần kiểm tra API chi tiết đặt
                chỗ để bổ sung qrToken.
              </p>
            )}
          </div>

          <div className="booking-detail-section">
            <h3>Danh sách hành khách</h3>

            {passengers.length > 0 ? (
              <ul>
                {passengers.map((passenger, index) => (
                  <li key={passenger.id ?? index}>
                    <strong>{passenger.fullName}</strong>

                    {passenger.ticket?.ticketCode && (
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
                  `/payment?flightId=${encodeURIComponent(
                    String(
                      (
                        booking as BookingDetails & {
                          flightId?: number
                        }
                      ).flightId ?? '',
                    ),
                  )}&passengers=${passengers.length}&date=${encodeURIComponent(
                    booking.flight.departureTime.slice(0, 10),
                  )}`,
                )
              }
            >
              Tiếp tục thanh toán
            </button>
          )}

          <p className="booking-detail-note">
            Thông tin đặt chỗ và vé được tải từ hệ thống backend.
          </p>
        </div>
      </div>
    </section>
  )
}

export default BookingDetailPage
