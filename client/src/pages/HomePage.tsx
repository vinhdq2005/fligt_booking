import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAirportCodes,
  getPublicAirlines,
  type PublicAirline,
} from '../api'
import { mockAirports } from '../mocks/mockAirports'
import PriceDatePicker from '../components/PriceDatePicker'
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

function AirportPicker({
  id,
  label,
  icon,
  value,
  onChange,
  codes,
  loading,
  error,
}: AirportPickerProps) {
  const [open, setOpen] = useState(false)

  const matches = codes.filter((code) =>
    code.startsWith(value),
  )

  const selectedAirport = mockAirports.find(
    (airport) => airport.code === value,
  )

  return (
    <div className="airport-picker">
      <div className="search-field airport-field">
        <span className="field-icon" aria-hidden="true">
          {icon}
        </span>

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
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onChange={(event) => {
                onChange(
                  event.target.value
                    .replace(/[^a-z]/gi, '')
                    .toUpperCase(),
                )
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                }

                if (
                  event.key === 'Enter' &&
                  open &&
                  matches.length > 0
                ) {
                  event.preventDefault()
                  onChange(matches[0])
                  setOpen(false)
                }
              }}
            />

            {selectedAirport && (
              <span className="airport-city">
                {selectedAirport.city}
              </span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div
          className="airport-suggestions"
          id={`${id}-suggestions`}
          role="listbox"
          aria-label={`Gợi ý ${label.toLowerCase()}`}
        >
          {loading && (
            <p className="airport-message">
              Đang tải sân bay...
            </p>
          )}

          {!loading && error && (
            <p className="airport-message">{error}</p>
          )}

          {!loading && !error && matches.length === 0 && (
            <p className="airport-message">
              Không tìm thấy sân bay trong dữ liệu.
            </p>
          )}

          {!loading &&
            !error &&
            matches.map((code) => {
              const airport = mockAirports.find(
                (item) => item.code === code,
              )

              return (
                <button
                  key={code}
                  type="button"
                  className="airport-option"
                  role="option"
                  aria-selected={value === code}
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => {
                    onChange(code)
                    setOpen(false)
                  }}
                >
                  <span>
                    <strong>
                      {airport?.city || `Sân bay ${code}`}
                    </strong>
                    <small>
                      {airport?.name ||
                        'Sân bay trong hệ thống'}
                    </small>
                  </span>

                  <span className="airport-code">{code}</span>
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}

type AirlinePickerProps = {
  value: string
  onChange: (code: string) => void
  airlines: PublicAirline[]
  loading: boolean
  error: string
}

function AirlinePicker({
  value,
  onChange,
  airlines,
  loading,
  error,
}: AirlinePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  const selectedAirline = airlines.find(
    (airline) => airline.code === value,
  )

  const matches = airlines.filter(
    (airline) =>
      airline.code
        .toLowerCase()
        .includes(query.toLowerCase()) ||
      airline.name
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi')),
  )

  return (
    <div className="airport-picker airline-picker">
      <div className="search-field airport-field">
        <span className="field-icon" aria-hidden="true">
          ✈
        </span>

        <div>
          <label htmlFor="airline">Hãng bay</label>

          <div className="airport-entry">
            <input
              id="airline"
              type="text"
              autoComplete="off"
              placeholder="Tất cả hãng bay"
              value={query}
              role="combobox"
              aria-expanded={open}
              aria-controls="airline-suggestions"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setTimeout(() => {
                  setOpen(false)
                  setQuery(selectedAirline?.name || '')
                }, 200)
              }}
              onChange={(event) => {
                const nextQuery = event.target.value
                setQuery(nextQuery)

                const matched = airlines.find(
                  (item) =>
                    item.code ===
                      nextQuery.trim().toUpperCase() ||
                    item.name.toLocaleLowerCase('vi') ===
                      nextQuery
                        .trim()
                        .toLocaleLowerCase('vi'),
                )

                onChange(matched?.code || '')
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                }

                if (
                  event.key === 'Enter' &&
                  open &&
                  matches.length > 0
                ) {
                  event.preventDefault()
                  onChange(matches[0].code)
                  setQuery(matches[0].name)
                  setOpen(false)
                }
              }}
            />
          </div>
        </div>
      </div>

      {open && (
        <div
          className="airport-suggestions"
          id="airline-suggestions"
          role="listbox"
          aria-label="Gợi ý hãng bay"
        >
          {!loading && !error && (
            <button
              type="button"
              className="airport-option"
              role="option"
              aria-selected={!value}
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onClick={() => {
                onChange('')
                setQuery('')
                setOpen(false)
              }}
            >
              <strong>Tất cả hãng bay</strong>
            </button>
          )}

          {loading && (
            <p className="airport-message">
              Đang tải hãng bay...
            </p>
          )}

          {!loading && error && (
            <p className="airport-message">{error}</p>
          )}

          {!loading && !error && matches.length === 0 && (
            <p className="airport-message">
              Không tìm thấy hãng bay.
            </p>
          )}

          {!loading &&
            !error &&
            matches.map((airline) => (
              <button
                key={airline.code}
                type="button"
                className="airport-option"
                role="option"
                aria-selected={value === airline.code}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => {
                  onChange(airline.code)
                  setQuery(airline.name)
                  setOpen(false)
                }}
              >
                <strong>{airline.name}</strong>
                <span className="airport-code">
                  {airline.code}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()

  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [passengers, setPassengers] = useState(1)

  const [airportCodes, setAirportCodes] = useState<string[]>([])
  const [airportsLoading, setAirportsLoading] = useState(true)
  const [airportsError, setAirportsError] = useState('')

  const [airline, setAirline] = useState('')
  const [airlines, setAirlines] = useState<PublicAirline[]>([])
  const [airlinesLoading, setAirlinesLoading] = useState(true)
  const [airlinesError, setAirlinesError] = useState('')

  useEffect(() => {
    let active = true

    getAirportCodes()
      .then((codes) => {
        if (active) setAirportCodes(codes)
      })
      .catch(() => {
        if (active) {
          setAirportsError(
            'Không tải được danh sách sân bay.',
          )
        }
      })
      .finally(() => {
        if (active) setAirportsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    getPublicAirlines()
      .then((items) => {
        if (active) setAirlines(items)
      })
      .catch(() => {
        if (active) {
          setAirlinesError(
            'Không tải được danh sách hãng bay.',
          )
        }
      })
      .finally(() => {
        if (active) setAirlinesLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleSearch = () => {
    if (!from || !to || !date) {
      alert(
        'Vui lòng chọn điểm đi, điểm đến và ngày đi.',
      )
      return
    }

    if (tripType === 'round-trip' && !returnDate) {
      alert('Vui lòng chọn ngày về cho chuyến khứ hồi.')
      return
    }

    if (tripType === 'round-trip' && returnDate < date) {
      alert('Ngày về không được trước ngày đi.')
      return
    }

    if (
      !airportCodes.includes(from) ||
      !airportCodes.includes(to)
    ) {
      alert(
        'Vui lòng nhập mã sân bay có trong danh sách gợi ý.',
      )
      return
    }

    if (from === to) {
      alert(
        'Điểm đi và điểm đến không được trùng nhau.',
      )
      return
    }

    if (passengers < 1 || passengers > 9) {
      alert('Số hành khách phải từ 1 đến 9.')
      return
    }

    const searchParams = new URLSearchParams({
      tripType,
      from,
      to,
      date,
      passengers: String(passengers),
    })

    if (tripType === 'round-trip' && returnDate) {
      searchParams.set('returnDate', returnDate)
    }

    if (airline) {
      searchParams.set('airline', airline)
    }

    navigate(
      `/flights/results?${searchParams.toString()}`,
    )
  }

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <span className="hero-badge">
              ✈ SKYWAY · FLIGHT BOOKING
            </span>

            <h1>
              Mở lối hành trình,
              <br />
              khám phá thế giới
            </h1>

            <p>
              Tìm kiếm chuyến bay dễ dàng và bắt đầu
              chuyến đi tiếp theo của bạn cùng SkyWay.
            </p>

            <div className="search-box">
              <div className="trip-type">
                <label>
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === 'one-way'}
                    onChange={() => setTripType('one-way')}
                  />
                  Một chiều
                </label>

                <label>
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === 'round-trip'}
                    onChange={() => setTripType('round-trip')}
                  />
                  Khứ hồi
                </label>
              </div>

              <div
                className={`search-fields ${tripType === 'round-trip' ? 'round-trip-layout' : ''}`}
              >
                <AirportPicker
                  id="from"
                  label="Điểm đi"
                  icon="🛫"
                  value={from}
                  onChange={setFrom}
                  codes={airportCodes}
                  loading={airportsLoading}
                  error={airportsError}
                />

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

                <AirportPicker
                  id="to"
                  label="Điểm đến"
                  icon="🛬"
                  value={to}
                  onChange={setTo}
                  codes={airportCodes}
                  loading={airportsLoading}
                  error={airportsError}
                />

                <PriceDatePicker
                  tripType={tripType}
                  from={from}
                  to={to}
                  date={date}
                  returnDate={returnDate}
                  passengers={passengers}
                  airline={airline}
                  onChange={(nextDate, nextReturnDate) => { setDate(nextDate); setReturnDate(nextReturnDate) }}
                />

                {tripType === 'one-way' && (
                  <div className="search-field">
                    <span className="field-icon" aria-hidden="true">
                      👤
                    </span>

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
                )}

                <AirlinePicker
                  value={airline}
                  onChange={setAirline}
                  airlines={airlines}
                  loading={airlinesLoading}
                  error={airlinesError}
                />

                {tripType === 'round-trip' && (
                  <div className="search-field passenger-field">
                    <span className="field-icon" aria-hidden="true">
                      👤
                    </span>

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
                )}
              </div>

              <button
                type="button"
                className="search-button"
                onClick={handleSearch}
              >
                <span aria-hidden="true">🔍</span>
                Tìm chuyến bay
              </button>

              {(airportsError || airlinesError) && (
                <p className="search-api-error" role="alert">
                  Không kết nối được máy chủ dữ liệu. Tìm chuyến bay và đăng nhập cần backend đang hoạt động.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="home-bottom">
        <section
          className="home-section"
          aria-labelledby="destinations-heading"
        >
          <div className="section-heading">
            <div>
              <span className="section-label">
                KHÁM PHÁ VIỆT NAM
              </span>

              <h2 id="destinations-heading">
                Điểm đến nổi bật
              </h2>
            </div>

            <p>
              Cùng SkyWay khám phá những thành phố
              tuyệt vời trên khắp Việt Nam.
            </p>
          </div>

          <div className="destination-grid">
            <article className="destination-card destination-hanoi">
              <div className="destination-content">
                <span aria-hidden="true">🇻🇳</span>
                <h3>Hà Nội</h3>
                <p>HAN · Việt Nam</p>
              </div>
            </article>

            <article className="destination-card destination-saigon">
              <div className="destination-content">
                <span aria-hidden="true">🌆</span>
                <h3>TP. Hồ Chí Minh</h3>
                <p>SGN · Việt Nam</p>
              </div>
            </article>

            <article className="destination-card destination-danang">
              <div className="destination-content">
                <span aria-hidden="true">🏖️</span>
                <h3>Đà Nẵng</h3>
                <p>DAD · Việt Nam</p>
              </div>
            </article>
          </div>
        </section>

        <aside className="demo-banner">
          <div>
            <strong>Cam kết dịch vụ</strong>
            <p>
              Chúng tôi luôn nỗ lực cập nhật lịch trình và giá vé chính xác nhất để mang đến trải nghiệm tốt nhất cho hành khách.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default HomePage
