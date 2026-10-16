import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { applyDemoIntervention, createInitialDemoState } from './demoInterventions'
import type { InterventionRequest } from './models'
import '../styles.css'
import './admin.css'

const navigation = [
  { path: '/admin', label: 'Tổng quan', glyph: '01', end: true },
  { path: '/admin/airlines', label: 'Hãng bay', glyph: '02' },
  { path: '/admin/users', label: 'Tài khoản', glyph: '03' },
  { path: '/admin/flights', label: 'Chuyến bay', glyph: '04' },
  { path: '/admin/bookings', label: 'Booking', glyph: '05' },
  { path: '/admin/payments', label: 'Thanh toán', glyph: '06' },
  { path: '/admin/audit-logs', label: 'Nhật ký', glyph: '07' },
  { path: '/admin/reference-flights', label: 'Dữ liệu tham khảo', glyph: '08' },
]

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [demoState, setDemoState] = useState(createInitialDemoState)
  const demoStateRef = useRef(demoState)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const current = navigation.find((item) => item.path === location.pathname)

  function runIntervention(request: InterventionRequest) {
    const result = applyDemoIntervention(demoStateRef.current, request)
    demoStateRef.current = result.state
    setDemoState(result.state)
    return result
  }

  return <div className="app-canvas">
    <div className="app-shell admin-shell">
      {menuOpen && <button className="admin-menu-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar admin-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng quản trị">
        <div className="brand"><div className="brand-symbol" aria-hidden="true">✈</div><span>Flight<span>Booking</span></span></div>
        <div className="sidebar-main">
          <div className="nav-label">QUẢN TRỊ HỆ THỐNG</div>
          <nav aria-label="Menu admin">
            {navigation.map((item, index) => <div key={item.path}>
              {index === 7 && <div className="nav-label nav-label-modules">DỮ LIỆU THAM KHẢO</div>}
              <NavLink
                to={item.path}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-item admin-nav-link${isActive ? ' nav-active' : ''}`}
              >
                <span className="admin-nav-glyph" aria-hidden="true">{item.glyph}</span>
                {item.label}
              </NavLink>
            </div>)}
          </nav>
          <div className="sidebar-tip"><div className="tip-icon">i</div><strong>Mô phỏng trong phiên</strong><p>Các thao tác admin chỉ đổi dữ liệu mẫu trong trình duyệt. Tải lại trang để khôi phục; chưa ghi vào database.</p></div>
        </div>
        <div className="sidebar-footer"><div className="avatar">QT</div><div><strong>{user?.name ?? 'Quản trị viên'}</strong><span>ADMIN</span>{logoutError && <span role="alert">{logoutError}</span>}</div><button type="button" onClick={async () => { try { await logout(); navigate('/login', { replace: true }) } catch { setLogoutError('Không thể đăng xuất. Thử lại.') } }}>Đăng xuất</button></div>
      </aside>
      <div className="workspace">
        <header className="topbar admin-topbar">
          <div className="admin-topbar-start">
            <button className="admin-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Mở menu quản trị">☰</button>
            <div className="breadcrumbs">Quản trị <span aria-hidden="true">›</span> <strong>{current?.label ?? 'Trang quản trị'}</strong></div>
          </div>
          <span className="admin-preview-pill">Mô phỏng · chưa lưu</span>
        </header>
        <main className="admin-main"><Outlet context={{ demoState, runIntervention }} /></main>
      </div>
    </div>
  </div>
}
