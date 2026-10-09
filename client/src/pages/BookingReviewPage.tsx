
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { mockFlights } from '../mocks/mockFlights'
import '../styles/booking-review.css'

function BookingReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || 'flight-001'
  const passengers = Math.max(
    1,
    Number(searchParams.get('passengers') || '1'),
  )
  const date = searchParams.get('date') || ''

  const flight = mockFlights.find(
    (item) => item.id === flightId,
  )

  if (!flight) {
    return (
      <section className="booking-review-page">
        <div className="booking-review-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>Vui lòng quay lại và chọn chuyến bay khác.</p>
          <button
            type="button"
            onClick={() => navigate('/flights/results')}
          >
            Quay lại kết quả
          </button>
        </div>
      </section>
    )
  }

  const fromAirport = mockAirports.find(
    (airport) => airport.code === flight.from,
  )
  const toAirport = mockAirports.find(
    (airport) => airport.code === flight.to,
  )

  const totalPrice = flight.price * passengers

  return (
    <section className="booking-review-page">
      <div className="booking-review-content">
        <h1>Xem lại thông tin đặt vé</h1>

        <p className="demo-notice">
          Vui lòng kiểm tra thông tin trước khi tiếp tục thanh toán.
        </p>

        <div className="booking-review-card">
          <div className="review-section">
            <h2>Chuyến bay</h2>

            <div className="review-flight">
              <div>
                <strong>{flight.airline}</strong>
                <span>{flight.flightNumber}</span>
              </div>

              <div className="review-route">
                <div>
                  <strong>{flight.departureTime}</strong>
                  <span>{fromAirport?.city} ({flight.from})</span>
                </div>

                <div className="review-duration">
                  <span>{flight.duration}</span>
                  <span>→</span>
                </div>

                <div>
                  <strong>{flight.arrivalTime}</strong>
                  <span>{toAirport?.city} ({flight.to})</span>
                </div>
              </div>

              <p>Ngày đi: {date || 'Chưa chọn'}</p>
            </div>
          </div>

          <div className="review-section">
            <h2>Hành khách</h2>

            <div className="passenger-summary">
              <div>
                <span>Số hành khách</span>
                <strong>{passengers} người</strong>
              </div>

              <div>
                <span>Ghế</span>
                <strong>{passengers} chỗ</strong>
              </div>
            </div>

            <p className="review-note">
              Thông tin hành khách là dữ liệu minh họa phục vụ trình diễn.
            </p>
          </div>

          <div className="review-section price-section">
            <h2>Chi phí</h2>

            <div className="price-row">
              <span>Giá vé / người</span>
              <strong>{flight.price.toLocaleString('vi-VN')} ₫</strong>
            </div>

            <div className="price-row">
              <span>Số hành khách</span>
              <strong>{passengers}</strong>
            </div>

            <div className="total-row">
              <span>Tổng cộng</span>
              <strong>{totalPrice.toLocaleString('vi-VN')} ₫</strong>
            </div>
          </div>

          <div className="review-actions">
            <button
              type="button"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>

            <button
              type="button"
              className="continue-button"
              onClick={() =>
                navigate(
                  `/payment?flightId=${flight.id}&passengers=${passengers}&date=${date}`,
                )
              }
            >
              Tiếp tục thanh toán
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BookingReviewPage