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
  passengers: string
  airline: string
}

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const from = (searchParams.get('from') || '').toUpperCase()
  const to = (searchParams.get('to') || '').toUpperCase()
  const date = searchParams.get('date') || ''
  const airline = (searchParams.get('airline') || '').toUpperCase()

  const passengers = Math.max(
    1,
    Math.min(9, Number(searchParams.get('passengers') || '1') || 1),
  )

  const [flights, setFlights] = useState<PublicFlight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SearchDraft>({ from, to, date, passengers: String(passengers), airline })
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

  function openEditor() {
    setDraft({ from, to, date, passengers: String(passengers), airline })
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

    if (!airportCodes.includes(nextFrom) || !airportCodes.includes(nextTo)) {
      setEditError('Vui lòng chọn mã sân bay có trong danh sách gợi ý.')
      return
    }
    if (nextFrom === nextTo) {
      setEditError('Điểm đi và điểm đến không được trùng nhau.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== draft.date) {
      setEditError('Ngày đi không hợp lệ.')
      return
    }
    if (!Number.isInteger(nextPassengers) || nextPassengers < 1 || nextPassengers > 9) {
      setEditError('Số hành khách phải từ 1 đến 9.')
      return
    }
    if (airlineText && !matchedAirline) {
      setEditError('Vui lòng chọn hãng bay có trong danh sách gợi ý.')
      return
    }

    const nextSearch = new URLSearchParams({
      from: nextFrom,
      to: nextTo,
      date: draft.date,
      passengers: String(nextPassengers),
    })
    if (nextAirline) nextSearch.set('airline', nextAirline)
    setSearchParams(nextSearch)
    setEditing(false)
    setRetryCount((count) => count + 1)
  }

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
  }, [from, to, date, airline, retryCount])

  const fromAirport = mockAirports.find(
    (airport) => airport.code === from,
  )

  const toAirport = mockAirports.find(
    (airport) => airport.code === to,
  )

  return (
    <section className="flight-results-page">
      <div className="flight-results-content">
        <div className="results-header-section">
          <h1>Kết quả tìm kiếm chuyến bay</h1>
          <p className="demo-notice">
            Hệ thống cung cấp thông tin chuyến bay trực tuyến từ cơ sở dữ liệu.
          </p>
        </div>

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
                <label>
                  <span>Hành khách</span>
                  <input type="number" min="1" max="9" value={draft.passengers} onChange={(event) => updateDraft('passengers', event.target.value)} />
                </label>
                <label>
                  <span>Hãng bay (tùy chọn)</span>
                  <input
                    value={draft.airline}
                    maxLength={120}
                    list="results-airlines"
                    placeholder="Tất cả hãng bay"
                    autoComplete="off"
                    onChange={(event) => updateDraft('airline', event.target.value)}
                    onBlur={() => {
                      const selected = airlines.find((item) =>
                        item.code === draft.airline.trim().toUpperCase() ||
                        item.name.toLocaleLowerCase('vi') === draft.airline.trim().toLocaleLowerCase('vi'),
                      )
                      if (selected) setDraft((current) => ({ ...current, airline: selected.name }))
                    }}
                  />
                </label>
              </div>
              <datalist id="results-airport-codes">
                {airportCodes.map((code) => {
                  const airport = mockAirports.find((item) => item.code === code)
                  return <option key={code} value={code} label={airport ? `${airport.city} — ${airport.name}` : code} />
                })}
              </datalist>
              <datalist id="results-airlines">
                {airlines.map((item) => <option key={item.code} value={item.name} label={item.code} />)}
              </datalist>
              {optionsLoading && <p className="summary-edit-message">Đang tải sân bay và hãng bay...</p>}
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
              <span className="summary-detail-icon">📅</span>
              <div>
                <span>Ngày khởi hành</span>
                <strong>{formatDate(date)}</strong>
              </div>
            </div>

            <div className="summary-detail-item">
              <span className="summary-detail-icon">👤</span>
              <div>
                <span>Hành khách</span>
                <strong>{passengers} hành khách</strong>
              </div>
            </div>

            {airline && (
              <div className="summary-detail-item">
                <span className="summary-detail-icon">✈</span>
                <div><span>Hãng bay</span><strong>{airlines.find((item) => item.code === airline)?.name || flights.find((item) => item.airline.code === airline)?.airline.name || airline}</strong></div>
              </div>
            )}

            {airline && <button
              type="button"
              className="summary-clear-button"
              onClick={() => {
                const nextSearch = new URLSearchParams(searchParams)
                nextSearch.delete('airline')
                setSearchParams(nextSearch)
              }}
            >
              Bỏ lọc hãng
            </button>}
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
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Thử lại
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={openEditor}
              >
                Thay đổi tìm kiếm
              </button>
            </div>
          </div>
        ) : flights.length === 0 ? (
          <div className="empty-results">
            <h2>Không tìm thấy chuyến bay</h2>
            <p>
              Không có chuyến bay phù hợp trong cơ sở dữ liệu
              với điều kiện tìm kiếm hiện tại của bạn.
            </p>

            <button
              type="button"
              onClick={openEditor}
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
                  <div className="flight-airline-info">
                    <div className="airline-badge-icon">✈</div>
                    <div>
                      <strong>{flight.airline.name}</strong>
                      <span className="flight-number-tag">{flight.flightNumber}</span>
                    </div>
                  </div>

                  <div className="flight-route-details">
                    <div className="time-location">
                      <strong>
                        {formatTime(flight.departureTime)}
                      </strong>
                      <span>
                        {flightFromAirport?.city ||
                          flight.departureCode}
                        {' '}({flight.departureCode})
                      </span>
                    </div>

                    <div className="flight-duration-line">
                      <span>
                        {formatDuration(
                          flight.departureTime,
                          flight.arrivalTime,
                        )}
                      </span>
                      <div className="line-visual">
                        <div />
                        <span>→</span>
                      </div>
                      <span className="flight-type-tag">Bay thẳng</span>
                    </div>

                    <div className="time-location text-end">
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

                  <div className="flight-pricing-section">
                    <div className="flight-price">
                      <span className="price-label">Giá vé / người</span>
                      <strong>
                        {flight.currentPrice.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="flight-seats-info">
                      <span className={`seat-badge ${enoughSeats ? 'success' : 'danger'}`}>
                        {enoughSeats ? `Còn ${flight.availableSeats} chỗ trống` : 'Không đủ chỗ'}
                      </span>
                      <span className="seat-subtext">
                        Sức chứa tổng: {flight.capacity} chỗ
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`select-flight-btn ${!enoughSeats ? 'disabled' : ''}`}
                      disabled={!enoughSeats}
                      onClick={() =>
                        navigate(
                          `/flights/${flight.id}?passengers=${passengers}&date=${encodeURIComponent(date)}`,
                        )
                      }
                    >
                      {enoughSeats
                        ? 'Chọn chuyến'
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