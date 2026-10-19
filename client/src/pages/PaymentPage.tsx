
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  createBooking,
  getPublicFlight,
  payBooking,
  type PublicFlight,
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
  flightId: number
  date: string
  passengers: Passenger[]
  contactEmail: string
  contactPhone: string
}

type PendingBooking = {
  flightId: number
  date: string
  passengers: number
  bookingCode: string
  detailsSignature: string
  totalAmount?: number
}

const PASSENGER_STORAGE_KEY = 'flight-booking-passenger-info'
const PENDING_BOOKING_KEY = 'flight-booking-pending'
const BOOKING_CODES_KEY = 'flight-booking-codes'

function PaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const date = searchParams.get('date') || ''

  const passengerParam = Number(searchParams.get('passengers') || '1')
  const passengers = Math.min(
    9,
    Math.max(
      1,
      Number.isFinite(passengerParam) ? Math.floor(passengerParam) : 1,
    ),
  )

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [bookingTotalAmount, setBookingTotalAmount] = useState<number | null>(
    null,
  )
  const [bookingCode, setBookingCode] = useState('')

  const paymentLock = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadFlight() {
      const id = Number(flightId)

      if (!flightId || !Number.isInteger(id) || id <= 0) {
        setFlight(null)
        setLoadError('Mã chuyến bay không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const result = await getPublicFlight(id)

        if (cancelled) return

        if (result.item) {
          setFlight(result.item)
        } else {
          setFlight(null)
          setLoadError('Không tìm thấy chuyến bay.')
        }
      } catch (error) {
        if (cancelled) return

        setFlight(null)
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

    void loadFlight()

    return () => {
      cancelled = true
    }
  }, [flightId])

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

    if (
      parsed.flightId !== Number(flightId) ||
      parsed.date !== date ||
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
    const saved = localStorage.getItem(BOOKING_CODES_KEY)
    const codes: unknown = saved ? JSON.parse(saved) : []

    if (
      !Array.isArray(codes) ||
      !codes.every((item) => typeof item === 'string')
    ) {
      throw new Error('Danh sách mã đặt chỗ đã lưu không hợp lệ.')
    }

    if (!codes.includes(code)) {
      localStorage.setItem(
        BOOKING_CODES_KEY,
        JSON.stringify([...codes, code]),
      )
    }
  }

  /**
   * Tạo booking ở trạng thái chờ thanh toán hoặc dùng lại booking
   * đang chờ thanh toán nếu thông tin hành khách không thay đổi.
   *
   * Hàm này KHÔNG gọi API payBooking và KHÔNG phát hành vé.
   */
  async function createOrGetPendingBooking(): Promise<string> {
    if (!flight) {
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

        const matches =
          parsed.flightId === flight.id &&
          parsed.date === date &&
          parsed.passengers === passengers &&
          parsed.detailsSignature === detailsSignature &&
          typeof parsed.bookingCode === 'string' &&
          parsed.bookingCode.length > 0

        if (matches) {
          if (
            typeof parsed.totalAmount === 'number' &&
            Number.isFinite(parsed.totalAmount) &&
            parsed.totalAmount >= 0
          ) {
            setBookingTotalAmount(parsed.totalAmount)
          }

          setBookingCode(parsed.bookingCode)
          return parsed.bookingCode
        }
      } catch {
        // Dữ liệu chờ thanh toán bị lỗi: tạo lại booking.
      }

      sessionStorage.removeItem(PENDING_BOOKING_KEY)
    }

    const result = await createBooking({
      flightId: flight.id,
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
    const amount = Number(result.item.totalAmount)
    const validAmount = Number.isFinite(amount) && amount >= 0

    const pending: PendingBooking = {
      flightId: flight.id,
      date,
      passengers,
      bookingCode: code,
      detailsSignature,
      ...(validAmount ? { totalAmount: amount } : {}),
    }

    sessionStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify(pending),
    )

    if (validAmount) {
      setBookingTotalAmount(amount)
    }

    setBookingCode(code)

    return code
  }

  /**
   * Bước 1: tạo booking và hiển thị QR thanh toán giả lập.
   * Chưa xác nhận thanh toán và chưa phát hành vé.
   */
  async function handleCreatePaymentQR() {
    if (paymentLock.current || processing || bookingCode) return

    paymentLock.current = true
    setProcessing(true)
    setPaymentError('')

    try {
      await createOrGetPendingBooking()
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

  /**
   * Bước 2: chỉ gọi backend thanh toán khi người dùng xác nhận.
   */
  async function handlePayment(success: boolean) {
    if (paymentLock.current || processing) return

    if (!success) {
      navigate(
        `/payment/result?status=failure&flightId=${encodeURIComponent(flightId)}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
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
      // Backend xác nhận thanh toán và phát hành vé.
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

  if (loadError || !flight) {
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

  const ticketPrice = Number(
    flight.currentPrice ?? flight.basePrice ?? 0,
  )

  const totalPrice =
    bookingTotalAmount !== null
      ? bookingTotalAmount
      : ticketPrice * passengers

  // Đây là chuỗi dữ liệu QR giả lập, không phải mã QR chuyển khoản ngân hàng.
  const qrValue = bookingCode
    ? JSON.stringify({
        type: 'FLIGHT_BOOKING_MOCK_PAYMENT',
        bookingCode,
        amount: totalPrice,
        currency: 'VND',
        description: `Thanh toan dat ve ${bookingCode}`,
      })
    : ''

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
          </section>

          <section className="payment-summary">
            <h2>Chi tiết chi phí</h2>

            <div className="summary-row">
              <span>Giá vé mỗi người</span>
              <strong>{formatPrice(ticketPrice)}</strong>
            </div>

            <div className="summary-row">
              <span>Số hành khách</span>
              <strong>{passengers}</strong>
            </div>

            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>{formatPrice(totalPrice)}</strong>
            </div>
          </section>

          {bookingCode && (
            <section className="payment-section">
              <div className="qr-payment-heading">
                <h2>QR thanh toán mô phỏng</h2>
                <span className="mock-badge">DEMO</span>
              </div>

              <p className="qr-payment-description">
                Quét mã để xem thông tin thanh toán mô phỏng.
                Việc quét mã không tự động xác nhận thanh toán.
              </p>

              <div className="qr-payment-panel">
                <div className="qr-code-container">
                  <QRCodeSVG
                    value={qrValue}
                    size={220}
                    level="M"
                    marginSize={2}
                    title={`QR thanh toán mô phỏng ${bookingCode}`}
                  />
                </div>

                <div className="qr-payment-details">
                  <p className="qr-payment-label">Mã đặt chỗ</p>
                  <p className="qr-booking-code">{bookingCode}</p>

                  <p className="qr-payment-label">Số tiền mô phỏng</p>
                  <p className="qr-payment-amount">
                    {formatPrice(totalPrice)}
                  </p>

                  <p className="qr-payment-label">Nội dung</p>
                  <p>Thanh toán đặt vé {bookingCode}</p>
                </div>
              </div>

              <p className="qr-payment-warning">
                Đây không phải QR chuyển khoản ngân hàng. Để hoàn tất
                bài mô phỏng, hãy bấm nút xác nhận bên dưới.
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
