import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logoImg from '../assets/logo.png'

function Header() {
  const { user } = useAuth()

  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="brand-logo">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#0f172a' }}>
          {/* Khung tròn chứa ảnh logo mới */}
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            <img
              src={logoImg}
              alt="Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>Flight Booking</span>
        </Link>
      </div>

      <nav className="navigation" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#334155', fontWeight: 500 }}>Trang chủ</Link>
        <Link to="/flights/results" style={{ textDecoration: 'none', color: '#334155', fontWeight: 500 }}>Tìm chuyến bay</Link>
        <Link to="/my-bookings" style={{ textDecoration: 'none', color: '#334155', fontWeight: 500 }}>Đặt chỗ của tôi</Link>

        {user ? (
          <Link to="/account" className="account-link" style={{ textDecoration: 'none', fontWeight: 600, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
            👤 {user.name}
          </Link>
        ) : (
          <Link to="/login" style={{ textDecoration: 'none', color: '#334155', fontWeight: 500 }}>Đăng nhập</Link>
        )}
      </nav>
    </header>
  )
}

export default Header