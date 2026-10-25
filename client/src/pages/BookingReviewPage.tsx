import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockAirports } from '../mocks/mockAirports'
import { getPublicFlight, type PublicFlight } from '../api'
import '../styles/booking-review.css'

type Passenger = {
  fullName: string
  documentNumber: string
  gender: string
  dateOfBirth: string
  nationality: string
}

type SavedPassengerInfo = {
  flightId?: number
  outboundId?: number
  inboundId?: number
  date: string
  returnDate?: string
  passengers: Passenger[]
  contactEmail: string
  contactPhone: string
}

const PASSENGER_STORAGE_KEY = 'flight-booking-passenger-info'

function BookingReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const outboundId = searchParams.get('outboundId') || ''
  const inboundId = searchParams.get('inboundId') || ''
  const date = searchParams.get('date') || ''
  const returnDate = searchParams.get('returnDate') || ''
  const isRoundTrip = Boolean(outboundId && inboundId)

  const passengerParam = Number(searchParams.get('passengers') || '1')
  const passengers = Math.min(
    9,
    Math.max(
      1,
      Number.isFinite(passengerParam) ? Math.floor(passengerParam) : 1,
    ),
  )

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [outboundFlight, setOutboundFlight] = useState<PublicFlight | null>(null)
  const [inboundFlight, setInboundFlight] = useState<PublicFlight | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [passengerList, setPassengerList] = useState<Passenger[]>([])
  const [passengerError, setPassengerError] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFlights() {
      setLoading(true)
      setLoadError('')

      try {
        if (isRoundTrip) {
          const outId = Number(outboundId)
          const inId = Number(inboundId)

          if (!Number.isInteger(outId) || outId <= 0 || !Number.isInteger(inId) || inId <= 0) {
            setLoadError('Mã chuyến bay khứ hồi không hợp lệ.')
            setLoading(false)
            return
          }

          const [outRes, inRes] = await Promise.all([
            getPublicFlight(outId),
            getPublicFlight(inId),
          ])

          if (cancelled) return

          if (outRes.item && inRes.item) {
            setOutboundFlight(outRes.item)
            setInboundFlight(inRes.item)
          } else {
            setLoadError('Không tìm thấy thông tin chuyến bay khứ hồi.')
          }
        } else {
          const id = Number(flightId)

          if (!flightId || !Number.isInteger(id) || id <= 0) {
            setFlight(null)
            setLoadError('Mã chuyến bay không hợp lệ.')
            setLoading(false)
            return
          }

          const response = await getPublicFlight(id)

          if (cancelled) return

          if (response.item) {
            setFlight(response.item)
          } else {
            setFlight(null)
            setLoadError('Không tìm thấy thông tin chuyến bay.')
          }
        }
      } catch (error) {
        if (cancelled) return

        setFlight(null)
        setOutboundFlight(null)
        setInboundFlight(null)
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

    void loadFlights()

    return () => {
      cancelled = true
    }
  }, [flightId, outboundId, inboundId, isRoundTrip])

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

      const isValidMatch = isRoundTrip
        ? parsed.outboundId === Number(outboundId) &&
          parsed.inboundId === Number(inboundId) &&
          parsed.date === date &&
          parsed.returnDate === returnDate
        : parsed.flightId === Number(flightId) && parsed.date === date

      if (
        !isValidMatch ||
        !Array.isArray(parsed.passengers) ||
        parsed.passengers.length !== passengers ||
        typeof parsed.contactEmail !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.contactEmail) ||
        typeof parsed.contactPhone !== 'string' ||
        !/^\+[1-9]\d{7,18}$/.test(parsed.contactPhone) ||
        parsed.passengers.some(
          (p) =>
            typeof p.fullName !== 'string' ||
            typeof p.documentNumber !== 'string' ||
            !/^\d{12}$/.test(p.documentNumber) ||
            !['MALE', 'FEMALE'].includes(p.gender) ||
            typeof p.dateOfBirth !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth) ||
            typeof p.nationality !== 'string' ||
            p.nationality.trim().length < 2,
        )
      ) {
        setPassengerList([])
        setPassengerError(
          'Thông tin hành khách không khớp với chuyến bay. Vui lòng nhập lại.',
        )
        return
      }

      setPassengerList(parsed.passengers)
      setContactEmail(parsed.contactEmail)
      setContactPhone(parsed.contactPhone)
      setPassengerError('')
    } catch {
      setPassengerList([])
      setPassengerError('Không thể đọc thông tin hành khách đã lưu.')
    }
  }, [flightId, outboundId, inboundId, date, returnDate, passengers, isRoundTrip])

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
    if (isRoundTrip && (!outboundFlight || !inboundFlight)) return
    if (!isRoundTrip && !flight) return

    if (passengerError || passengerList.length !== passengers) {
      setPassengerError(
        'Vui lòng quay lại nhập đầy đủ thông tin hành khách.',
      )
      return
    }

    if (isRoundTrip) {
      navigate(
        `/payment?outboundId=${outboundFlight!.id}&inboundId=${inboundFlight!.id}&passengers=${passengers}&date=${encodeURIComponent(date)}&returnDate=${encodeURIComponent(returnDate)}`,
      )
    } else {
      navigate(
        `/payment?flightId=${flight!.id}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
      )
    }
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

  if (loadError || (isRoundTrip && (!outboundFlight || !inboundFlight)) || (!isRoundTrip && !flight)) {
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

  // Khai báo sân bay và giá vé
  const fromAirport = !isRoundTrip && flight ? mockAirports.find((a) => a.code === flight.departureCode) : null
  const toAirport = !isRoundTrip && flight ? mockAirports.find((a) => a.code === flight.arrivalCode) : null

  const outFromAirport = isRoundTrip && outboundFlight ? mockAirports.find((a) => a.code === outboundFlight.departureCode) : null
  const outToAirport = isRoundTrip && outboundFlight ? mockAirports.find((a) => a.code === outboundFlight.arrivalCode) : null

  const inFromAirport = isRoundTrip && inboundFlight ? mockAirports.find((a) => a.code === inboundFlight.departureCode) : null
  const inToAirport = isRoundTrip && inboundFlight ? mockAirports.find((a) => a.code === inboundFlight.arrivalCode) : null

  const ticketPrice = !isRoundTrip && flight ? Number(flight.currentPrice ?? flight.basePrice ?? 0) : 0

  const outboundPrice = isRoundTrip && outboundFlight ? Number(outboundFlight.currentPrice ?? outboundFlight.basePrice ?? 0) : 0
  const inboundPrice = isRoundTrip && inboundFlight ? Number(inboundFlight.currentPrice ?? inboundFlight.basePrice ?? 0) : 0
  const roundTripPricePerPassenger = outboundPrice + inboundPrice

  const totalPrice = isRoundTrip ? roundTripPricePerPassenger * passengers : ticketPrice * passengers

  return (
    <section className="booking-review-page">
      <div className="booking-review-content">
        <h1>Xem lại thông tin đặt vé</h1>

        <p className="demo-notice">
          Vui lòng kiểm tra thông tin chuyến bay và hành khách trước khi thanh toán.
        </p>

        <div className="booking-review-card">
          {/* PHẦN CHUYẾN BAY */}
          <div className="review-section">
            <h2>Chuyến bay</h2>

            {isRoundTrip && outboundFlight && inboundFlight ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* CHIỀU ĐI */}
                <div className="review-flight" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-block', marginBottom: '8px' }}>
                    ✈ CHIỀU ĐI
                  </span>
                  <div>
                    <strong>{outboundFlight.airline.name}</strong>
                    <span>{outboundFlight.flightNumber}</span>
                  </div>

                  <div className="review-route">
                    <div>
                      <strong>{formatTime(outboundFlight.departureTime)}</strong>
                      <span>
                        {outFromAirport?.city || outboundFlight.departureCode} ({outboundFlight.departureCode})
                      </span>
                    </div>

                    <div className="review-duration">
                      <span>{formatDuration(outboundFlight.departureTime, outboundFlight.arrivalTime)}</span>
                      <span>→</span>
                    </div>

                    <div>
                      <strong>{formatTime(outboundFlight.arrivalTime)}</strong>
                      <span>
                        {outToAirport?.city || outboundFlight.arrivalCode} ({outboundFlight.arrivalCode})
                      </span>
                    </div>
                  </div>

                  <p>Ngày đi: {date || 'Chưa chọn'}</p>
                </div>

                {/* CHIỀU VỀ */}
                <div className="review-flight">
                  <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-block', marginBottom: '8px' }}>
                    🛬 CHIỀU VỀ
                  </span>
                  <div>
                    <strong>{inboundFlight.airline.name}</strong>
                    <span>{inboundFlight.flightNumber}</span>
                  </div>

                  <div className="review-route">
                    <div>
                      <strong>{formatTime(inboundFlight.departureTime)}</strong>
                      <span>
                        {inFromAirport?.city || inboundFlight.departureCode} ({inboundFlight.departureCode})
                      </span>
                    </div>

                    <div className="review-duration">
                      <span>{formatDuration(inboundFlight.departureTime, inboundFlight.arrivalTime)}</span>
                      <span>→</span>
                    </div>

                    <div>
                      <strong>{formatTime(inboundFlight.arrivalTime)}</strong>
                      <span>
                        {inToAirport?.city || inboundFlight.arrivalCode} ({inboundFlight.arrivalCode})
                      </span>
                    </div>
                  </div>

                  <p>Ngày về: {returnDate || 'Chưa chọn'}</p>
                </div>
              </div>
            ) : (
              flight && (
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
              )
            )}
          </div>

          {/* PHẦN HÀNH KHÁCH */}
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
                    <p>CCCD: {passenger.documentNumber}</p>
                    <p>Giới tính: {passenger.gender === 'MALE' ? 'Nam' : 'Nữ'}</p>
                    <p>Ngày sinh: {passenger.dateOfBirth.split('-').reverse().join('/')}</p>
                    <p>Quốc tịch: {passenger.nationality}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* THÔNG TIN LIÊN LẠC */}
          <div className="review-section">
            <h2>Thông tin liên lạc</h2>
            {passengerError ? (
              <p className="demo-notice">Vui lòng quay lại nhập thông tin liên lạc.</p>
            ) : (
              <div className="passenger-summary">
                <div><span>Email</span><strong>{contactEmail}</strong></div>
                <div><span>Số điện thoại</span><strong>{contactPhone}</strong></div>
              </div>
            )}
          </div>

          {/* CHI PHÍ */}
          <div className="review-section">
            <h2>Chi phí</h2>

            <div className="passenger-summary">
              {isRoundTrip ? (
                <>
                  <div>
                    <span>Giá vé chiều đi (mỗi người)</span>
                    <strong>{formatPrice(outboundPrice)}</strong>
                  </div>
                  <div>
                    <span>Giá vé chiều về (mỗi người)</span>
                    <strong>{formatPrice(inboundPrice)}</strong>
                  </div>
                  <div>
                    <span>Tổng giá vé mỗi người</span>
                    <strong>{formatPrice(roundTripPricePerPassenger)}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>Giá vé mỗi người</span>
                  <strong>{formatPrice(ticketPrice)}</strong>
                </div>
              )}

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