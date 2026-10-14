
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getPublicFlight,
  type PublicFlight,
} from '../api'
import '../styles/passenger-info.css'

type Passenger = {
  fullName: string
  documentNumber: string
  gender: string
  dateOfBirth: string
  nationality: string
}

type SavedInfo = {
  flightId: number
  date: string
  passengers: Passenger[]
  contactEmail: string
  contactPhone: string
  countryCode: string
  contactPhoneNumber: string
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

  const [savedInfo] = useState<SavedInfo | null>(() => {
    try {
      const raw = sessionStorage.getItem('flight-booking-passenger-info')
      if (!raw) return null
      const parsed = JSON.parse(raw) as SavedInfo
      return parsed.flightId === Number(flightId) &&
        parsed.date === date &&
        Array.isArray(parsed.passengers) &&
        parsed.passengers.length === passengers
        ? parsed : null
    } catch {
      return null
    }
  })

  const [passengerList, setPassengerList] = useState<Passenger[]>(
    () =>
      savedInfo?.passengers ?? Array.from({ length: passengers }, () => ({
        fullName: '',
        documentNumber: '',
        gender: '',
        dateOfBirth: '',
        nationality: '',
      })),
  )

  const [error, setError] = useState('')
  const [contactEmail, setContactEmail] = useState(savedInfo?.contactEmail ?? '')
  const [countryCode, setCountryCode] = useState(savedInfo?.countryCode?.replace(/^\+/, '') ?? '84')
  const [contactPhoneNumber, setContactPhoneNumber] = useState(savedInfo?.contactPhoneNumber ?? '')

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
        !passenger.documentNumber.trim() ||
        !passenger.gender ||
        !passenger.dateOfBirth ||
        !passenger.nationality.trim(),
    )

    if (hasMissingInfo) {
      setError('Vui lòng điền đầy đủ thông tin của tất cả hành khách.')
      return
    }

    if (passengerList.some((passenger) => !/^\d{12}$/.test(passenger.documentNumber))) {
      setError('CCCD phải gồm đúng 12 chữ số.')
      return
    }

    if (passengerList.some((passenger) => passenger.nationality.trim().length < 2)) {
      setError('Quốc tịch phải có ít nhất 2 ký tự.')
      return
    }

    if (passengerList.some((passenger) => {
      const parsed = new Date(`${passenger.dateOfBirth}T00:00:00.000Z`)
      return Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== passenger.dateOfBirth ||
        passenger.dateOfBirth > new Date().toISOString().slice(0, 10)
    })) {
      setError('Ngày sinh không hợp lệ hoặc nằm trong tương lai.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError('Vui lòng nhập địa chỉ email liên lạc hợp lệ.')
      return
    }

    const countryCodeDigits = countryCode.trim().replace(/^\+/, '')
    const normalizedContactPhone = `+${countryCodeDigits}${contactPhoneNumber}`

    if (!/^[1-9]\d{0,3}$/.test(countryCodeDigits) ||
        !/^\d{7,14}$/.test(contactPhoneNumber) ||
        contactPhoneNumber.startsWith('0') ||
        normalizedContactPhone.length > 20) {
      setError('Vui lòng nhập mã quốc gia và số điện thoại liên lạc hợp lệ, bỏ số 0 ở đầu.')
      return
    }

    try {
      sessionStorage.setItem(
        'flight-booking-passenger-info',
        JSON.stringify({
          flightId: flight.id,
          date,
          passengers: passengerList,
          contactEmail: contactEmail.trim(),
          contactPhone: normalizedContactPhone,
          countryCode: countryCodeDigits,
          contactPhoneNumber,
        }),
      )
    } catch {
      setError('Không thể lưu thông tin tạm thời. Vui lòng thử lại.')
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

        <p className="demo-notice">Các trường có dấu * là bắt buộc. Điền thông tin đúng như trên CCCD.</p>

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
                  <label htmlFor={`fullName-${index}`}>Họ và tên *</label>
                  <input
                    id={`fullName-${index}`}
                    type="text"
                    value={passenger.fullName}
                    placeholder="Nhập họ và tên theo CCCD"
                    required
                    maxLength={120}
                    onChange={(event) =>
                      updatePassenger(index, 'fullName', event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`documentNumber-${index}`}>CCCD *</label>
                  <input
                    id={`documentNumber-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    autoComplete="off"
                    required
                    value={passenger.documentNumber}
                    placeholder="12 chữ số"
                    onChange={(event) => updatePassenger(index, 'documentNumber', event.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor={`gender-${index}`}>Giới tính *</label>
                  <select id={`gender-${index}`} required value={passenger.gender} onChange={(event) => updatePassenger(index, 'gender', event.target.value)}>
                    <option value="">Chọn giới tính</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor={`dateOfBirth-${index}`}>Ngày sinh *</label>
                  <input
                    id={`dateOfBirth-${index}`}
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={passenger.dateOfBirth}
                    onChange={(event) =>
                      updatePassenger(index, 'dateOfBirth', event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="form-row nationality-row">
                <div className="form-field">
                  <label htmlFor={`nationality-${index}`}>Quốc tịch *</label>
                  <input
                    id={`nationality-${index}`}
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={passenger.nationality}
                    placeholder="Ví dụ: Việt Nam"
                    onChange={(event) => updatePassenger(index, 'nationality', event.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="contact-section">
            <h2>Thông tin liên lạc</h2>
            <p>Thông tin xác nhận đặt chỗ sẽ được gửi đến email và số điện thoại này.</p>
            <div className="form-row nationality-row">
              <div className="form-field">
                <label htmlFor="contactEmail">Địa chỉ email *</label>
                <input
                  id="contactEmail"
                  type="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  value={contactEmail}
                  placeholder="email@example.com"
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="form-row contact-phone-row">
              <div className="form-field">
                <label htmlFor="countryCode">Mã quốc gia *</label>
                <input
                  id="countryCode"
                  type="tel"
                  required
                  maxLength={5}
                  value={countryCode}
                  placeholder="84 hoặc +84"
                  onChange={(event) => setCountryCode(event.target.value.replace(/[^\d+]/g, ''))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="contactPhone">Số điện thoại *</label>
                <input
                  id="contactPhone"
                  type="tel"
                  inputMode="numeric"
                  required
                  minLength={7}
                  maxLength={14}
                  value={contactPhoneNumber}
                  placeholder="Bỏ số 0 ở đầu, ví dụ: 912345678"
                  onChange={(event) => setContactPhoneNumber(event.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
          </div>

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
