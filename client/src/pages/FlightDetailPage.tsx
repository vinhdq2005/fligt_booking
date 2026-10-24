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

  return `${hours}h ${remainingMinutes}m`
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
  const returnDate = searchParams.get('returnDate') || ''
  const outboundId = searchParams.get('outboundId')
  const inboundId = searchParams.get('inboundId')

  const isRoundTrip = Boolean(outboundId && inboundId)

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [inboundFlight, setInboundFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFlightData() {
      const primaryId = Number(flightId)

      if (!flightId || !Number.isInteger(primaryId) || primaryId <= 0) {
        setFlight(null)
        setError('Mã chuyến bay không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        if (isRoundTrip && outboundId && inboundId) {
          const [outboundRes, inboundRes] = await Promise.all([
            getPublicFlight(Number(outboundId)),
            getPublicFlight(Number(inboundId)),
          ])

          if (!cancelled) {
            setFlight(outboundRes.item)
            setInboundFlight(inboundRes.item)
          }
        } else {
          const result = await getPublicFlight(primaryId)
          if (!cancelled) {
            setFlight(result.item)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFlight(null)
          setInboundFlight(null)
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

    void loadFlightData()

    return () => {
      cancelled = true
    }
  }, [flightId, outboundId, inboundId, isRoundTrip])

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

    if (isRoundTrip && inboundFlight) {
      navigate(
        `/booking/passengers?outboundId=${flight.id}&inboundId=${inboundFlight.id}&passengers=${passengers}&date=${encodeURIComponent(date)}&returnDate=${encodeURIComponent(returnDate)}`,
      )
    } else {
      navigate(
        `/booking/passengers?flightId=${flight.id}&passengers=${passengers}&date=${encodeURIComponent(date || flight.departureTime.slice(0, 10))}`,
      )
    }
  }

  // ==========================================
  // GIAO DIỆN MỘT CHIỀU (GIỮ NGUYÊN BẢN GỐC)
  // ==========================================
  if (!isRoundTrip) {
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

  // ==========================================
  // GIAO DIỆN KHỨ HỒI (2 CỘT HIỆN ĐẠI, SANG TRỌNG)
  // ==========================================
  const inboundPrice = inboundFlight ? Number(inboundFlight.currentPrice ?? inboundFlight.basePrice ?? 0) : 0
  const totalPricePerPassenger = ticketPrice + inboundPrice
  const grandTotal = totalPricePerPassenger * passengers
  const isRoundTripBookable = isBookable && (!inboundFlight || inboundFlight.status === 'SCHEDULED')

  const inboundFromAirport = inboundFlight ? mockAirports.find((a) => a.code === inboundFlight.departureCode) : null
  const inboundToAirport = inboundFlight ? mockAirports.find((a) => a.code === inboundFlight.arrivalCode) : null

  return (
    <section style={{ background: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', padding: 0 }}
          onClick={() => navigate(-1)}
        >
          ← Quay lại kết quả tìm kiếm
        </button>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
            Xác nhận hành trình khứ hồi
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Kiểm tra thông tin chi tiết các chặng bay trước khi chuyển sang bước nhập hành khách.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
          
          {/* CỘT TRÁI: CHUYẾN ĐI & CHUYẾN VỀ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* THẺ CHIỀU ĐI */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                    ✈ CHIỀU ĐI
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                    Ngày: <strong style={{ color: '#0f172a' }}>{formatDate(date || flight.departureTime.slice(0, 10))}</strong>
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>
                  {ticketPrice.toLocaleString('vi-VN')} ₫
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{flight.airline.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>{flight.flightNumber}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatTime(flight.departureTime)}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{fromAirport?.city || flight.departureCode} ({flight.departureCode})</div>
                </div>
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  <div>{formatDuration(flight.departureTime, flight.arrivalTime)}</div>
                  <div style={{ fontSize: '14px' }}>⟶</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatTime(flight.arrivalTime)}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{toAirport?.city || flight.arrivalCode} ({flight.arrivalCode})</div>
                </div>
              </div>
            </div>

            {/* THẺ CHIỀU VỀ */}
            {inboundFlight && (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                      🛬 CHIỀU VỀ
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                      Ngày: <strong style={{ color: '#0f172a' }}>{formatDate(returnDate || inboundFlight.departureTime.slice(0, 10))}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>
                    {inboundPrice.toLocaleString('vi-VN')} ₫
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{inboundFlight.airline.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>{inboundFlight.flightNumber}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatTime(inboundFlight.departureTime)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{inboundFromAirport?.city || inboundFlight.departureCode} ({inboundFlight.departureCode})</div>
                  </div>
                  <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    <div>{formatDuration(inboundFlight.departureTime, inboundFlight.arrivalTime)}</div>
                    <div style={{ fontSize: '14px' }}>⟶</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatTime(inboundFlight.arrivalTime)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{inboundToAirport?.city || inboundFlight.arrivalCode} ({inboundFlight.arrivalCode})</div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* CỘT PHẢI: TÓM TẮT THANH TOÁN */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', position: 'sticky', top: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              Tóm tắt thanh toán
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: '14px', color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Loại vé:</span>
                <strong style={{ color: '#0f172a' }}>Khứ hồi</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Số lượng hành khách:</span>
                <strong style={{ color: '#0f172a' }}>{passengers} người</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Trạng thái chuyến:</span>
                <strong style={{ color: '#16a34a' }}>{isRoundTripBookable ? 'Khả dụng' : 'Không khả dụng'}</strong>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Tổng tiền dự kiến:</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                {grandTotal.toLocaleString('vi-VN')} ₫
              </div>
            </div>

            <button
              type="button"
              style={{
                width: '100%',
                background: isRoundTripBookable ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: isRoundTripBookable ? 'pointer' : 'not-allowed',
                boxShadow: isRoundTripBookable ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'all 0.2s'
              }}
              disabled={!isRoundTripBookable}
              onClick={handleContinue}
            >
              {isRoundTripBookable ? 'Tiếp tục đặt vé →' : 'Không khả dụng'}
            </button>
          </div>

        </div>
      </div>
    </section>
  )
}

export default FlightDetailPage