import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

    const parsed = JSON.parse(saved) as SavedPassengerInfo

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
    const codes: string[] = saved ? JSON.parse(saved) : []

    if (!Array.isArray(codes)) {
      throw new Error('Danh sách mã đặt chỗ đã lưu không hợp lệ.')
    }

    if (!codes.includes(code)) {
      localStorage.setItem(
        BOOKING_CODES_KEY,
        JSON.stringify([...codes, code]),
      )
    }
  }

  async function handlePayment(success: boolean) {
    if (paymentLock.current || processing) return

    if (!success) {
      navigate(
        `/payment/result?status=failure&flightId=${encodeURIComponent(flightId)}&passengers=${passengers}&date=${encodeURIComponent(date)}`,
      )
      return
    }

    if (!flight) {
      setPaymentError('Không có thông tin chuyến bay để thanh toán.')
      return
    }

    paymentLock.current = true
    setProcessing(true)
    setPaymentError('')

    try {
      const savedInfo = getSavedPassengers()
      const firstPassenger = savedInfo.passengers[0]
      const detailsSignature = JSON.stringify(savedInfo)

      let pendingBooking: PendingBooking | null = null

      const pendingRaw = sessionStorage.getItem(PENDING_BOOKING_KEY)

      if (pendingRaw) {
        try {
          const parsed = JSON.parse(pendingRaw) as PendingBooking

          if (
            parsed.flightId === flight.id &&
            parsed.date === date &&
            parsed.passengers === passengers &&
            parsed.detailsSignature === detailsSignature &&
            typeof parsed.bookingCode === 'string' &&
            parsed.bookingCode.length > 0
          ) {
            pendingBooking = parsed

            if (
              typeof parsed.totalAmount === 'number' &&
              Number.isFinite(parsed.totalAmount) &&
              parsed.totalAmount >= 0
            ) {
              setBookingTotalAmount(parsed.totalAmount)
            }
          }
        } catch {
          sessionStorage.removeItem(PENDING_BOOKING_KEY)
        }
      }

      let bookingCode: string

      if (pendingBooking) {
        bookingCode = pendingBooking.bookingCode
      } else {
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

        bookingCode = result.item.bookingCode

        const amount = Number(result.item.totalAmount)
        const validAmount = Number.isFinite(amount) && amount >= 0

        const pending: PendingBooking = {
          flightId: flight.id,
          date,
          passengers,
          bookingCode,
          detailsSignature,
          ...(validAmount ? { totalAmount: amount } : {}),
        }

        if (validAmount) {
          setBookingTotalAmount(amount)
        }

        sessionStorage.setItem(
          PENDING_BOOKING_KEY,
          JSON.stringify(pending),
        )
      }

      // API thanh toán hiện tại là thanh toán mô phỏng của backend.
      await payBooking(bookingCode)

      // Lưu mã để trang Đặt chỗ của tôi tra cứu lại dữ liệu backend.
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

  // Giá hiển thị ban đầu lấy từ API chi tiết chuyến bay.
  const ticketPrice = Number(
    flight.currentPrice ?? flight.basePrice ?? 0,
  )

  // Khi backend đã trả tổng tiền của booking, ưu tiên dùng số tiền đó.
  const totalPrice =
    bookingTotalAmount !== null
      ? bookingTotalAmount
      : ticketPrice * passengers

  return (
    <section className="payment-page">
      <div className="payment-content">
        <h1>Thanh toán đặt vé</h1>

        <p className="demo-notice">
          Vui lòng kiểm tra kỹ thông tin chuyến bay trước khi tiến hành thanh toán.
        </p>

        <div className="payment-card">
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

          <hr />

          <h2>Chi tiết chi phí</h2>

          <p>
            Giá vé mỗi người: <strong>{formatPrice(ticketPrice)}</strong>
          </p>

          <p>
            Số hành khách: <strong>{passengers}</strong>
          </p>

          <p>
            Tổng thanh toán:{' '}
            <strong>{formatPrice(totalPrice)}</strong>
          </p>

          {paymentError && (
            <p className="demo-notice" role="alert">
              {paymentError}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="back-button"
              disabled={processing}
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>

            <button
              type="button"
              className="continue-button"
              disabled={processing}
              onClick={() => void handlePayment(true)}
            >
              {processing ? 'Đang xử lý...' : 'Thanh toán thành công'}
            </button>

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
