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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật tài khoản.')
    }
  }

  return (
    <section className="account-page">
      <div className="account-content" style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px' }}>

        {/* HEADER TÀI KHOẢN */}
        <div className="account-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div className="account-avatar" style={{ width: '56px', height: '56px', background: '#2563eb', color: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Tài khoản của tôi</h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Xin chào, {user.name}!</p>
          </div>
        </div>

        {/* THẺ THÔNG TIN CÁ NHÂN */}
        <div className="account-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Thông tin cá nhân</h2>

            {/* Nút đăng xuất nhỏ gọn đặt ngay góc thẻ hoặc tuỳ chọn nhanh */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await logout()
                  navigate('/login', { replace: true })
                } catch {
                  setError('Không thể đăng xuất. Thử lại.')
                }
              }}
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Đăng xuất
            </button>
          </div>

          {editing ? (
            <form onSubmit={save}>
              <div className="form-field" style={{ marginBottom: '16px' }}>
                <label htmlFor="accountName" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Họ và tên</label>
                <input id="accountName" value={name} onChange={event => setName(event.target.value)} required style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
              </div>
              <div className="form-field" style={{ marginBottom: '16px' }}>
                <label htmlFor="accountEmail" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Email</label>
                <input id="accountEmail" value={user.email} readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px' }} />
              </div>
              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="accountPhone" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Số điện thoại</label>
                <input id="accountPhone" value={phone} onChange={event => setPhone(event.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
              </div>

              {error && <p className="auth-error" role="alert" style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

              <div className="account-actions" style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Lưu thay đổi</button>
                <button type="button" className="secondary-button" onClick={() => { setEditing(false); setName(user.name); setPhone(user.phone ?? '') }} style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              </div>
            </form>
          ) : (
            <>
              <div className="account-info" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', fontSize: '14px', color: '#334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '10px' }}>
                  <span style={{ color: '#64748b' }}>Họ và tên</span>
                  <strong>{user.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '10px' }}>
                  <span style={{ color: '#64748b' }}>Email</span>
                  <strong>{user.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Số điện thoại</span>
                  <strong>{user.phone || 'Chưa cập nhật'}</strong>
                </div>
              </div>

              <div className="account-actions">
                <button type="button" onClick={() => setEditing(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Chỉnh sửa thông tin</button>
              </div>
            </>
          )}

          {message && <p role="status" style={{ color: '#16a34a', fontSize: '13px', marginTop: '12px', fontWeight: 500 }}>{message}</p>}
        </div>

        {error && !editing && <p className="auth-error" role="alert" style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>
    </section>
  )
}

export default AccountPage