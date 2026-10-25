import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logoImg from '../assets/logo.png' // Import logo hình tròn từ thư mục assets
import '../styles/management.css'
import './airline.css'

export default function AirlineLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const flightManager = user?.role === 'AIRLINE_FLIGHT_MANAGER'
  const navigation = flightManager
    ? [{ path: '/airline/flights', label: 'Quản lý chuyến bay', number: '01' }]
    : [{ path: '/airline/dashboard', label: 'Dashboard', number: '01' },
        { path: '/airline/awaiting-sale', label: 'Chờ mở bán', number: '02' },
        { path: '/airline/sales', label: 'Quản lý bán vé', number: '03' },
        { path: '/airline/bookings', label: 'Đặt chỗ & vé', number: '04' }]

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true, state: null })
    } catch {
      setLogoutError('Không thể đăng xuất.')
    }
  }

  return <div className="app-canvas airline-canvas"><div className="app-shell airline-shell">
    {menuOpen && <button className="airline-menu-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar airline-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng hãng bay">

      {/* Thay thế icon máy bay cũ bằng logo tròn mới */}
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
          <img src={logoImg} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <span>Flight<span>Booking</span></span>
      </div>

      <div className="sidebar-main">
        <div className="nav-label">KHÔNG GIAN HÃNG BAY</div>
        <nav aria-label="Menu hãng bay">
          {navigation.map(item => <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item airline-nav-link${isActive ? ' nav-active' : ''}`} onClick={() => setMenuOpen(false)}><span className="airline-nav-number">{item.number}</span>{item.label}</NavLink>)}
        </nav>
        <div className="sidebar-tip"><div className="tip-icon">i</div><strong>{flightManager ? 'Lịch bay nội bộ' : 'Doanh thu mô phỏng'}</strong><p>{flightManager ? 'Chuyến mới được lưu ở trạng thái chưa mở bán. Bộ phận bán vé đặt giá và công bố chuyến.' : 'Số liệu doanh thu lấy từ thanh toán thử trong hệ thống, không phải doanh thu thực của hãng.'}</p></div></div>
      {/* Đã gỡ bỏ footer cũ ở sidebar */}
    </aside>
    <div className="workspace">
      <header className="topbar airline-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="airline-topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="airline-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Mở menu hãng bay">☰</button>
          <div className="breadcrumbs">Hãng bay <span aria-hidden="true">›</span> <strong>{navigation.find(item => item.path === location.pathname)?.label}</strong></div>
        </div>

        {/* Chuyển thông tin User và nút Đăng xuất lên góc trên bên phải */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
              HB
            </div>
            <div style={{ lineHeight: '1.2' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{user?.name ?? 'Nhân viên hãng'}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{flightManager ? 'QUẢN LÝ CHUYẾN' : 'QUẢN LÝ BÁN VÉ'}</div>
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
      <main className="airline-main"><Outlet /></main>
    </div>
  </div></div>
}
