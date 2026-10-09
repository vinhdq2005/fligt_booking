import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'

function HomePage() {
  const navigate = useNavigate()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [passengers, setPassengers] = useState(1)

  const handleSearch = () => {
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
                <div className="search-field">
                  <span className="field-icon">🛫</span>

                  <div>
                    <label htmlFor="from">Điểm đi</label>

                    <select
                      id="from"
                      value={from}
                      onChange={(event) =>
                        setFrom(event.target.value)
                      }
                    >
                      <option value="">
                        Chọn điểm đi
                      </option>

                      <option value="HAN">
                        Hà Nội (HAN)
                      </option>

                      <option value="SGN">
                        TP. Hồ Chí Minh (SGN)
                      </option>

                      <option value="DAD">
                        Đà Nẵng (DAD)
                      </option>

                      <option value="HPH">
                        Hải Phòng (HPH)
                      </option>
                    </select>
                  </div>
                </div>

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

                <div className="search-field">
                  <span className="field-icon">🛬</span>

                  <div>
                    <label htmlFor="to">Điểm đến</label>

                    <select
                      id="to"
                      value={to}
                      onChange={(event) =>
                        setTo(event.target.value)
                      }
                    >
                      <option value="">
                        Chọn điểm đến
                      </option>

                      <option value="HAN">
                        Hà Nội (HAN)
                      </option>

                      <option value="SGN">
                        TP. Hồ Chí Minh (SGN)
                      </option>

                      <option value="DAD">
                        Đà Nẵng (DAD)
                      </option>

                      <option value="HPH">
                        Hải Phòng (HPH)
                      </option>
                    </select>
                  </div>
                </div>

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