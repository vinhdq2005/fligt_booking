
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublicFlight, type PublicFlight } from '../api'
import '../styles/payment.css'

function PaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || ''
  const date = searchParams.get('date') || ''

  const passengerValue = Number(searchParams.get('passengers') || '1')
  const passengers = Math.min(
    9,
    Math.max(
      1,
      Number.isFinite(passengerValue) ? Math.floor(passengerValue) : 1,
    ),
  )

  const [flight, setFlight] = useState<PublicFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

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
        const response = await getPublicFlight(id)

        if (cancelled) return

        if (response.item) {
          setFlight(response.item)
        } else {
          setFlight(null)
          setLoadError('Không tìm thấy thông tin chuyến bay.')
        }
      } catch (error: unknown) {
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

  const formatPrice = (price: number) => {
    return Number(price).toLocaleString('vi-VN') + ' ₫'
  }

  const handlePayment = (status: 'success' | 'failure') => {
    if (!flight) return

    navigate(
      '/payment/result?status=' +
        status +
        '&flightId=' +
        String(flight.id) +
        '&passengers=' +
        String(passengers) +
        '&date=' +
        encodeURIComponent(date),
    )
  }

  if (loading) {
    return (
      <section className="payment-page">
        <div className="payment-content">
          <h1>Đang tải thông tin thanh toán...</h1>
          <p>Vui lòng chờ trong giây lát.</p>
        </div>
      </section>
    )
  }

  if (!flight) {
    return (
      <section className="payment-page">
        <div className="payment-content">
          <h1>Không tìm thấy chuyến bay</h1>
          <p>
            {loadError || 'Vui lòng quay lại và chọn chuyến bay khác.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/flights/results')}
          >
            Quay lại kết quả
          </button>
        </div>
      </section>
    )
  }

  const ticketPrice = Number(flight.basePrice)
  const totalPrice = ticketPrice * passengers

  return (
    <section className="payment-page">
      <div className="payment-content">
        <h1>Thanh toán</h1>

        <p className="demo-notice">
          Đây là trang thanh toán giả lập. Không sử dụng thông tin thẻ
          hoặc tài khoản thật.
        </p>

        <div className="payment-card">
          <div className="payment-section">
            <h2>Thông tin chuyến bay</h2>

            <p>
              <strong>Hãng bay:</strong> {flight.airline.name}
            </p>

            <p>
              <strong>Chuyến bay:</strong> {flight.flightNumber}
            </p>

            <p>
              <strong>Hành trình:</strong> {flight.departureCode} →{' '}
              {flight.arrivalCode}
            </p>

            <p>
              <strong>Ngày đi:</strong> {date || 'Chưa chọn'}
            </p>

            <p>
              <strong>Số hành khách:</strong> {passengers} người
            </p>
          </div>

          <div className="payment-section">
            <h2>Phương thức thanh toán</h2>

            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="bank"
                defaultChecked
              />
              <div>
                <strong>Chuyển khoản ngân hàng</strong>
                <span>Thanh toán giả lập</span>
              </div>
            </label>

            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="card"
              />
              <div>
                <strong>Thẻ thanh toán</strong>
                <span>Chỉ mô phỏng, không sử dụng thẻ thật</span>
              </div>
            </label>

            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="wallet"
              />
              <div>
                <strong>Ví điện tử</strong>
                <span>Phương thức thanh toán minh họa</span>
              </div>
            </label>
          </div>

          <div className="payment-summary">
            <div className="summary-row">
              <span>Giá vé / người</span>
              <strong>{formatPrice(ticketPrice)}</strong>
            </div>

            <div className="summary-row">
              <span>Số hành khách</span>
              <strong>{passengers} người</strong>
            </div>

            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>{formatPrice(totalPrice)}</strong>
            </div>
          </div>

          <div className="payment-actions">
            <button
              type="button"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>

            <button
              type="button"
              className="payment-button"
              onClick={() => handlePayment('success')}
            >
              Mô phỏng thanh toán thành công
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => handlePayment('failure')}
            >
              Mô phỏng thanh toán thất bại
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PaymentPage