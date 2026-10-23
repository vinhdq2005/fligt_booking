
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../auth/authApi'
import '../styles/auth.css'

function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin.')
      return
    }

    if (password.length < 10) {
      setError('Mật khẩu phải có ít nhất 10 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setSubmitting(true)

    try {
      await register(normalizedName, normalizedEmail, password)

      setSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập.')

      window.setTimeout(() => {
        navigate('/login')
      }, 1000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng ký.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout auth-register-layout">
        <section className="auth-visual auth-register-visual">
          <div className="auth-sky-glow auth-sky-glow-one" />
          <div className="auth-sky-glow auth-sky-glow-two" />

          <div className="auth-brand">
            <span className="auth-brand-icon">✈</span>
            <div>
              <span className="auth-brand-name">SkyWay</span>
              <span className="auth-brand-tagline">
                Bay xa hơn, gần nhau hơn
              </span>
            </div>
          </div>

          <div className="auth-visual-content">
            <span className="auth-eyebrow">
              <span className="auth-eyebrow-dot" />
              DISCOVER SOMETHING NEW
            </span>

            <h2>
              Thế giới rộng lớn,
              <br />
              <span>hãy cùng khám phá.</span>
            </h2>

            <p>
              Tạo tài khoản SkyWay để bắt đầu lên kế hoạch cho
              những chuyến đi và hành trình đáng nhớ của bạn.
            </p>

            <div className="auth-flight-scene" aria-hidden="true">
              <div className="auth-orbit auth-orbit-one" />
              <div className="auth-orbit auth-orbit-two" />
              <span className="auth-plane">✈</span>
              <span className="auth-cloud auth-cloud-one">☁</span>
              <span className="auth-cloud auth-cloud-two">☁</span>
              <span className="auth-spark auth-spark-one">✦</span>
              <span className="auth-spark auth-spark-two">✧</span>
            </div>
          </div>

          <div className="auth-visual-footer">
            <div className="auth-feature-icon">✧</div>
            <div>
              <strong>Mỗi hành trình đều có khởi đầu</strong>
              <span>Tạo tài khoản và sẵn sàng cất cánh.</span>
            </div>
          </div>
        </section>

        <section className="auth-form-panel auth-register-panel">
          <div className="auth-card auth-register-card">
            <div className="auth-welcome">
              <span className="auth-welcome-icon">✦</span>
              <span>Gia nhập cộng đồng SkyWay</span>
            </div>

            <h1>Tạo tài khoản</h1>

            <p className="auth-subtitle">
              Điền thông tin bên dưới để bắt đầu hành trình của bạn.
            </p>

            <form onSubmit={handleRegister}>
              <div className="form-field">
                <label htmlFor="fullName">Họ và tên</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M4 21v-2a8 8 0 0 1 16 0v2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>

                  <input
                    id="fullName"
                    type="text"
                    placeholder="Nhập họ và tên của bạn"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="email">Địa chỉ email</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="m4 7 8 6 8-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="password">Mật khẩu</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="4"
                        y="10"
                        width="16"
                        height="11"
                        rx="2.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M8 10V7a4 4 0 0 1 8 0v3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
                    </svg>
                  </span>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ít nhất 10 ký tự"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                <span className="auth-field-hint">
                  Sử dụng mật khẩu có ít nhất 10 ký tự.
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="4"
                        y="10"
                        width="16"
                        height="11"
                        rx="2.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M8 10V7a4 4 0 0 1 8 0v3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="m9 15 2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={
                      showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                    }
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="auth-success" role="status">
                  <span aria-hidden="true">✓</span> {success}
                </p>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={submitting}
              >
                <span>{submitting ? 'Đang đăng ký…' : 'Tạo tài khoản'}</span>
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="auth-secure-note">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="m8.5 12 2.3 2.3 4.7-5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Thông tin của bạn được bảo vệ an toàn</span>
            </div>

            <div className="auth-link">
              <span>Đã có tài khoản?</span>
              <button
                type="button"
                onClick={() => navigate('/login')}
              >
                Đăng nhập <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <p className="auth-bottom-note">
            © SkyWay · Cùng bạn khám phá mọi hành trình
          </p>
        </section>
      </div>
    </main>
  )
}

export default RegisterPage
