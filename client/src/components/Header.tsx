function Header() {
  return (
    <header className="header">
      <div className="logo">
        Flight Booking
      </div>

      <nav className="navigation">
        <a href="/">Trang chủ</a>
        <a href="/flights/results">Tìm chuyến bay</a>
        <a href="/my-bookings">Đặt chỗ của tôi</a>
        <a href="/login">Đăng nhập</a>
      </nav>
    </header>
  )
}

export default Header