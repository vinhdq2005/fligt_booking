import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAirportCodes } from '../api'
import { mockAirports } from '../mocks/mockAirports'
import '../styles/home.css'

type AirportPickerProps = {
  id: string
  label: string
  icon: string
  value: string
  onChange: (code: string) => void
  codes: string[]
  loading: boolean
  error: string
}

function AirportPicker({ id, label, icon, value, onChange, codes, loading, error }: AirportPickerProps) {
  const [open, setOpen] = useState(false)
  const matches = codes.filter((code) => code.startsWith(value))
  const selectedAirport = mockAirports.find((airport) => airport.code === value)

  return (
    <div className="airport-picker">
      <div className="search-field airport-field">
        <span className="field-icon" aria-hidden="true">{icon}</span>
        <div>
          <label htmlFor={id}>{label}</label>
          <div className="airport-entry">
            <input
              id={id}
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={3}
              placeholder="Mã sân bay"
              value={value}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-suggestions`}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onChange={(event) => {
                onChange(event.target.value.replace(/[^a-z]/gi, '').toUpperCase())
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
                if (event.key === 'Enter' && open && matches.length > 0) {
                  event.preventDefault()
                  onChange(matches[0])
                  setOpen(false)
                }
              }}
            />
            {selectedAirport && <span className="airport-city">{selectedAirport.city}</span>}
          </div>
        </div>
      </div>
      {open && (
        <div className="airport-suggestions" id={`${id}-suggestions`} role="listbox" aria-label={`Gợi ý ${label.toLowerCase()}`}>
          {loading && <p className="airport-message">Đang tải sân bay...</p>}
          {!loading && error && <p className="airport-message">{error}</p>}
          {!loading && !error && matches.length === 0 && (
            <p className="airport-message">Không tìm thấy sân bay trong dữ liệu chuyến bay.</p>
          )}
          {!loading && !error && matches.map((code) => {
            const airport = mockAirports.find((item) => item.code === code)
            return (
              <button
                key={code}
                type="button"
                className="airport-option"
                role="option"
                aria-selected={value === code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(code)
                  setOpen(false)
                }}
              >
                <span><strong>{airport?.city || `Sân bay ${code}`}</strong><small>{airport?.name || 'Sân bay trong dữ liệu chuyến bay'}</small></span>
                <span className="airport-code">{code}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [airportCodes, setAirportCodes] = useState<string[]>([])
  const [airportsLoading, setAirportsLoading] = useState(true)
  const [airportsError, setAirportsError] = useState('')

  useEffect(() => {
    let active = true
    getAirportCodes()
      .then((codes) => { if (active) setAirportCodes(codes) })
      .catch(() => { if (active) setAirportsError('Không tải được danh sách sân bay.') })
      .finally(() => { if (active) setAirportsLoading(false) })
    return () => { active = false }
  }, [])

const handleSearch = () => {
  if (!from || !to || !date) {
    alert('Vui lòng chọn điểm đi, điểm đến và ngày đi.')
    return
  }

  if (!airportCodes.includes(from) || !airportCodes.includes(to)) {
    alert('Vui lòng nhập mã sân bay có trong danh sách gợi ý.')
    return
  }

  if (from === to) {
    alert('Điểm đi và điểm đến không được trùng nhau.')
    return
  }

  if (passengers < 1 || passengers > 9) {
    alert('Số hành khách phải từ 1 đến 9.')
    return
  }

  const searchParams = new URLSearchParams({
    from,
    to,
    date,
    passengers: String(passengers),
  })

  navigate(`/flights/results?${searchParams.toString()}`)
}
  return (
    <section className="home-page">
      <div className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <span className="hero-badge">✈ Flight Booking</span>

            <h1>Khám phá hành trình của bạn</h1>

            <p>
              Tìm kiếm chuyến bay nhanh chóng, đơn giản và thuận tiện.
            </p>

            <div className="search-box">
              <div className="trip-type">
                <label>
                  <input
                    type="radio"
                    name="tripType"
                    defaultChecked
                  />
                  Một chiều
                </label>

                <label>
                  <input
                    type="radio"
                    name="tripType"
                  />
                  Khứ hồi
                </label>
              </div>

              <div className="search-fields">
                <AirportPicker id="from" label="Điểm đi" icon="🛫" value={from} onChange={setFrom} codes={airportCodes} loading={airportsLoading} error={airportsError} />

                <button
                  type="button"
                  className="swap-button"
                  aria-label="Đổi điểm đi và điểm đến"
                  onClick={() => {
                    const currentFrom = from
                    setFrom(to)
                    setTo(currentFrom)
                  }}
                >
                  ⇄
                </button>

                <AirportPicker id="to" label="Điểm đến" icon="🛬" value={to} onChange={setTo} codes={airportCodes} loading={airportsLoading} error={airportsError} />

                <div className="search-field">
                  <span className="field-icon">📅</span>

                  <div>
                    <label htmlFor="date">
                      Ngày đi
                    </label>

                    <input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(event) =>
                        setDate(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="search-field">
                  <span className="field-icon">👤</span>

                  <div>
                    <label htmlFor="passengers">
                      Hành khách
                    </label>

                    <input
                      id="passengers"
                      type="number"
                      min="1"
                      max="9"
                      value={passengers}
                      onChange={(event) =>
                        setPassengers(
                          Number(event.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="search-button"
                onClick={handleSearch}
              >
                <span>🔍</span>
                Tìm chuyến bay
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="home-bottom">
        <div className="home-section">
          <div className="section-heading">
            <div>
              <span className="section-label">
                KHÁM PHÁ
              </span>

              <h2>Điểm đến phổ biến</h2>
            </div>

            <p>
              Những hành trình được nhiều hành khách lựa chọn
            </p>
          </div>

          <div className="destination-grid">
            <article className="destination-card destination-hanoi">
              <div className="destination-content">
                <span>🇻🇳</span>
                <h3>Hà Nội</h3>
                <p>HAN · Việt Nam</p>
              </div>
            </article>

            <article className="destination-card destination-saigon">
              <div className="destination-content">
                <span>🌆</span>
                <h3>TP. Hồ Chí Minh</h3>
                <p>SGN · Việt Nam</p>
              </div>
            </article>

            <article className="destination-card destination-danang">
              <div className="destination-content">
                <span>🏖️</span>
                <h3>Đà Nẵng</h3>
                <p>DAD · Việt Nam</p>
              </div>
            </article>
          </div>
        </div>

        <div className="demo-banner">
          <div>
            <strong>Thông tin trình diễn</strong>

            <p>
              Các chuyến bay, giá vé và thông tin đặt chỗ
              trên website là dữ liệu minh họa.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomePage
