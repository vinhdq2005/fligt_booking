
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  searchPublicFlights,
  type PublicFlight,
} from '../api'
import { mockAirports } from '../mocks/mockAirports'
import '../styles/flight-results.css'

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function formatDuration(departure: string, arrival: string) {
  const minutes = Math.round(
    (new Date(arrival).getTime() -
      new Date(departure).getTime()) / 60000,
  )

  if (minutes < 0) return '—'

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours} giờ ${remainingMinutes} phút`
}

function formatDate(value: string) {
  if (!value) return 'Chưa chọn'

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const from = (searchParams.get('from') || '').toUpperCase()
  const to = (searchParams.get('to') || '').toUpperCase()
  const date = searchParams.get('date') || ''

  const passengers = Math.max(
    1,
    Math.min(9, Number(searchParams.get('passengers') || '1') || 1),
  )

  const [flights, setFlights] = useState<PublicFlight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadFlights() {
      if (!from || !to || !date) {
        setFlights([])
        setError('Vui lòng chọn sân bay đi, sân bay đến và ngày bay.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await searchPublicFlights({
          from,
          to,
          date,
        })

        if (!cancelled) {
          setFlights(result.items)
        }
      } catch (err) {
        if (!cancelled) {
          setFlights([])
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách chuyến bay.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFlights()

    return () => {
      cancelled = true
    }
  }, [from, to, date, retryCount])

  const fromAirport = mockAirports.find(
    (airport) => airport.code === from,
  )

  const toAirport = mockAirports.find(
    (airport) => airport.code === to,
  )

  return (
    <section className="flight-results-page">
      <div className="flight-results-content">
        <h1>Kết quả tìm kiếm chuyến bay</h1>

        <p className="demo-notice">
          Chuyến bay được lấy từ hệ thống backend.
        </p>

        <div className="search-summary">
          <div className="summary-heading">
            <div>
              <span className="summary-eyebrow">
                HÀNH TRÌNH CỦA BẠN
              </span>
              <h2>Thông tin tìm kiếm</h2>
            </div>

            <button
              type="button"
              className="summary-edit-button"
              onClick={() => navigate('/')}
            >
              ✎ Sửa tìm kiếm
            </button>
          </div>

          <div className="summary-route">
            <div className="summary-airport">
              <span className="summary-label">
                ĐIỂM KHỞI HÀNH
              </span>
              <strong>
                {fromAirport?.city || from || 'Chưa chọn'}
              </strong>
              <span className="summary-code">
                {from || '---'}
              </span>
            </div>

            <div className="summary-route-connector">
              <span>✈</span>
              <div />
            </div>

            <div className="summary-airport summary-destination">
              <span className="summary-label">
                ĐIỂM ĐẾN
              </span>
              <strong>
                {toAirport?.city || to || 'Chưa chọn'}
              </strong>
              <span className="summary-code">
                {to || '---'}
              </span>
            </div>
          </div>

          <div className="summary-details">
            <div className="summary-detail-item">
              <span className="summary-detail-icon">▦</span>
              <div>
                <span>Ngày khởi hành</span>
                <strong>{formatDate(date)}</strong>
              </div>
            </div>

            <div className="summary-detail-item">
              <span className="summary-detail-icon">♙</span>
              <div>
                <span>Hành khách</span>
                <strong>{passengers} người lớn</strong>
              </div>
            </div>

            <button
              type="button"
              className="summary-clear-button"
              onClick={() => setSearchParams({})}
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-results">
            <p>Đang tải danh sách chuyến bay...</p>
          </div>
        ) : error ? (
          <div className="empty-results">
            <h2>Không thể tải chuyến bay</h2>
            <p>{error}</p>

            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Thử lại
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
            >
              Thay đổi tìm kiếm
            </button>
          </div>
        ) : flights.length === 0 ? (
          <div className="empty-results">
            <h2>Không tìm thấy chuyến bay</h2>
            <p>
              Không có chuyến bay phù hợp trong cơ sở dữ liệu
              với điều kiện tìm kiếm hiện tại.
            </p>

            <button
              type="button"
              onClick={() => navigate('/')}
            >
              Thay đổi tìm kiếm
            </button>
          </div>
        ) : (
          <div className="flight-list">
            {flights.map((flight) => {
              const flightFromAirport = mockAirports.find(
                (airport) =>
                  airport.code === flight.departureCode,
              )

              const flightToAirport = mockAirports.find(
                (airport) =>
                  airport.code === flight.arrivalCode,
              )

              const enoughSeats =
                flight.availableSeats >= passengers

              return (
                <article
                  className="flight-card"
                  key={flight.id}
                >
                  <div className="flight-airline">
                    <strong>{flight.airline.name}</strong>
                    <span>{flight.flightNumber}</span>
                  </div>

                  <div className="flight-route">
                    <div>
                      <strong>
                        {formatTime(flight.departureTime)}
                      </strong>
                      <span>
                        {flightFromAirport?.city ||
                          flight.departureCode}
                        {' '}({flight.departureCode})
                      </span>
                    </div>

                    <div className="flight-duration">
                      <span>
                        {formatDuration(
                          flight.departureTime,
                          flight.arrivalTime,
                        )}
                      </span>
                      <span>→</span>
                    </div>

                    <div>
                      <strong>
                        {formatTime(flight.arrivalTime)}
                      </strong>
                      <span>
                        {flightToAirport?.city ||
                          flight.arrivalCode}
                        {' '}({flight.arrivalCode})
                      </span>
                    </div>
                  </div>

                  <div className="flight-price">
                    <span>Giá vé / người</span>

                    <strong>
                      {flight.basePrice.toLocaleString('vi-VN')} ₫
                    </strong>

                    <span>
                      Sức chứa: {flight.capacity} chỗ
                    </span>

                    <span>
                      Còn trống: {flight.availableSeats} chỗ
                    </span>

                    <span>
                      Đã sử dụng: {flight.occupiedSeats}/
                      {flight.capacity} chỗ
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!enoughSeats}
                    onClick={() =>
                      navigate(
                        `/flights/${flight.id}?passengers=${passengers}&date=${encodeURIComponent(date)}`,
                      )
                    }
                  >
                    {enoughSeats
                      ? 'Xem chi tiết'
                      : 'Không đủ chỗ'}
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