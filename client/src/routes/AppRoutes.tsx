import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getRoleLanding } from '../auth/roleNavigation'

import MainLayout from '../layouts/MainLayout'
import HomePage from '../pages/HomePage'
import FlightResultsPage from '../pages/FlightResultsPage'
import FlightDetailPage from '../pages/FlightDetailPage'
import PassengerInfoPage from '../pages/PassengerInfoPage'
import BookingReviewPage from '../pages/BookingReviewPage'
import PaymentPage from '../pages/PaymentPage'
import PaymentResultPage from '../pages/PaymentResultPage'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import AccountPage from '../pages/AccountPage'
import MyBookingsPage from '../pages/MyBookingsPage'
import BookingDetailPage from '../pages/BookingDetailPage'
import TicketVerifyPage from '../pages/TicketVerifyPage'

import AdminLayout from '../admin/AdminLayout'
import AdminReadPage from '../admin/AdminReadPage'
import AdminReferenceFlightsPage from '../pages/admin/AdminReferenceFlightsPage'

import AirlineLayout from '../airline/AirlineLayout'
import {
  FlightManagerPage,
  SalesManagerPage,
} from '../airline/AirlineWorkspacePage'
import AirlineDashboardPage from '../airline/AirlineDashboardPage'
import AirlineBookingsPage from '../airline/AirlineBookingsPage'

function ProtectedRoute({
  children,
  customerOnly = false,
}: {
  children: React.ReactNode
  customerOnly?: boolean
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return <main role="status">Đang xác thực…</main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={null} />
  }

  if (customerOnly && user.role !== 'CUSTOMER') {
    return <Navigate to={getRoleLanding(user.role)} replace />
  }

  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <main role="status">Đang xác thực…</main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={null} />
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to={getRoleLanding(user.role)} replace />
  }

  return <>{children}</>
}

function AirlineGuard({
  children,
  role,
}: {
  children: React.ReactNode
  role?: 'AIRLINE_FLIGHT_MANAGER' | 'AIRLINE_SALES_MANAGER'
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return <main role="status">Đang xác thực…</main>
  }

  if (!user) {
    return <Navigate to="/login" replace state={null} />
  }

  const isAirlineUser = [
    'AIRLINE_FLIGHT_MANAGER',
    'AIRLINE_SALES_MANAGER',
  ].includes(user.role)

  if (!isAirlineUser || (role && user.role !== role)) {
    return <Navigate to={getRoleLanding(user.role)} replace />
  }

  return <>{children}</>
}

function AirlineHome() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace state={null} />
  return <Navigate to={getRoleLanding(user.role)} replace />
}

function HomeEntry() {
  const { user, loading } = useAuth()

  if (loading) return <main role="status">Đang xác thực…</main>
  if (user && user.role !== 'CUSTOMER') {
    return <Navigate to={getRoleLanding(user.role)} replace />
  }

  return <HomePage />
}

function LoginEntry() {
  const { user, loading } = useAuth()

  if (loading) return <main role="status">Đang xác thực…</main>
  if (user) return <Navigate to={getRoleLanding(user.role)} replace />

  return <LoginPage />
}

function ForbiddenPage() {
  return (
    <main
      style={{
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <h1>Không có quyền truy cập</h1>
      <p>Bạn không có quyền truy cập trang này.</p>
      <Link to="/">Về trang chủ</Link>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main
      style={{
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn bạn truy cập không tồn tại.</p>
      <Link to="/">Quay về trang chủ</Link>
    </main>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* ===== ADMIN: BẮT BUỘC ĐĂNG NHẬP VỚI ROLE ADMIN ===== */}
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminLayout />
          </AdminGuard>
        }
      >
        <Route index element={<AdminReadPage kind="dashboard" />} />
        <Route path="airlines" element={<AdminReadPage kind="airlines" />} />
        <Route path="users" element={<AdminReadPage kind="users" />} />
        <Route path="flights" element={<AdminReadPage kind="flights" />} />
        <Route path="bookings" element={<AdminReadPage kind="bookings" />} />
        <Route path="payments" element={<AdminReadPage kind="payments" />} />
        <Route path="audit-logs" element={<AdminReadPage kind="audit-logs" />} />
        <Route
          path="reference-flights"
          element={<AdminReferenceFlightsPage />}
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      {/* ===== AIRLINE: BẮT BUỘC ĐĂNG NHẬP VỚI ROLE PHÙ HỢP ===== */}
      <Route
        path="/airline"
        element={
          <AirlineGuard>
            <AirlineLayout />
          </AirlineGuard>
        }
      >
        <Route index element={<AirlineHome />} />

        <Route
          path="flights"
          element={
            <AirlineGuard role="AIRLINE_FLIGHT_MANAGER">
              <FlightManagerPage />
            </AirlineGuard>
          }
        />

        <Route
          path="dashboard"
          element={
            <AirlineGuard role="AIRLINE_SALES_MANAGER">
              <AirlineDashboardPage />
            </AirlineGuard>
          }
        />

        <Route
          path="awaiting-sale"
          element={
            <AirlineGuard role="AIRLINE_SALES_MANAGER">
              <SalesManagerPage key="awaiting-sale" awaitingOnly />
            </AirlineGuard>
          }
        />

        <Route
          path="sales"
          element={
            <AirlineGuard role="AIRLINE_SALES_MANAGER">
              <SalesManagerPage key="sales" />
            </AirlineGuard>
          }
        />

        <Route
          path="bookings"
          element={
            <AirlineGuard role="AIRLINE_SALES_MANAGER">
              <AirlineBookingsPage />
            </AirlineGuard>
          }
        />
      </Route>

      {/* ===== TRANG CHUNG VÀ TRANG CÔNG KHAI ===== */}
      <Route element={<MainLayout />}>
        {/* Công khai: khách quét QR để xác minh vé */}
        <Route
          path="/tickets/verify/:token"
          element={<TicketVerifyPage />}
        />

        {/* Trang báo lỗi quyền truy cập */}
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* Trang chủ */}
        <Route path="/" element={<HomeEntry />} />

        {/* Tìm kiếm và xem chuyến bay */}
        <Route
          path="/flights/results"
          element={<FlightResultsPage />}
        />

        <Route
          path="/flights/:flightId"
          element={<FlightDetailPage />}
        />

        {/* Quy trình đặt vé */}
        <Route
          path="/booking/passengers"
          element={<PassengerInfoPage />}
        />

        <Route
          path="/booking/review"
          element={<BookingReviewPage />}
        />

        {/* Thanh toán */}
        <Route path="/payment" element={<PaymentPage />} />

        <Route
          path="/payment/result"
          element={<PaymentResultPage />}
        />

        {/* Đăng nhập và đăng ký */}
        <Route path="/login" element={<LoginEntry />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Tài khoản cá nhân: vẫn bắt buộc đăng nhập */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        {/* ĐẶT CHỖ CỦA TÔI: KHÔNG BẮT BUỘC ĐĂNG NHẬP */}
        <Route
          path="/my-bookings"
          element={<MyBookingsPage />}
        />

        {/* Chi tiết đặt chỗ: KHÔNG BẮT BUỘC ĐĂNG NHẬP */}
        <Route
          path="/my-bookings/:bookingId"
          element={<BookingDetailPage />}
        />

        {/* ===== 404 ===== */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
