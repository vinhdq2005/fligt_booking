import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { mockFlights } from '../mocks/mockFlights'
import '../styles/flight-results.css'

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const date = searchParams.get('date') || ''
  const passengers = Number(searchParams.get('passengers') || '1')

  const filteredFlights = useMemo(() => {
    return mockFlights.filter((flight) => {
      const matchesFrom = !from || flight.from === from
      const matchesTo = !to || flight.to === to
      const matchesPassengers =
        flight.availableSeats >= passengers

      return (
        matchesFrom &&
        matchesTo &&
        matchesPassengers
      )
    })
  }, [from, to, passengers])

  const fromAirport = mockAirports.find(
    (airport) => airport.code === from,
  )

  const toAirport = mockAirports.find(
    (airport) => airport.code === to,
  )

  const handleEditSearch = () => {
    navigate('/')
  }

  const handleClearSearch = () => {
    setSearchParams({})
  }

  return (
    <section className="flight-results-page">
      <div className="flight-results-content">
        <h1>Kết quả tìm kiếm chuyến bay</h1>

        <p className="demo-notice">
          Dữ liệu chuyến bay dưới đây chỉ là dữ liệu minh họa.
        </p>

        <div className="search-summary">
          <div>
            <span>Điểm đi</span>
            <strong>
              {fromAirport
                ? `${fromAirport.city} (${from})`
                : 'Tất cả'}
            </strong>
          </div>

          <div>
            <span>Điểm đến</span>
            <strong>
              {toAirport
                ? `${toAirport.city} (${to})`
                : 'Tất cả'}
            </strong>
          </div>

          <div>
            <span>Ngày đi</span>
            <strong>
              {date || 'Chưa chọn'}
            </strong>
          </div>

          <div>
            <span>Hành khách</span>
            <strong>
              {passengers} người
            </strong>
          </div>

          <div className="search-summary-actions">
            <button
              type="button"
              onClick={handleEditSearch}
            >
              Sửa tìm kiếm
            </button>

            <button
              type="button"
              onClick={handleClearSearch}
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>

        {filteredFlights.length === 0 ? (
          <div className="empty-results">
            <h2>Không tìm thấy chuyến bay</h2>

            <p>
              Không có chuyến bay phù hợp với điều kiện
              tìm kiếm hiện tại.
            </p>

            <button
              type="button"
              onClick={handleEditSearch}
            >
              Thay đổi tìm kiếm
            </button>
          </div>
        ) : (
          <div className="flight-list">
            {filteredFlights.map((flight) => {
              const flightFromAirport = mockAirports.find(
                (airport) =>
                  airport.code === flight.from,
              )

              const flightToAirport = mockAirports.find(
                (airport) =>
                  airport.code === flight.to,
              )

              return (
                <article
                  className="flight-card"
                  key={flight.id}
                >
                  <div className="flight-airline">
                    <strong>
                      {flight.airline}
                    </strong>

                    <span>
                      {flight.flightNumber}
                    </span>
                  </div>

                  <div className="flight-route">
                    <div>
                      <strong>
                        {flight.departureTime}
                      </strong>

                      <span>
                        {flightFromAirport?.city} (
                        {flight.from})
                      </span>
                    </div>

                    <div className="flight-duration">
                      <span>
                        {flight.duration}
                      </span>

                      <span>→</span>
                    </div>

                    <div>
                      <strong>
                        {flight.arrivalTime}
                      </strong>

                      <span>
                        {flightToAirport?.city} (
                        {flight.to})
                      </span>
                    </div>
                  </div>

                  <div className="flight-price">
                    <span>Giá vé / người</span>

                    <strong>
                      {flight.price.toLocaleString(
                        'vi-VN',
                      )}{' '}
                      ₫
                    </strong>

                    <span>
                      Còn {flight.availableSeats} chỗ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/flights/${flight.id}?passengers=${passengers}&date=${date}`,
                      )
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

export default FlightResultsPage