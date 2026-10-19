
import { useState } from 'react'
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

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
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
    } finally { setSubmitting(false) }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Đăng ký tài khoản</h1>

        <form onSubmit={handleRegister}>
          <div className="form-field">
            <label htmlFor="fullName">Họ và tên</label>
            <input
              id="fullName"
              type="text"
              placeholder="Nhập họ và tên"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Nhập email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="confirmPassword">
              Xác nhận mật khẩu
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="auth-success" role="status">
              {success}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang đăng ký…' : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-link">
          Đã có tài khoản?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
          >
            Đăng nhập
          </button>
        </p>
      </div>
    </section>
  )
}

export default RegisterPage
