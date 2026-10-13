
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { getPublicFlight, type PublicFlight } from '../api'
import '../styles/booking-review.css'

function BookingReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const date = searchParams.get('date') || ''

  const passengerParam = Number(searchParams.get('passengers') || '1')
  const passengers = Math.min(
    9,
    Math.max(1, Number.isFinite(passengerParam) ? Math.floor(passengerParam) : 1),
  )

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFlight() {
      const id = Number(flightId)

      if (!flightId || !Number.isInteger(id) || id <= 0) {
        setFlight(null)
        setLoadError('Mã chuyến bay không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const response = await getPublicFlight(id)

        if (cancelled) return

        if (response.item) {
          setFlight(response.item)
        } else {
          setFlight(null)
          setLoadError('Không tìm thấy thông tin chuyến bay.')
        }
      } catch (error: unknown) {
        if (cancelled) return

        setFlight(null)

        if (error instanceof Error) {
          setLoadError(error.message)
        } else {
          setLoadError('Không thể tải thông tin chuyến bay.')
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

  function formatTime(value: string): string {
    const parsedDate = new Date(value)

    if (Number.isNaN(parsedDate.getTime())) {
      return '--:--'
    }

    return parsedDate.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  function formatDuration(start: string, end: string): string {
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()

    if (
      Number.isNaN(startTime) ||
      Number.isNaN(endTime) ||
      endTime < startTime
    ) {
      return 'Chưa có thông tin'
    }

    const totalMinutes = Math.round((endTime - startTime) / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60

    if (hours > 0) {
      return (
        String(hours) +
        ' giờ ' +
        String(remainingMinutes) +
        ' phút'
      )
    }

    return String(remainingMinutes) + ' phút'
  }

  if (loading) {
    return (
      <section className="booking-review-page">
        <div className="booking-review-content">
          <h1>Đang tải thông tin đặt vé...</h1>
          <p>Vui lòng chờ trong giây lát.</p>
        </div>
      </section>
    )
  }

  if (flight === null) {
    return (
      <section className="booking-review-page">
        <div className="booking-review-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>
            {loadError || 'Vui lòng quay lại và chọn chuyến bay khác.'}
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
    (airport) => airport.code === flight.departureCode,
  )

  const toAirport = mockAirports.find(
    (airport) => airport.code === flight.arrivalCode,
  )

  const ticketPrice = Number(flight.basePrice ?? 0)
  const totalPrice = ticketPrice * passengers

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
                <strong>{flight.airline.name}</strong>
                <span>{flight.flightNumber}</span>
              </div>

              <div className="review-route">
                <div>
                  <strong>{formatTime(flight.departureTime)}</strong>
                  <span>
                    {fromAirport ? fromAirport.city : flight.departureCode}
                    {' ('}
                    {flight.departureCode}
                    {')'}
                  </span>
                </div>

                <div className="review-duration">
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
                    {toAirport ? toAirport.city : flight.arrivalCode}
                    {' ('}
                    {flight.arrivalCode}
                    {')'}
                  </span>
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
                <span>Số chỗ</span>
                <strong>{passengers} chỗ</strong>
              </div>
            </div>

            <p className="review-note">
              Thông tin hành khách được nhập ở bước trước.
            </p>
          </div>

          <div className="review-section price-section">
            <h2>Chi phí</h2>

            <div className="price-row">
              <span>Giá vé / người</span>
              <strong>
                {Number(ticketPrice || 0).toLocaleString('vi-VN')} ₫
              </strong>
            </div>

            <div className="price-row">
              <span>Số hành khách</span>
              <strong>{passengers}</strong>
            </div>

            <div className="total-row">
              <span>Tổng cộng</span>
              <strong>
                {Number(totalPrice || 0).toLocaleString('vi-VN')} ₫
              </strong>
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
                  '/payment?flightId=' +
                    String(flight.id) +
                    '&passengers=' +
                    String(passengers) +
                    '&date=' +
                    encodeURIComponent(date),
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