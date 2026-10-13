
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { getPublicFlight, type PublicFlight } from '../api'
import '../styles/booking-review.css'

type Passenger = {
  fullName: string
  gender: string
  phone: string
  email: string
}

type SavedPassengerInfo = {
  flightId: number
  date: string
  passengers: Passenger[]
}

const PASSENGER_STORAGE_KEY = 'flight-booking-passenger-info'

function BookingReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const date = searchParams.get('date') || ''

  const passengerParam = Number(searchParams.get('passengers') || '1')
  const passengers = Math.min(
    9,
    Math.max(
      1,
      Number.isFinite(passengerParam) ? Math.floor(passengerParam) : 1,
    ),
  )

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [passengerList, setPassengerList] = useState<Passenger[]>([])
  const [passengerError, setPassengerError] = useState('')

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
      } catch (error) {
        if (cancelled) return

        setFlight(null)
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không thể tải thông tin chuyến bay.',
        )
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

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PASSENGER_STORAGE_KEY)

      if (!saved) {
        setPassengerList([])
        setPassengerError(
          'Không tìm thấy thông tin hành khách. Vui lòng quay lại nhập thông tin.',
        )
        return
      }

      const parsed = JSON.parse(saved) as SavedPassengerInfo

      if (
        parsed.flightId !== Number(flightId) ||
        parsed.date !== date ||
        !Array.isArray(parsed.passengers) ||
        parsed.passengers.length !== passengers ||
        parsed.passengers.some(
          (p) =>
            typeof p.fullName !== 'string' ||
            typeof p.email !== 'string' ||
            typeof p.phone !== 'string',
        )
      ) {
        setPassengerList([])
        setPassengerError(
          'Thông tin hành khách không khớp với chuyến bay. Vui lòng nhập lại.',
        )
        return
      }

      setPassengerList(parsed.passengers)
      setPassengerError('')
    } catch {
      setPassengerList([])
      setPassengerError('Không thể đọc thông tin hành khách đã lưu.')
    }
  }, [flightId, date, passengers])

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

    if (hours > 0 && remainingMinutes > 0) {
      return `${hours} giờ ${remainingMinutes} phút`
    }

    if (hours > 0) {
      return `${hours} giờ`
    }

    return `${remainingMinutes} phút`
  }

  function formatPrice(price: number): string {
    return `${Number(price).toLocaleString('vi-VN')} ₫`
  }

  function handleContinue() {
    if (!flight) return

    if (passengerError || passengerList.length !== passengers) {
      setPassengerError(
        'Vui lòng quay lại nhập đầy đủ thông tin hành khách.',
      )
      return
    }

    navigate(
      `/payment?flightId=${flight.id}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
    )
  }

  if (loading) {
    return (
      <section className="booking-review-page">
        <div className="booking-review-content">
          <h1>Xem lại thông tin đặt vé</h1>
          <p>Đang tải thông tin chuyến bay...</p>
        </div>
      </section>
    )
  }

  if (loadError || !flight) {
    return (
      <section className="booking-review-page">
        <div className="booking-review-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>{loadError || 'Không tìm thấy thông tin chuyến bay.'}</p>
          <button type="button" onClick={() => navigate('/flights/results')}>
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
          Vui lòng kiểm tra thông tin chuyến bay và hành khách trước khi thanh toán.
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
                    {fromAirport?.city || flight.departureCode}
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
                    {toAirport?.city || flight.arrivalCode}
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

            {passengerError ? (
              <p className="demo-notice" role="alert">
                {passengerError}
              </p>
            ) : (
              <div className="passenger-summary">
                <div>
                  <span>Số hành khách</span>
                  <strong>{passengers} người</strong>
                </div>

                {passengerList.map((passenger, index) => (
                  <div key={index}>
                    <span>Hành khách {index + 1}</span>
                    <strong>{passenger.fullName}</strong>
                    <p>Email: {passenger.email}</p>
                    <p>Điện thoại: {passenger.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="review-section">
            <h2>Chi phí</h2>

            <div className="passenger-summary">
              <div>
                <span>Giá vé mỗi người</span>
                <strong>{formatPrice(ticketPrice)}</strong>
              </div>

              <div>
                <span>Số hành khách</span>
                <strong>{passengers}</strong>
              </div>

              <div>
                <span>Tổng tiền dự kiến</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>
            </div>
          </div>

          <div className="form-actions">
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
              disabled={Boolean(passengerError)}
              onClick={handleContinue}
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