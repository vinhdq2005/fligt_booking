
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockFlights } from '../mocks/mockFlights'
import '../styles/payment.css'

function PaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flightId = searchParams.get('flightId') || 'flight-001'
  const passengers = Math.min(
    9,
    Math.max(1, Number(searchParams.get('passengers') || '1')),
  )
  const date = searchParams.get('date') || ''

  const flight = mockFlights.find(
    (item) => item.id === flightId,
  )

  if (!flight) {
    return (
      <section className="payment-page">
        <div className="payment-content">
          <h1>Không tìm thấy chuyến bay</h1>
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

  const totalPrice = flight.price * passengers

  const handlePayment = (status: 'success' | 'failure') => {
    navigate(
      `/payment/result?status=${status}&flightId=${flight.id}&passengers=${passengers}&date=${date}`,
    )
  }

  return (
    <section className="payment-page">
      <div className="payment-content">
        <h1>Thanh toán</h1>

        <p className="demo-notice">
          Đây là trang thanh toán giả lập. Không sử dụng
          thông tin thẻ hoặc tài khoản thật.
        </p>

        <div className="payment-card">
          <div className="payment-section">
            <h2>Thông tin chuyến bay</h2>

            <p>
              <strong>Hãng bay:</strong> {flight.airline}
            </p>

            <p>
              <strong>Chuyến bay:</strong> {flight.flightNumber}
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
              <strong>
                {flight.price.toLocaleString('vi-VN')} ₫
              </strong>
            </div>

            <div className="summary-row">
              <span>Số hành khách</span>
              <strong>{passengers} người</strong>
            </div>

            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>
                {totalPrice.toLocaleString('vi-VN')} ₫
              </strong>
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