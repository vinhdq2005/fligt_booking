import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { updateProfile } from '../auth/authApi'
import '../styles/account.css'

function AccountPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (!user) return null

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const result = await updateProfile(name.trim(), phone.trim())
      setUser(result.user)
      setEditing(false)
      setMessage('Cập nhật thông tin thành công.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật tài khoản.') }
  }

  return <section className="account-page"><div className="account-content">
    <div className="account-header"><div className="account-avatar">{user.name.charAt(0).toUpperCase()}</div><div><h1>Tài khoản của tôi</h1><p>Xin chào, {user.name}!</p></div></div>
    <div className="account-card"><h2>Thông tin cá nhân</h2>
      {editing ? <form onSubmit={save}>
        <div className="form-field"><label htmlFor="accountName">Họ và tên</label><input id="accountName" value={name} onChange={event => setName(event.target.value)} required /></div>
        <div className="form-field"><label htmlFor="accountEmail">Email</label><input id="accountEmail" value={user.email} readOnly /></div>
        <div className="form-field"><label htmlFor="accountPhone">Số điện thoại</label><input id="accountPhone" value={phone} onChange={event => setPhone(event.target.value)} /></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="account-actions"><button type="submit">Lưu thay đổi</button><button type="button" className="secondary-button" onClick={() => { setEditing(false); setName(user.name); setPhone(user.phone ?? '') }}>Hủy</button></div>
      </form> : <><div className="account-info"><div><span>Họ và tên</span><strong>{user.name}</strong></div><div><span>Email</span><strong>{user.email}</strong></div><div><span>Số điện thoại</span><strong>{user.phone || 'Chưa cập nhật'}</strong></div></div><div className="account-actions"><button type="button" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</button></div></>}
      {message && <p role="status">{message}</p>}
    </div>
    <div className="account-actions"><button type="button" onClick={() => navigate('/my-bookings')}>Đặt chỗ của tôi</button><button type="button" className="secondary-button" onClick={() => navigate('/')}>Về trang chủ</button><button type="button" className="secondary-button" onClick={async () => { try { await logout(); navigate('/login', { replace: true }) } catch { setError('Không thể đăng xuất. Thử lại.') } }}>Đăng xuất</button></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div></section>
}

export default AccountPage
