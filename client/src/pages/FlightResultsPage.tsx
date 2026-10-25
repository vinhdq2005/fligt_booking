import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getAirportCodes,
  getPublicAirlines,
  searchPublicFlights,
  type PublicAirline,
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

  return `${hours}h ${remainingMinutes}m`
}

function formatDate(value: string) {
  if (!value) return 'Chưa chọn'

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

type SearchDraft = {
  from: string
  to: string
  date: string
  returnDate: string
  passengers: string
  airline: string
}

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tripType = searchParams.get('tripType') || 'one-way'
  const from = (searchParams.get('from') || '').toUpperCase()
  const to = (searchParams.get('to') || '').toUpperCase()
  const date = searchParams.get('date') || ''
  const returnDate = searchParams.get('returnDate') || ''
  const airline = (searchParams.get('airline') || '').toUpperCase()

  const passengers = Math.max(
    1,
    Math.min(9, Number(searchParams.get('passengers') || '1') || 1),
  )

  const [flightStage, setFlightStage] = useState<'outbound' | 'inbound'>('outbound')
  const [selectedOutbound, setSelectedOutbound] = useState<PublicFlight | null>(null)

  const [flights, setFlights] = useState<PublicFlight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SearchDraft>({ from, to, date, returnDate, passengers: String(passengers), airline })
  const [airportCodes, setAirportCodes] = useState<string[]>([])
  const [airlines, setAirlines] = useState<PublicAirline[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    let active = true
    getPublicAirlines()
      .then((items) => { if (active) setAirlines(items) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    setFlightStage('outbound')
    setSelectedOutbound(null)
  }, [from, to, date, returnDate, airline])

  function openEditor() {
    setDraft({ from, to, date, returnDate, passengers: String(passengers), airline })
    setEditError('')
    setEditing(true)
    setOptionsLoading(true)
    setAirportCodes([])
    setAirlines([])
    void Promise.all([getAirportCodes(), getPublicAirlines()])
      .then(([codes, items]) => {
        setAirportCodes(codes)
        setAirlines(items)
        setDraft((current) => {
          const selected = items.find((item) => item.code === current.airline)
          return selected ? { ...current, airline: selected.name } : current
        })
      })
      .catch(() => setEditError('Không tải được danh sách sân bay hoặc hãng bay. Vui lòng thử lại.'))
      .finally(() => setOptionsLoading(false))
  }

  function updateDraft(field: keyof SearchDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setEditError('')
  }

  function applySearch() {
    const nextFrom = draft.from.trim().toUpperCase()
    const nextTo = draft.to.trim().toUpperCase()
    const airlineText = draft.airline.trim()
    const matchedAirline = airlines.find((item) =>
      item.code === airlineText.toUpperCase() ||
      item.name.toLocaleLowerCase('vi') === airlineText.toLocaleLowerCase('vi'),
    )
    const nextAirline = matchedAirline?.code || ''
    const nextPassengers = Number(draft.passengers)
    const parsedDate = new Date(`${draft.date}T00:00:00.000Z`)
    const parsedReturnDate = draft.returnDate ? new Date(`${draft.returnDate}T00:00:00.000Z`) : null

    if (!airportCodes.includes(nextFrom) || !airportCodes.includes(nextTo)) {
      setEditError('Vui lòng chọn mã sân bay có trong danh sách gợi ý.')
      return
    }
    if (nextFrom === nextTo) {
      setEditError('Điểm đi và điểm đến không được trùng nhau.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(parsedDate.getTime())) {
      setEditError('Ngày đi không hợp lệ.')
      return
    }
    if (tripType === 'round-trip') {
      if (!draft.returnDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.returnDate) || Number.isNaN(parsedReturnDate?.getTime())) {
        setEditError('Vui lòng nhập ngày về hợp lệ.')
        return
      }
      if (draft.returnDate < draft.date) {
        setEditError('Ngày về không được trước ngày đi.')
        return
      }
    }
    if (!Number.isInteger(nextPassengers) || nextPassengers < 1 || nextPassengers > 9) {
      setEditError('Số hành khách phải từ 1 đến 9.')
      return
    }

    const nextSearch = new URLSearchParams({
      tripType,
      from: nextFrom,
      to: nextTo,
      date: draft.date,
      passengers: String(nextPassengers),
    })
    if (tripType === 'round-trip' && draft.returnDate) {
      nextSearch.set('returnDate', draft.returnDate)
    }
    if (nextAirline) nextSearch.set('airline', nextAirline)

    setSearchParams(nextSearch)
    setEditing(false)
    setRetryCount((count) => count + 1)
  }

  const activeFrom = tripType === 'round-trip' && flightStage === 'inbound' ? to : from
  const activeTo = tripType === 'round-trip' && flightStage === 'inbound' ? from : to
  const activeDate = tripType === 'round-trip' && flightStage === 'inbound' ? returnDate : date

  useEffect(() => {
    let cancelled = false

    async function loadFlights() {
      if (!activeFrom || !activeTo || !activeDate) {
        setFlights([])
        setError('Vui lòng chọn đầy đủ thông tin sân bay và ngày bay.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await searchPublicFlights({
          from: activeFrom,
          to: activeTo,
          date: activeDate,
          airline,
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
  }, [activeFrom, activeTo, activeDate, airline, retryCount])

  const currentFromAirport = mockAirports.find((airport) => airport.code === activeFrom)
  const currentToAirport = mockAirports.find((airport) => airport.code === activeTo)

  return (
    <section className="flight-results-page">
      <div className="flight-results-content">
        <div className="results-header-section">
          <h1>Kết quả tìm kiếm chuyến bay</h1>
          <p className="demo-notice">
            Hệ thống cung cấp thông tin chuyến bay trực tuyến từ cơ sở dữ liệu.
          </p>
        </div>

        {/* Thanh bước khứ hồi */}
        {tripType === 'round-trip' && (
          <div className="round-trip-steps" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              flex: 1, padding: '12px 16px', borderRadius: '12px', background: flightStage === 'outbound' ? '#2563eb' : '#e2e8f0',
              color: flightStage === 'outbound' ? '#fff' : '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>✈ Bước 1: Chọn chuyến đi ({from} → {to})</span>
              <span>{formatDate(date)}</span>
            </div>
            <div style={{
              flex: 1, padding: '12px 16px', borderRadius: '12px', background: flightStage === 'inbound' ? '#2563eb' : '#e2e8f0',
              color: flightStage === 'inbound' ? '#fff' : '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>🛬 Bước 2: Chọn chuyến về ({to} → {from})</span>
              <span>{formatDate(returnDate)}</span>
            </div>
          </div>
        )}

        {/* Nút quay lại chọn lại chuyến đi (đã được thiết kế lại đẹp mắt hơn) */}
        {flightStage === 'inbound' && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                setFlightStage('outbound')
                setSelectedOutbound(null)
              }}
            >
              <span>←</span> Quay lại chọn lại chuyến đi
              <span style={{ color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                Đã chọn: {selectedOutbound?.flightNumber}
              </span>
            </button>
          </div>
        )}

        <div className="search-summary">
          <div className="summary-heading">
            <div>
              <span className="summary-eyebrow">
                {flightStage === 'outbound' ? 'CHIỀU ĐI (OUTBOUND)' : 'CHIỀU VỀ (INBOUND)'}
              </span>
              <h2>Thông tin tìm kiếm</h2>
            </div>

            <button
              type="button"
              className="summary-edit-button"
              onClick={() => editing ? setEditing(false) : openEditor()}
            >
              {editing ? 'Hủy sửa' : '✎ Sửa tìm kiếm'}
            </button>
          </div>

          {editing ? (
            <form className="summary-edit-form" onSubmit={(event) => { event.preventDefault(); applySearch() }}>
              <div className="summary-edit-fields">
                <label>
                  <span>Điểm đi</span>
                  <input
                    value={draft.from}
                    maxLength={3}
                    list="results-airport-codes"
                    placeholder="HAN"
                    autoComplete="off"
                    onChange={(event) => updateDraft('from', event.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                  />
                </label>
                <button
                  type="button"
                  className="summary-swap-button"
                  aria-label="Đổi điểm đi và điểm đến"
                  onClick={() => setDraft((current) => ({ ...current, from: current.to, to: current.from }))}
                >⇄</button>
                <label>
                  <span>Điểm đến</span>
                  <input
                    value={draft.to}
                    maxLength={3}
                    list="results-airport-codes"
                    placeholder="SGN"
                    autoComplete="off"
                    onChange={(event) => updateDraft('to', event.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                  />
                </label>
                <label>
                  <span>Ngày đi</span>
                  <input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
                </label>

                {/* Thêm ô Ngày về khi ở chế độ Khứ hồi */}
                {tripType === 'round-trip' && (
                  <label>
                    <span>Ngày về</span>
                    <input type="date" value={draft.returnDate} onChange={(event) => updateDraft('returnDate', event.target.value)} />
                  </label>
                )}

                <label>
                  <span>Hành khách</span>
                  <input type="number" min="1" max="9" value={draft.passengers} onChange={(event) => updateDraft('passengers', event.target.value)} />
                </label>
              </div>
              <datalist id="results-airport-codes">
                {airportCodes.map((code) => {
                  const airport = mockAirports.find((item) => item.code === code)
                  return <option key={code} value={code} label={airport ? `${airport.city} — ${airport.name}` : code} />
                })}
              </datalist>
              {optionsLoading && <p className="summary-edit-message">Đang tải danh sách sân bay...</p>}
              {editError && <p className="summary-edit-error" role="alert">{editError}</p>}
              <div className="summary-edit-actions">
                <button type="button" onClick={() => setEditing(false)}>Hủy</button>
                <button type="submit" disabled={optionsLoading || airportCodes.length === 0}>Cập nhật tìm kiếm</button>
              </div>
            </form>
          ) : (
          <>
          <div className="summary-route">
            <div className="summary-airport">
              <span className="summary-label">ĐIỂM KHỞI HÀNH</span>
              <strong>{currentFromAirport?.city || activeFrom}</strong>
              <span className="summary-code">{activeFrom}</span>
            </div>

            <div className="summary-route-connector">
              <span>✈</span>
              <div />
            </div>

            <div className="summary-airport summary-destination">
              <span className="summary-label">ĐIỂM ĐẾN</span>
              <strong>{currentToAirport?.city || activeTo}</strong>
              <span className="summary-code">{activeTo}</span>
            </div>
          </div>

          {/* Sửa lại CSS flex để icon và nội dung thẳng hàng hoàn hảo */}
          <div className="summary-details">
            <div className="summary-detail-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="summary-detail-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📅</span>
              <div>
                <span>Ngày bay ({flightStage === 'outbound' ? 'Chiều đi' : 'Chiều về'})</span>
                <strong>{formatDate(activeDate)}</strong>
              </div>
            </div>

            <div className="summary-detail-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="summary-detail-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</span>
              <div>
                <span>Hành khách</span>
                <strong>{passengers} hành khách</strong>
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        {loading ? (
          <div className="empty-results">
            <div className="spinner-loader" />
            <p>Đang tìm kiếm chuyến bay phù hợp...</p>
          </div>
        ) : error ? (
          <div className="empty-results">
            <h2>Không thể tải chuyến bay</h2>
            <p>{error}</p>

            <div className="empty-actions">
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Thử lại
              </button>
              <button type="button" className="secondary-btn" onClick={openEditor}>
                Thay đổi tìm kiếm
              </button>
            </div>
          </div>
        ) : flights.length === 0 ? (
          <div className="empty-results">
            <h2>Không tìm thấy chuyến bay</h2>
            <p>Không có chuyến bay phù hợp trong cơ sở dữ liệu với điều kiện tìm kiếm hiện tại.</p>
            <button type="button" onClick={openEditor}>
              Thay đổi tìm kiếm
            </button>
          </div>
        ) : (
          <div className="flight-list">
            {flights.map((flight) => {
              const flightFromAirport = mockAirports.find((airport) => airport.code === flight.departureCode)
              const flightToAirport = mockAirports.find((airport) => airport.code === flight.arrivalCode)
              const enoughSeats = flight.availableSeats >= passengers

              return (
                <article className="flight-card" key={flight.id}>
                  <div className="flight-airline-info">
                    <div className="airline-badge-icon">✈</div>
                    <div>
                      <strong>{flight.airline.name}</strong>
                      <span className="flight-number-tag">{flight.flightNumber}</span>
                    </div>
                  </div>

                  <div className="flight-route-details">
                    <div className="time-location">
                      <strong>{formatTime(flight.departureTime)}</strong>
                      <span>{flightFromAirport?.city || flight.departureCode} ({flight.departureCode})</span>
                    </div>

                    <div className="flight-duration-line">
                      <span>{formatDuration(flight.departureTime, flight.arrivalTime)}</span>
                      <div className="line-visual">
                        <div />
                        <span>→</span>
                      </div>
                      <span className="flight-type-tag">Bay thẳng</span>
                    </div>

                    <div className="time-location text-end">
                      <strong>{formatTime(flight.arrivalTime)}</strong>
                      <span>{flightToAirport?.city || flight.arrivalCode} ({flight.arrivalCode})</span>
                    </div>
                  </div>

                  <div className="flight-pricing-section">
                    <div className="flight-price">
                      <span className="price-label">Giá vé / người</span>
                      <strong>{flight.currentPrice.toLocaleString('vi-VN')} ₫</strong>
                    </div>

                    <div className="flight-seats-info">
                      <span className={`seat-badge ${enoughSeats ? 'success' : 'danger'}`}>
                        {enoughSeats ? `Còn ${flight.availableSeats} chỗ trống` : 'Không đủ chỗ'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`select-flight-btn ${!enoughSeats ? 'disabled' : ''}`}
                      disabled={!enoughSeats}
                      onClick={() => {
                        if (tripType === 'round-trip' && flightStage === 'outbound') {
                          setSelectedOutbound(flight)
                          setFlightStage('inbound')
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        } else {
                          const queryParams = new URLSearchParams({
                            passengers: String(passengers),
                            date: encodeURIComponent(date),
                          })
                          if (tripType === 'round-trip' && selectedOutbound) {
                            queryParams.set('outboundId', encodeURIComponent(String(selectedOutbound.id)))
                            queryParams.set('inboundId', encodeURIComponent(String(flight.id)))
                            queryParams.set('returnDate', encodeURIComponent(returnDate))
                          }
                          navigate(`/flights/${flight.id}?${queryParams.toString()}`)
                        }
                      }}
                    >
                      {enoughSeats
                        ? (tripType === 'round-trip' && flightStage === 'outbound' ? 'Chọn chuyến đi này' : 'Chọn chuyến bay')
                        : 'Hết chỗ'}
                    </button>
                  </div>
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