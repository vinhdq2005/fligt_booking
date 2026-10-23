
import { useEffect, useState } from 'react'
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  getPublicFlight,
  type PublicFlight,
} from '../api'
import { mockAirports } from '../mocks/mockAirports'
import '../styles/flight-detail.css'

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

function FlightDetailPage() {
  const navigate = useNavigate()
  const { flightId } = useParams()
  const [searchParams] = useSearchParams()

  const passengers = Math.max(
    1,
    Math.min(9, Number(searchParams.get('passengers') || '1') || 1),
  )
  const date = searchParams.get('date') || ''

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFlight() {
      const id = Number(flightId)

      if (!flightId || !Number.isInteger(id) || id <= 0) {
        setFlight(null)
        setError('Mã chuyến bay không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await getPublicFlight(id)

        if (!cancelled) {
          setFlight(result.item)
        }
      } catch (err) {
        if (!cancelled) {
          setFlight(null)
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải thông tin chuyến bay.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFlight()

    return () => {
      cancelled = true
    }
  }, [flightId])

  if (loading) {
    return (
      <section className="flight-detail-page">
        <div className="flight-detail-content">
          <h1>Chi tiết chuyến bay</h1>
          <p>Đang tải thông tin chuyến bay...</p>
          <button type="button" onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </section>
    )
  }

  if (error || !flight) {
    return (
      <section className="flight-detail-page">
        <div className="flight-detail-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>{error || 'Không tìm thấy thông tin chuyến bay.'}</p>
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
    (airport) => airport.code === flight.departureCode,
  )
  const toAirport = mockAirports.find(
    (airport) => airport.code === flight.arrivalCode,
  )

  const ticketPrice = Number(
    flight.currentPrice ?? flight.basePrice ?? 0,
  )
  const totalPrice = ticketPrice * passengers
  const isBookable = flight.status === 'SCHEDULED'

  function handleContinue() {
    if (!flight || !isBookable) return

    navigate(
      `/booking/passengers?flightId=${flight.id}&passengers=${passengers}&date=${encodeURIComponent(date || flight.departureTime.slice(0, 10))}`,
    )
  }

  return (
    <section className="flight-detail-page">
      <div className="flight-detail-content">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate(-1)}
        >
          Quay lại kết quả
        </button>

        <h1>Chi tiết chuyến bay</h1>

        <div className="flight-detail-card">
          <div className="flight-detail-header">
            <div>
              <h2>{flight.airline.name}</h2>
              <p>{flight.flightNumber}</p>
            </div>

            <div className="flight-detail-price">
              {ticketPrice.toLocaleString('vi-VN')} ₫
              <small> / người</small>
            </div>
          </div>

          <div className="flight-detail-route">
            <div>
              <strong>{formatTime(flight.departureTime)}</strong>
              <span>
                {fromAirport?.city || flight.departureCode}
                {' '}({flight.departureCode})
              </span>
              <small>
                {fromAirport?.name || flight.departureCode}
              </small>
            </div>

            <div className="flight-detail-duration">
              <span>
                {formatDuration(
                  flight.departureTime,
                  flight.arrivalTime,
                )}
              </span>
              <span>→</span>
            </div>

            <div>
              <strong>{formatTime(flight.arrivalTime)}</strong>
              <span>
                {toAirport?.city || flight.arrivalCode}
                {' '}({flight.arrivalCode})
              </span>
              <small>
                {toAirport?.name || flight.arrivalCode}
              </small>
            </div>
          </div>

          <div className="flight-detail-info">
            <p>
              <strong>Ngày đi:</strong>{' '}
              {formatDate(date || flight.departureTime.slice(0, 10))}
            </p>

            <p>
              <strong>Số hành khách:</strong>{' '}
              {passengers} người
            </p>

            <p>
              <strong>Sức chứa máy bay:</strong>{' '}
              {flight.capacity} chỗ
            </p>

            <p>
              <strong>Tổng tiền dự kiến:</strong>{' '}
              {totalPrice.toLocaleString('vi-VN')} ₫
            </p>

            <p>
              <strong>Trạng thái:</strong>{' '}
              {isBookable ? 'Có thể tiếp tục đặt' : 'Không khả dụng'}
            </p>

            <p>
              <strong>Lưu ý:</strong>{' '}
              Vui lòng kiểm tra kỹ thông tin hành khách và lịch trình trước khi tiếp tục
            </p>
          </div>

          <button
            type="button"
            className="booking-button"
            disabled={!isBookable}
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