import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import '../styles.css'
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
  return <div className="app-canvas airline-canvas"><div className="app-shell airline-shell">
    {menuOpen && <button className="airline-menu-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar airline-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng hãng bay">
      <div className="brand"><div className="brand-symbol" aria-hidden="true">✈</div><span>Flight<span>Booking</span></span></div>
      <div className="sidebar-main"><div className="nav-label">KHÔNG GIAN HÃNG BAY</div><nav aria-label="Menu hãng bay">
        {navigation.map(item => <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item airline-nav-link${isActive ? ' nav-active' : ''}`} onClick={() => setMenuOpen(false)}><span className="airline-nav-number">{item.number}</span>{item.label}</NavLink>)}
      </nav><div className="sidebar-tip"><div className="tip-icon">i</div><strong>{flightManager ? 'Lịch bay nội bộ' : 'Doanh thu mô phỏng'}</strong><p>{flightManager ? 'Chuyến mới được lưu ở trạng thái chưa mở bán. Bộ phận bán vé đặt giá và công bố chuyến.' : 'Số liệu doanh thu lấy từ thanh toán thử trong hệ thống, không phải doanh thu thực của hãng.'}</p></div></div>
      <div className="sidebar-footer"><div className="avatar">HB</div><div><strong>{user?.name}</strong><span>{flightManager ? 'QUẢN LÝ CHUYẾN' : 'QUẢN LÝ BÁN VÉ'}</span>{logoutError && <span role="alert">{logoutError}</span>}</div><button type="button" onClick={async () => { try { await logout(); navigate('/login', { replace: true }) } catch { setLogoutError('Không thể đăng xuất.') } }}>Đăng xuất</button></div>
    </aside>
    <div className="workspace"><header className="topbar airline-topbar"><div className="airline-topbar-start"><button className="airline-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Mở menu hãng bay">☰</button><div className="breadcrumbs">Hãng bay <span aria-hidden="true">›</span> <strong>{navigation.find(item => item.path === location.pathname)?.label}</strong></div></div><span className="airline-role-pill">{flightManager ? 'TẠO CHUYẾN' : 'BÁN VÉ'}</span></header><main className="airline-main"><Outlet /></main></div>
  </div></div>
}
