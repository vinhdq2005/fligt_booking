
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login } from '../auth/authApi'
import { useAuth } from '../auth/AuthContext'
import '../styles/auth.css'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.')
      return
    }

    setSubmitting(true)

    try {
      const { user } = await login(normalizedEmail, password)
      setUser(user)

      const requestedPath = (
        location.state as { from?: string } | null
      )?.from

      navigate(
        requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : user.role === 'ADMIN'
            ? '/admin'
            : '/account',
        { replace: true },
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-visual">
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
              YOUR JOURNEY STARTS HERE
            </span>

            <h2>
              Mở lối hành trình,
              <br />
              <span>chạm đến thế giới.</span>
            </h2>

            <p>
              Khám phá những điểm đến mới và bắt đầu chuyến đi
              tiếp theo của bạn cùng SkyWay.
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
              <strong>Sẵn sàng cho chuyến đi mới?</strong>
              <span>Hành trình của bạn bắt đầu từ đây.</span>
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-welcome">
              <span className="auth-welcome-icon">✦</span>
              <span>Chào mừng bạn quay trở lại</span>
            </div>

            <h1>Đăng nhập</h1>

            <p className="auth-subtitle">
              Đăng nhập để tiếp tục hành trình cùng SkyWay.
            </p>

            <form onSubmit={handleLogin}>
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
                    placeholder="Nhập mật khẩu của bạn"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
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
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={submitting}
              >
                <span>
                  {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
                </span>
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
              <span>Chưa có tài khoản?</span>
              <button
                type="button"
                onClick={() => navigate('/register')}
              >
                Đăng ký ngay <span aria-hidden="true">→</span>
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

export default LoginPage
