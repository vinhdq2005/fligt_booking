
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getPublicFlight,
  type PublicFlight,
} from '../api'
import '../styles/passenger-info.css'

type Passenger = {
  fullName: string
  gender: string
  phone: string
  email: string
}

function PassengerInfoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const passengers = Math.min(
    9,
    Math.max(1, Number(searchParams.get('passengers') || '1') || 1),
  )
  const date = searchParams.get('date') || ''

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [passengerList, setPassengerList] = useState<Passenger[]>(
    () =>
      Array.from({ length: passengers }, () => ({
        fullName: '',
        gender: '',
        phone: '',
        email: '',
      })),
  )

  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFlight() {
      const id = Number(flightId)

      if (!flightId || !Number.isInteger(id) || id <= 0) {
        setLoadError('Mã chuyến bay không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const result = await getPublicFlight(id)

        if (!cancelled) {
          setFlight(result.item)
        }
      } catch (err) {
        if (!cancelled) {
          setFlight(null)
          setLoadError(
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

  const updatePassenger = (
    index: number,
    field: keyof Passenger,
    value: string,
  ) => {
    setPassengerList((current) =>
      current.map((passenger, i) =>
        i === index
          ? { ...passenger, [field]: value }
          : passenger,
      ),
    )
  }

  const handleContinue = () => {
  if (!flight) return

  const hasMissingInfo = passengerList.some(
    (passenger) =>
      !passenger.fullName.trim() ||
      !passenger.gender ||
      !passenger.phone.trim() ||
      !passenger.email.trim(),
  )

    if (hasMissingInfo) {
      setError('Vui lòng điền đầy đủ thông tin của tất cả hành khách.')
      return
    }

    const invalidEmail = passengerList.some(
      (passenger) =>
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email),
    )

    if (invalidEmail) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.')
      return
    }

    setError('')

    navigate(
      `/booking/review?flightId=${flight.id}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
    )
  }

  if (loading) {
    return (
      <section className="passenger-info-page">
        <div className="passenger-info-content">
          <h1>Thông tin hành khách</h1>
          <p>Đang tải thông tin chuyến bay...</p>
        </div>
      </section>
    )
  }

  if (loadError || !flight) {
    return (
      <section className="passenger-info-page">
        <div className="passenger-info-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>{loadError || 'Không tìm thấy thông tin chuyến bay.'}</p>
          <button
            type="button"
            className="back-button"
            onClick={() => navigate(-1)}
          >
            Quay lại kết quả
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="passenger-info-page">
      <div className="passenger-info-content">
        <h1>Thông tin hành khách</h1>

        <p className="demo-notice">
          Nhập thông tin minh họa. Không sử dụng dữ liệu cá nhân nhạy cảm.
        </p>

        <p>
          <strong>Chuyến bay:</strong> {flight.airline.name} {flight.flightNumber}
          {' · '}
          <strong>Số hành khách:</strong> {passengers}
        </p>

        <form
          className="passenger-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleContinue()
          }}
        >
          {passengerList.map((passenger, index) => (
            <div className="form-section" key={index}>
              <h2>Hành khách {index + 1}</h2>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor={`fullName-${index}`}>Họ và tên</label>
                  <input
                    id={`fullName-${index}`}
                    type="text"
                    value={passenger.fullName}
                    placeholder="Nhập họ và tên demo"
                    onChange={(event) =>
                      updatePassenger(index, 'fullName', event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`gender-${index}`}>Giới tính</label>
                  <select
                    id={`gender-${index}`}
                    value={passenger.gender}
                    onChange={(event) =>
                      updatePassenger(index, 'gender', event.target.value)
                    }
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor={`phone-${index}`}>Số điện thoại demo</label>
                  <input
                    id={`phone-${index}`}
                    type="tel"
                    value={passenger.phone}
                    placeholder="Nhập số điện thoại demo"
                    onChange={(event) =>
                      updatePassenger(index, 'phone', event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`email-${index}`}>Email demo</label>
                  <input
                    id={`email-${index}`}
                    type="email"
                    value={passenger.email}
                    placeholder="demo@example.com"
                    onChange={(event) =>
                      updatePassenger(index, 'email', event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {error && (
            <p role="alert" className="demo-notice">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>

            <button
              type="submit"
              className="continue-button"
            >
              Tiếp tục
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default PassengerInfoPage