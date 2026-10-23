import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createAdminStaff, type AdminOptions } from './adminReadApi'

type StaffRole = 'AIRLINE_FLIGHT_MANAGER' | 'AIRLINE_SALES_MANAGER'

export default function AdminCreateStaffDialog({ airlines, onCancel, onCreated }: {
  airlines: AdminOptions['airlines']
  onCancel: () => void
  onCreated: (user: { id: number; name: string; email: string }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('AIRLINE_FLIGHT_MANAGER')
  const [airlineId, setAirlineId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const activeAirlines = airlines.filter(airline => airline.status === 'ACTIVE')

  useEffect(() => {
    nameRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2 || name.trim().length > 120) { setError('Họ tên phải có từ 2 đến 120 ký tự.'); return }
    if (password.length < 10 || password.length > 128) { setError('Mật khẩu phải có từ 10 đến 128 ký tự.'); return }
    if (!activeAirlines.some(airline => airline.id === Number(airlineId))) { setError('Hãy chọn hãng đang hoạt động.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await createAdminStaff({ name: name.trim(), email: email.trim(), password, role, airlineId: Number(airlineId) })
      onCreated(result.user)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo tài khoản.') }
    finally { setBusy(false) }
  }

  return <div className="admin-intervention-backdrop" onMouseDown={() => { if (!busy) onCancel() }}>
    <form className="admin-intervention-dialog admin-create-staff-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-create-staff-title" onMouseDown={event => event.stopPropagation()} onSubmit={submit}>
      <span className="eyebrow">TÀI KHOẢN HÃNG BAY</span>
      <h2 id="admin-create-staff-title">Tạo nhân viên hãng</h2>
      <p className="admin-intervention-subject">Tài khoản được kích hoạt ngay. Hãy chuyển mật khẩu khởi tạo cho nhân viên qua kênh riêng.</p>
      <label htmlFor="staff-name">Họ tên</label>
      <input ref={nameRef} id="staff-name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required disabled={busy} autoComplete="name" />
      <label htmlFor="staff-email">Email đăng nhập</label>
      <input id="staff-email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={255} required disabled={busy} autoComplete="off" />
      <label htmlFor="staff-airline">Hãng trực thuộc</label>
      <select id="staff-airline" value={airlineId} onChange={event => setAirlineId(event.target.value)} required disabled={busy || !activeAirlines.length}>
        <option value="">Chọn hãng bay</option>
        {activeAirlines.map(airline => <option key={airline.id} value={airline.id}>{airline.name}</option>)}
      </select>
      {!activeAirlines.length && <small>Chưa có hãng đang hoạt động để cấp tài khoản.</small>}
      <label htmlFor="staff-role">Vai trò</label>
      <select id="staff-role" value={role} onChange={event => setRole(event.target.value as StaffRole)} disabled={busy}>
        <option value="AIRLINE_FLIGHT_MANAGER">Quản lý chuyến bay</option>
        <option value="AIRLINE_SALES_MANAGER">Quản lý bán vé</option>
      </select>
      <label htmlFor="staff-password">Mật khẩu khởi tạo</label>
      <div className="admin-password-field"><input id="staff-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={128} required disabled={busy} autoComplete="new-password" /><button type="button" disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ẩn' : 'Hiện'}</button></div>
      <small>10–128 ký tự. Mật khẩu không xuất hiện trong danh sách hoặc nhật ký.</small>
      {error && <p className="admin-filter-error" role="alert">{error}</p>}
      <div className="admin-intervention-actions"><button type="button" className="outline-button" disabled={busy} onClick={onCancel}>Hủy</button><button type="submit" className="primary-button" disabled={busy || !activeAirlines.length}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button></div>
    </form>
  </div>
}
