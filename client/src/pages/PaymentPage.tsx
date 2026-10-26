import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createBooking,
  getBookingPaymentQr,
  getPublicFlight,
  payBooking,
  type PublicFlight,
  type VietQrPayment,
} from '../api'
import '../styles/payment.css'

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

type PendingBooking = {
  schemaVersion?: number
  flightId?: number
  outboundId?: number
  inboundId?: number
  date: string
  returnDate?: string
  passengers: number
  bookingCode: string
  detailsSignature: string
  totalAmount?: number
  expiresAt?: string
  outboundUnitPrice?: number | null
  returnUnitPrice?: number | null
}

const PASSENGER_STORAGE_KEY = 'flight-booking-passenger-info'
const PENDING_BOOKING_KEY = 'flight-booking-pending'
const BOOKING_CODES_KEY = 'flight-booking-codes'

function PaymentPage() {
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
  const [paymentError, setPaymentError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [bookingCode, setBookingCode] = useState('')
  const [bookedPrice, setBookedPrice] = useState<{ total: number; outbound: number; inbound: number } | null>(null)
  const [paymentQr, setPaymentQr] = useState<VietQrPayment | null>(null)

  const paymentLock = useRef(false)

  useEffect(() => {
    if (!paymentQr?.expiresAt) return
    const remaining = new Date(paymentQr.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(() => {
      setPaymentQr(null)
      setPaymentError('Đặt chỗ đã hết hạn. Tải lại VietQR để tính giá và giữ chỗ mới.')
    }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [paymentQr])

  useEffect(() => {
    let cancelled = false

    async function loadFlightsData() {
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

          const result = await getPublicFlight(id)

          if (cancelled) return

          if (result.item) {
            setFlight(result.item)
          } else {
            setFlight(null)
            setLoadError('Không tìm thấy chuyến bay.')
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

    void loadFlightsData()

    return () => {
      cancelled = true
    }
  }, [flightId, outboundId, inboundId, isRoundTrip])

  const formatPrice = (price: number) =>
    `${Number(price).toLocaleString('vi-VN')} ₫`

  const formatTime = (value: string) => {
    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) return '--:--'

    return parsed.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  function getSavedPassengers(): SavedPassengerInfo {
    const saved = sessionStorage.getItem(PASSENGER_STORAGE_KEY)

    if (!saved) {
      throw new Error(
        'Không tìm thấy thông tin hành khách. Vui lòng quay lại nhập thông tin.',
      )
    }

    let parsed: SavedPassengerInfo

    try {
      parsed = JSON.parse(saved) as SavedPassengerInfo
    } catch {
      throw new Error(
        'Thông tin hành khách đã lưu không hợp lệ. Vui lòng nhập lại.',
      )
    }

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
      !/^\+[1-9]\d{7,18}$/.test(parsed.contactPhone)
    ) {
      throw new Error(
        'Thông tin hành khách không khớp với chuyến bay. Vui lòng quay lại kiểm tra.',
      )
    }

    const validPassengers = parsed.passengers.every(
      (passenger) =>
        typeof passenger.fullName === 'string' &&
        passenger.fullName.trim().length > 0 &&
        typeof passenger.documentNumber === 'string' &&
        /^\d{12}$/.test(passenger.documentNumber) &&
        ['MALE', 'FEMALE'].includes(passenger.gender) &&
        typeof passenger.dateOfBirth === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(passenger.dateOfBirth) &&
        typeof passenger.nationality === 'string' &&
        passenger.nationality.trim().length >= 2,
    )

    if (!validPassengers) {
      throw new Error('Thông tin hành khách không hợp lệ.')
    }

    return parsed
  }

  function saveBookingCode(code: string) {
    const normalizedCode = code.trim()
    if (!normalizedCode) throw new Error('Mã đặt chỗ không hợp lệ.')
    let codes: string[]
    try {
      const saved = localStorage.getItem(BOOKING_CODES_KEY)
      const parsed: unknown = saved ? JSON.parse(saved) : []
      if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) {
        throw new Error('Danh sách mã đặt chỗ không hợp lệ.')
      }
      codes = parsed
    } catch {
      throw new Error('Không thể đọc mã đặt chỗ đã lưu trên trình duyệt.')
    }
    if (!codes.includes(normalizedCode)) {
      try {
        localStorage.setItem(BOOKING_CODES_KEY, JSON.stringify([...codes, normalizedCode]))
      } catch {
        throw new Error('Trình duyệt không cho phép lưu mã đặt chỗ.')
      }
    }
  }

  const ticketPrice = !isRoundTrip && flight ? Number(flight.currentPrice ?? flight.basePrice ?? 0) : 0
  const outboundPrice = isRoundTrip && outboundFlight ? Number(outboundFlight.currentPrice ?? outboundFlight.basePrice ?? 0) : 0
  const inboundPrice = isRoundTrip && inboundFlight ? Number(inboundFlight.currentPrice ?? inboundFlight.basePrice ?? 0) : 0

  const pricePerPassenger = isRoundTrip ? (outboundPrice + inboundPrice) : ticketPrice
  const totalPrice = pricePerPassenger * passengers
  const payableTotal = paymentQr?.amount ?? bookedPrice?.total ?? totalPrice

  async function createOrGetPendingBooking(): Promise<string> {
    if (isRoundTrip && (!outboundFlight || !inboundFlight)) {
      throw new Error('Không có thông tin chuyến bay khứ hồi.')
    }
    if (!isRoundTrip && !flight) {
      throw new Error('Không có thông tin chuyến bay.')
    }

    const savedInfo = getSavedPassengers()
    const firstPassenger = savedInfo.passengers[0]

    if (!firstPassenger) {
      throw new Error('Không tìm thấy thông tin hành khách.')
    }

    const detailsSignature = JSON.stringify(savedInfo)
    const pendingRaw = sessionStorage.getItem(PENDING_BOOKING_KEY)

    if (pendingRaw) {
      try {
        const parsed = JSON.parse(pendingRaw) as PendingBooking

        const matches = isRoundTrip
          ? parsed.schemaVersion === 2 &&
            parsed.outboundId === outboundFlight!.id &&
            parsed.inboundId === inboundFlight!.id &&
            parsed.date === date &&
            parsed.returnDate === returnDate &&
            parsed.passengers === passengers &&
            parsed.detailsSignature === detailsSignature &&
            typeof parsed.expiresAt === 'string' &&
            new Date(parsed.expiresAt).getTime() > Date.now() &&
            typeof parsed.bookingCode === 'string' &&
            parsed.bookingCode.length > 0
          : parsed.flightId === flight!.id &&
            parsed.date === date &&
            parsed.passengers === passengers &&
            parsed.detailsSignature === detailsSignature &&
            typeof parsed.expiresAt === 'string' &&
            new Date(parsed.expiresAt).getTime() > Date.now() &&
            typeof parsed.bookingCode === 'string' &&
            parsed.bookingCode.length > 0

        if (matches) {
          saveBookingCode(parsed.bookingCode)
          setBookingCode(parsed.bookingCode)
          if (typeof parsed.totalAmount === 'number') setBookedPrice({
            total: parsed.totalAmount,
            outbound: parsed.outboundUnitPrice ?? parsed.totalAmount / passengers,
            inbound: parsed.returnUnitPrice ?? 0,
          })
          return parsed.bookingCode
        }
      } catch {
        // Ignore parsing error
      }

      sessionStorage.removeItem(PENDING_BOOKING_KEY)
    }

    const targetFlightId = isRoundTrip ? outboundFlight!.id : flight!.id

    const result = await createBooking({
      flightId: targetFlightId,
      ...(isRoundTrip ? { returnFlightId: inboundFlight!.id } : {}),
      contactName: firstPassenger.fullName.trim(),
      contactEmail: savedInfo.contactEmail.trim(),
      contactPhone: savedInfo.contactPhone,
      passengers: savedInfo.passengers.map((passenger) => ({
        fullName: passenger.fullName.trim(),
        documentNumber: passenger.documentNumber,
        gender: passenger.gender as 'MALE' | 'FEMALE',
        dateOfBirth: passenger.dateOfBirth,
        nationality: passenger.nationality.trim(),
      })),
    })

    if (!result.item?.bookingCode) {
      throw new Error('Backend không trả về mã đặt chỗ.')
    }

    const code = result.item.bookingCode

    const pending: PendingBooking = isRoundTrip
      ? {
          schemaVersion: 2,
          outboundId: outboundFlight!.id,
          inboundId: inboundFlight!.id,
          date,
          returnDate,
          passengers,
          bookingCode: code,
          detailsSignature,
          totalAmount: result.item.totalAmount,
          expiresAt: result.item.expiresAt,
          outboundUnitPrice: result.item.outboundUnitPrice,
          returnUnitPrice: result.item.returnUnitPrice,
        }
      : {
          flightId: flight!.id,
          date,
          passengers,
          bookingCode: code,
          detailsSignature,
          totalAmount: result.item.totalAmount,
          expiresAt: result.item.expiresAt,
          outboundUnitPrice: result.item.outboundUnitPrice,
        }

    sessionStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify(pending),
    )

    saveBookingCode(code)
    setBookingCode(code)
    setBookedPrice({
      total: result.item.totalAmount,
      outbound: result.item.outboundUnitPrice ?? result.item.totalAmount / passengers,
      inbound: result.item.returnUnitPrice ?? 0,
    })

    return code
  }

  async function handleCreatePaymentQR() {
    if (paymentLock.current || processing || (bookingCode && paymentQr)) return

    paymentLock.current = true
    setProcessing(true)
    setPaymentError('')

    try {
      const code = await createOrGetPendingBooking()
      const result = await getBookingPaymentQr(code)
      setPaymentQr(result.item)
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Không thể tạo mã QR thanh toán. Vui lòng thử lại.',
      )
    } finally {
      paymentLock.current = false
      setProcessing(false)
    }
  }

  async function handlePayment(success: boolean) {
    if (paymentLock.current || processing) return

    if (!success) {
      navigate(
        isRoundTrip
          ? `/payment/result?status=failure&outboundId=${encodeURIComponent(outboundId)}&inboundId=${encodeURIComponent(inboundId)}&passengers=${passengers}&date=${encodeURIComponent(date)}&returnDate=${encodeURIComponent(returnDate)}`
          : `/payment/result?status=failure&flightId=${encodeURIComponent(flightId)}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
      )
      return
    }

    if (!bookingCode) {
      setPaymentError('Vui lòng tạo mã QR thanh toán trước.')
      return
    }

    paymentLock.current = true
    setProcessing(true)
    setPaymentError('')

    try {
      await payBooking(bookingCode)

      saveBookingCode(bookingCode)

      sessionStorage.removeItem(PENDING_BOOKING_KEY)
      sessionStorage.removeItem(PASSENGER_STORAGE_KEY)

      navigate(
        `/payment/result?status=success&code=${encodeURIComponent(bookingCode)}`,
      )
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Thanh toán không thành công. Vui lòng thử lại.',
      )
    } finally {
      paymentLock.current = false
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <section className="payment-page">
        <div className="payment-content">
          <h1>Thanh toán</h1>
          <p>Đang tải thông tin chuyến bay...</p>
        </div>
      </section>
    )
  }

  if (loadError || (isRoundTrip && (!outboundFlight || !inboundFlight)) || (!isRoundTrip && !flight)) {
    return (
      <section className="payment-page">
        <div className="payment-content">
          <h1>Không thể thanh toán</h1>
          <p>{loadError || 'Không tìm thấy chuyến bay.'}</p>
          <button type="button" onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="payment-page">
      <div className="payment-content">
        <h1>Thanh toán đặt vé</h1>

        <p className="demo-notice">
          Đây là chức năng thanh toán mô phỏng phục vụ bài tập lớn.
          QR không thực hiện chuyển tiền thật. Không nhập thông tin
          thẻ ngân hàng thật.
        </p>

        <div className="payment-card">
          <section className="payment-section">
            <h2>Thông tin chuyến bay</h2>

            {isRoundTrip && outboundFlight && inboundFlight ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-block', marginBottom: '4px' }}>
                    ✈ CHIỀU ĐI
                  </span>
                  <p><strong>Hãng hàng không:</strong> {outboundFlight.airline.name}</p>
                  <p><strong>Mã chuyến bay:</strong> {outboundFlight.flightNumber}</p>
                  <p><strong>Hành trình:</strong> {outboundFlight.departureCode} → {outboundFlight.arrivalCode}</p>
                  <p><strong>Giờ đi - đến:</strong> {formatTime(outboundFlight.departureTime)} - {formatTime(outboundFlight.arrivalTime)}</p>
                  <p><strong>Ngày đi:</strong> {date || 'Chưa chọn'}</p>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-block', marginBottom: '4px' }}>
                    🛬 CHIỀU VỀ
                  </span>
                  <p><strong>Hãng hàng không:</strong> {inboundFlight.airline.name}</p>
                  <p><strong>Mã chuyến bay:</strong> {inboundFlight.flightNumber}</p>
                  <p><strong>Hành trình:</strong> {inboundFlight.departureCode} → {inboundFlight.arrivalCode}</p>
                  <p><strong>Giờ đi - đến:</strong> {formatTime(inboundFlight.departureTime)} - {formatTime(inboundFlight.arrivalTime)}</p>
                  <p><strong>Ngày về:</strong> {returnDate || 'Chưa chọn'}</p>
                </div>
              </div>
            ) : (
              flight && (
                <>
                  <p>
                    <strong>Hãng hàng không:</strong> {flight.airline.name}
                  </p>

                  <p>
                    <strong>Mã chuyến bay:</strong> {flight.flightNumber}
                  </p>

                  <p>
                    <strong>Hành trình:</strong> {flight.departureCode} →{' '}
                    {flight.arrivalCode}
                  </p>

                  <p>
                    <strong>Giờ khởi hành:</strong>{' '}
                    {formatTime(flight.departureTime)}
                  </p>

                  <p>
                    <strong>Giờ đến:</strong> {formatTime(flight.arrivalTime)}
                  </p>

                  <p>
                    <strong>Ngày đi:</strong> {date || 'Chưa chọn'}
                  </p>
                </>
              )
            )}
          </section>

          <section className="payment-summary">
            <h2>Chi tiết chi phí</h2>

            {isRoundTrip ? (
              <>
                <div className="summary-row">
                  <span>Giá vé chiều đi (mỗi người)</span>
                  <strong>{formatPrice(bookedPrice?.outbound ?? outboundPrice)}</strong>
                </div>
                <div className="summary-row">
                  <span>Giá vé chiều về (mỗi người)</span>
                  <strong>{formatPrice(bookedPrice?.inbound ?? inboundPrice)}</strong>
                </div>
              </>
            ) : (
              <div className="summary-row">
                <span>Giá vé mỗi người</span>
                <strong>{formatPrice(bookedPrice?.outbound ?? ticketPrice)}</strong>
              </div>
            )}

            <div className="summary-row">
              <span>Số hành khách</span>
              <strong>{passengers}</strong>
            </div>

            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>{formatPrice(payableTotal)}</strong>
            </div>
          </section>

          {bookingCode && (
            <section className="payment-section">
              <div className="qr-payment-heading">
                <h2>VietQR theo đặt chỗ</h2>
                <span className="mock-badge">Kiểm tra thông tin trước khi thanh toán</span>
              </div>

              <p className="qr-payment-description">
                Quét bằng ứng dụng ngân hàng để kiểm tra thông tin chuyển khoản.
                Website vẫn dùng nút mô phỏng để xác nhận kết quả.
              </p>

              <div className="qr-payment-panel">
                <div className="qr-code-container">
                  {paymentQr ? (
                    <img src={paymentQr.imageUrl} alt={`VietQR cho đặt chỗ ${bookingCode}`} onError={() => {
                      setPaymentQr(null)
                      setPaymentError('Không tải được ảnh VietQR. Vui lòng thử lại.')
                    }} />
                  ) : (
                    <span>Chưa tải được VietQR</span>
                  )}
                </div>

                <div className="qr-payment-details">
                  <p className="qr-payment-label">Mã đặt chỗ</p>
                  <p className="qr-booking-code">{bookingCode}</p>

                  <p className="qr-payment-label">{paymentQr ? 'Số tiền trên QR' : 'Số tiền đặt chỗ'}</p>
                  <p className="qr-payment-amount">
                    {formatPrice(payableTotal)}
                  </p>

                  {paymentQr && <>
                    <p className="qr-payment-label">Ngân hàng · Số tài khoản</p>
                    <p>{paymentQr.bankId} · {paymentQr.accountNo}</p>
                    <p className="qr-payment-label">Người nhận</p>
                    <p>{paymentQr.accountName}</p>
                    <p className="qr-payment-label">Nội dung chuyển khoản</p>
                    <p>{paymentQr.transferContent}</p>
                  </>}
                </div>
              </div>

              {!paymentQr && <button type="button" className="back-button" disabled={processing} onClick={() => void handleCreatePaymentQR()}>Tải lại VietQR</button>}

              <p className="qr-payment-warning">
                Đây là QR ngân hàng: xác nhận trong ứng dụng sẽ chuyển tiền thật.
                Chỉ quét để xem thông tin.
              </p>
            </section>
          )}

          {paymentError && (
            <p className="payment-error" role="alert">
              {paymentError}
            </p>
          )}

          <div className="payment-actions">
            <button
              type="button"
              className="back-button"
              disabled={processing}
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>

            {!bookingCode ? (
              <button
                type="button"
                className="payment-button"
                disabled={processing}
                onClick={() => void handleCreatePaymentQR()}
              >
                {processing
                  ? 'Đang tạo mã QR...'
                  : 'Tạo QR thanh toán'}
              </button>
            ) : (
              <button
                type="button"
                className="payment-button"
                disabled={processing}
                onClick={() => void handlePayment(true)}
              >
                {processing
                  ? 'Đang xác nhận...'
                  : 'Mô phỏng thanh toán thành công'}
              </button>
            )}

            <button
              type="button"
              className="back-button"
              disabled={processing}
              onClick={() => void handlePayment(false)}
            >
              Mô phỏng thất bại
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PaymentPage