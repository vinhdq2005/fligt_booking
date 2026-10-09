
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/account.css'

type CurrentUser = {
  id: string
  name: string
  email: string
  phone?: string
}

function AccountPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(
        'flight-booking-current-user',
      )

      if (!savedUser) {
        navigate('/login', { replace: true })
        return
      }

      const parsed: unknown = JSON.parse(savedUser)

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('id' in parsed) ||
        !('name' in parsed) ||
        !('email' in parsed) ||
        typeof parsed.id !== 'string' ||
        typeof parsed.name !== 'string' ||
        typeof parsed.email !== 'string' ||
        ('phone' in parsed && typeof parsed.phone !== 'string')
      ) {
        localStorage.removeItem('flight-booking-current-user')
        navigate('/login', { replace: true })
        return
      }

      const currentUser: CurrentUser = {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        phone: 'phone' in parsed ? parsed.phone : '',
      }

      setUser(currentUser)
      setFullName(currentUser.name)
      setPhone(currentUser.phone || '')
    } catch {
      localStorage.removeItem('flight-booking-current-user')
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!user) return

    const normalizedName = fullName.trim()
    const normalizedPhone = phone.trim()

    if (!normalizedName) {
      setError('Vui lòng nhập họ và tên.')
      return
    }

    if (normalizedPhone && !/^[0-9+\s()-]{9,15}$/.test(normalizedPhone)) {
      setError('Số điện thoại không hợp lệ.')
      return
    }

    const updatedUser: CurrentUser = {
      ...user,
      name: normalizedName,
      phone: normalizedPhone,
    }

    try {
      localStorage.setItem(
        'flight-booking-current-user',
        JSON.stringify(updatedUser),
      )

      setUser(updatedUser)
      setEditing(false)
      setMessage('Cập nhật thông tin thành công.')
    } catch {
      setError('Không thể lưu thông tin. Vui lòng thử lại.')
    }
  }

  const handleCancel = () => {
    setFullName(user?.name || '')
    setPhone(user?.phone || '')
    setEditing(false)
    setError('')
    setMessage('')
  }

  const handleLogout = () => {
    localStorage.removeItem('flight-booking-current-user')
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <section className="account-page">
      <div className="account-content">
        <div className="account-header">
          <div className="account-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1>Tài khoản của tôi</h1>
            <p>Xin chào, {user.name}!</p>
          </div>
        </div>

        <div className="account-card">
          <h2>Thông tin cá nhân</h2>

          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-field">
                <label htmlFor="accountName">Họ và tên</label>
                <input
                  id="accountName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="accountEmail">Email</label>
                <input
                  id="accountEmail"
                  type="email"
                  value={user.email}
                  readOnly
                />
              </div>

              <div className="form-field">
                <label htmlFor="accountPhone">Số điện thoại</label>
                <input
                  id="accountPhone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Nhập số điện thoại"
                  autoComplete="tel"
                />
              </div>

              {error && <p className="auth-error" role="alert">{error}</p>}

              <div className="account-actions">
                <button type="submit">Lưu thay đổi</button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancel}
                >
                  Hủy
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="account-info">
                <div>
                  <span>Họ và tên</span>
                  <strong>{user.name}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span>Số điện thoại</span>
                  <strong>{user.phone || 'Chưa cập nhật'}</strong>
                </div>
              </div>

              <div className="account-actions">
                <button type="button" onClick={() => {
                  setMessage('')
                  setEditing(true)
                }}>
                  Chỉnh sửa thông tin
                </button>
              </div>
            </>
          )}

          {message && <p role="status">{message}</p>}
        </div>

        <div className="account-actions">
          <button
            type="button"
            onClick={() => navigate('/my-bookings')}
          >
            Đặt chỗ của tôi
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/')}
          >
            Về trang chủ
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </section>
  )
}

export default AccountPage