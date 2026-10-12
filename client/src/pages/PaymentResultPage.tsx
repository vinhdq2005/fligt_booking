
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockFlights } from '../mocks/mockFlights'
import { saveBooking } from '../mocks/bookingStorage'
import type { Booking } from '../mocks/mockBookings'
import '../styles/payment-result.css'

function PaymentResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const status = searchParams.get('status')
  const flightId = searchParams.get('flightId') || 'flight-001'

  const rawPassengers = Number(searchParams.get('passengers') || '1')
  const passengers = Number.isFinite(rawPassengers)
    ? Math.min(9, Math.max(1, Math.floor(rawPassengers)))
    : 1

  const date = searchParams.get('date') || ''
  const isSuccess = status === 'success'

  const flight = mockFlights.find(
    (item) => item.id === flightId,
  )

  const totalPrice = flight ? flight.price * passengers : 0
  const bookingCode = `FB${flightId.replace('flight-', '')}2026`

  useEffect(() => {
    if (!isSuccess || !flight) {
      return
    }

    const booking: Booking = {
      id: `booking-${bookingCode}`,
      bookingCode,
      flightId: flight.id,
      passengerName: 'Người dùng demo',
      passengerCount: passengers,
      totalPrice,
      status: 'paid',
      date,
    }

    saveBooking(booking)
  }, [
    isSuccess,
    flight,
    bookingCode,
    passengers,
    totalPrice,
    date,
  ])

  return (
    <section className="payment-result-page">
      <div className="payment-result-content">
        {isSuccess ? (
          <>
            <div className="result-icon success">✓</div>

            <h1>Thanh toán thành công</h1>

            <p>Đặt vé demo của bạn đã được ghi nhận.</p>

            <div className="booking-code">
              <span>Mã đặt chỗ demo</span>
              <strong>{bookingCode}</strong>
            </div>

            <div className="result-info">
              <p>
                <strong>Chuyến bay:</strong>{' '}
                {flight
                  ? `${flight.airline} ${flight.flightNumber}`
                  : 'Không xác định'}
              </p>

              <p>
                <strong>Ngày đi:</strong> {date || 'Chưa chọn'}
              </p>

              <p>
                <strong>Số hành khách:</strong> {passengers} người
              </p>

              <p>
                <strong>Tổng tiền:</strong>{' '}
                {totalPrice.toLocaleString('vi-VN')} ₫
              </p>

              <p>
                <strong>Trạng thái:</strong> Thanh toán demo thành công
              </p>

              <p>
                <strong>Lưu ý:</strong> Mã đặt chỗ và kết quả chỉ phục vụ trình diễn.
              </p>
            </div>

            <div className="result-actions">
              <button
                type="button"
                onClick={() => navigate('/')}
              >
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
        ) : (
          <>
            <div className="result-icon failure">!</div>

            <h1>Thanh toán thất bại</h1>

            <p>Thanh toán demo chưa thành công.</p>

            <div className="result-info">
              <p>
                <strong>Chuyến bay:</strong>{' '}
                {flight
                  ? `${flight.airline} ${flight.flightNumber}`
                  : 'Không xác định'}
              </p>

              <p>
                <strong>Số hành khách:</strong> {passengers} người
              </p>

              <p>
                <strong>Tổng tiền dự kiến:</strong>{' '}
                {totalPrice.toLocaleString('vi-VN')} ₫
              </p>

              <p>Bạn có thể quay lại bước thanh toán để thử lại.</p>
            </div>

            <div className="result-actions">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/payment?flightId=${flightId}&passengers=${passengers}&date=${date}`,
                  )
                }
              >
                Thử lại thanh toán
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
              >
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