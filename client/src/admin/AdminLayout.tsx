import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logoImg from '../assets/logo.png' // Import logo tròn từ thư mục assets
import '../styles/management.css'
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
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const current = navigation.find((item) => item.path === location.pathname)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError('Không thể đăng xuất. Thử lại.')
    }
  }

  return <div className="app-canvas">
    <div className="app-shell admin-shell">
      {menuOpen && <button className="admin-menu-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar admin-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng quản trị">
        {/* Thay thế icon máy bay cũ bằng logo tròn mới */}
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            <img src={logoImg} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span>Flight<span>Booking</span></span>
        </div>
        
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
          <div className="sidebar-tip"><div className="tip-icon">i</div><strong>Can thiệp quản trị</strong><p>Thao tác tại trang chi tiết cần lý do và được ghi nhật ký để tra cứu.</p></div>
        </div>
        {/* Đã gỡ bỏ footer cũ ở sidebar */}
      </aside>
      <div className="workspace">
        <header className="topbar admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="admin-topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="admin-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Mở menu quản trị">☰</button>
            <div className="breadcrumbs">Quản trị <span aria-hidden="true">›</span> <strong>{current?.label ?? 'Trang quản trị'}</strong></div>
          </div>
          
          {/* Thông tin User và nút Đăng xuất ở góc trên bên phải */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                QT
              </div>
              <div style={{ lineHeight: '1.2' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{user?.name ?? 'Quản trị viên'}</div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>ADMIN</div>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleLogout}
              style={{ padding: '6px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px', transition: 'background 0.2s' }}
            >
              Đăng xuất
            </button>
            {logoutError && <span role="alert" style={{ color: 'red', fontSize: '11px' }}>{logoutError}</span>}
          </div>
        </header>
        <main className="admin-main"><Outlet /></main>
      </div>
    </div>
  </div>
}