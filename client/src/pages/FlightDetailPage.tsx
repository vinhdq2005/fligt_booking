import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { mockFlights } from '../mocks/mockFlights'
import '../styles/flight-detail.css'

function FlightDetailPage() {
  const navigate = useNavigate()
  const { flightId } = useParams()
  const [searchParams] = useSearchParams()

  const passengers = Number(
    searchParams.get('passengers') || '1',
  )

  const date = searchParams.get('date') || ''

  const flight = mockFlights.find(
    (item) => item.id === flightId,
  )

  if (!flight) {
    return (
      <section className="flight-detail-page">
        <div className="flight-detail-content">
          <h1>Không tìm thấy chuyến bay</h1>

          <p>
            Chuyến bay bạn đang tìm kiếm không tồn tại.
          </p>

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

  const isEnoughSeats =
    flight.availableSeats >= passengers

  const totalPrice =
    flight.price * passengers

  const handleContinue = () => {
    if (!isEnoughSeats) {
      return
    }

    navigate(
      `/booking/passengers?flightId=${flight.id}&passengers=${passengers}&date=${date}`,
    )
  }

  return (
    <section className="flight-detail-page">
      <div className="flight-detail-content">
        <h1>Chi tiết chuyến bay</h1>

        <div className="flight-detail-card">
          <div className="flight-detail-header">
            <div>
              <h2>{flight.airline}</h2>

              <p>{flight.flightNumber}</p>
            </div>

            <div className="flight-detail-price">
              {flight.price.toLocaleString('vi-VN')} ₫
              <small> / người</small>
            </div>
          </div>

          <div className="flight-detail-route">
            <div>
              <strong>
                {flight.departureTime}
              </strong>

              <span>
                {fromAirport?.city} ({flight.from})
              </span>

              <small>
                {fromAirport?.name}
              </small>
            </div>

            <div className="flight-detail-duration">
              <span>{flight.duration}</span>
              <span>→</span>
            </div>

            <div>
              <strong>
                {flight.arrivalTime}
              </strong>

              <span>
                {toAirport?.city} ({flight.to})
              </span>

              <small>
                {toAirport?.name}
              </small>
            </div>
          </div>

          <div className="flight-detail-info">
            <p>
              <strong>Ngày đi:</strong>{' '}
              {date || 'Chưa chọn'}
            </p>

            <p>
              <strong>Số hành khách:</strong>{' '}
              {passengers} người
            </p>

            <p>
              <strong>Số chỗ còn lại:</strong>{' '}
              {flight.availableSeats} chỗ
            </p>

            <p>
              <strong>Tổng tiền:</strong>{' '}
              {totalPrice.toLocaleString('vi-VN')} ₫
            </p>

            <p>
              <strong>Trạng thái:</strong>{' '}
              {isEnoughSeats
                ? 'Có thể đặt'
                : 'Không đủ chỗ'}
            </p>

            <p>
              <strong>Lưu ý:</strong>{' '}
              Đây là dữ liệu minh họa phục vụ
              trình diễn.
            </p>
          </div>

          {!isEnoughSeats && (
            <p className="demo-notice">
              Chuyến bay không còn đủ chỗ cho số
              hành khách đã chọn.
            </p>
          )}

          <button
            type="button"
            className="booking-button"
            disabled={!isEnoughSeats}
            onClick={handleContinue}
          >
            Tiếp tục đặt vé
          </button>
        </div>
      </div>
    </section>
  )
}

export default FlightDetailPage