
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDemoUsers } from '../mocks/mockUsers'
import '../styles/auth.css'

function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.')
      return
    }

    const user = getDemoUsers().find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail &&
        item.password === password,
    )

    if (!user) {
      setError('Email hoặc mật khẩu không chính xác.')
      return
    }

    localStorage.setItem(
      'flight-booking-current-user',
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
      }),
    )

    navigate('/account')
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Đăng nhập</h1>

        <p className="demo-notice">
          Tài khoản chỉ phục vụ trình diễn.
        </p>

        <form onSubmit={handleLogin}>
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
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit">
            Đăng nhập
          </button>
        </form>

        <p className="auth-link">
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
          >
            Đăng ký
          </button>
        </p>
      </div>
    </section>
  )
}

export default LoginPage