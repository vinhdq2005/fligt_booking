
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveDemoUser, getDemoUsers } from '../mocks/mockUsers'
import '../styles/auth.css'

function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin.')
      return
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    const emailExists = getDemoUsers().some(
      (user) => user.email.toLowerCase() === normalizedEmail,
    )

    if (emailExists) {
      setError('Email này đã được đăng ký. Vui lòng sử dụng email khác.')
      return
    }

    try {
      saveDemoUser({
        id: `user-${Date.now()}`,
        name: normalizedName,
        email: normalizedEmail,
        password,
      })

      setSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập.')

      window.setTimeout(() => {
        navigate('/login')
      }, 1000)
    } catch {
      setError('Không thể lưu tài khoản. Vui lòng thử lại.')
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Đăng ký tài khoản</h1>

        <p className="demo-notice">
          Tài khoản chỉ phục vụ trình diễn.
        </p>

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
              minLength={6}
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
              minLength={6}
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

          <button type="submit">
            Đăng ký
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