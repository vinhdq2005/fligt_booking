
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
      const requestedPath = (location.state as { from?: string } | null)?.from
      navigate(requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : user.role === 'ADMIN' ? '/admin' : '/account', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập.')
    } finally { setSubmitting(false) }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Đăng nhập</h1>

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

          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
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
