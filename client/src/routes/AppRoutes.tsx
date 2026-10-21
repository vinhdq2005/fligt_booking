
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

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
import AdminLayout from '../admin/AdminLayout'
import AdminReadPage from '../admin/AdminReadPage'
import AdminReferenceFlightsPage from '../pages/admin/AdminReferenceFlightsPage'
import AirlineLayout from '../airline/AirlineLayout'
import { FlightManagerPage, SalesManagerPage } from '../airline/AirlineWorkspacePage'
import AirlineDashboardPage from '../airline/AirlineDashboardPage'

function ProtectedRoute({ children, customerOnly = false }: { children: React.ReactNode; customerOnly?: boolean }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main role="status">Đang xác thực…</main>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (customerOnly && user.role !== 'CUSTOMER') return <Navigate to="/forbidden" replace />
  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main role="status">Đang xác thực…</main>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== 'ADMIN') return <Navigate to="/forbidden" replace />
  return <>{children}</>
}

function AirlineGuard({ children, role }: { children: React.ReactNode; role?: 'AIRLINE_FLIGHT_MANAGER' | 'AIRLINE_SALES_MANAGER' }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main role="status">Đang xác thực…</main>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (!['AIRLINE_FLIGHT_MANAGER', 'AIRLINE_SALES_MANAGER'].includes(user.role) || (role && user.role !== role)) return <Navigate to="/forbidden" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
        <Route index element={<AdminReadPage kind="dashboard" />} />
        <Route path="airlines" element={<AdminReadPage kind="airlines" />} />
        <Route path="users" element={<AdminReadPage kind="users" />} />
        <Route path="flights" element={<AdminReadPage kind="flights" />} />
        <Route path="bookings" element={<AdminReadPage kind="bookings" />} />
        <Route path="payments" element={<AdminReadPage kind="payments" />} />
        <Route path="audit-logs" element={<AdminReadPage kind="audit-logs" />} />
        <Route path="reference-flights" element={<AdminReferenceFlightsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="/airline" element={<AirlineGuard><AirlineLayout /></AirlineGuard>}>
        <Route index element={<AirlineGuard><AirlineHome /></AirlineGuard>} />
        <Route path="flights" element={<AirlineGuard role="AIRLINE_FLIGHT_MANAGER"><FlightManagerPage /></AirlineGuard>} />
        <Route path="dashboard" element={<AirlineGuard role="AIRLINE_SALES_MANAGER"><AirlineDashboardPage /></AirlineGuard>} />
        <Route path="awaiting-sale" element={<AirlineGuard role="AIRLINE_SALES_MANAGER"><SalesManagerPage awaitingOnly /></AirlineGuard>} />
        <Route path="sales" element={<AirlineGuard role="AIRLINE_SALES_MANAGER"><SalesManagerPage /></AirlineGuard>} />
      </Route>

      <Route element={<MainLayout />}>
        <Route path="/forbidden" element={<main style={{ padding: '48px 24px', textAlign: 'center' }}><h1>Không có quyền truy cập</h1><Link to="/">Về trang chủ</Link></main>} />
        <Route path="/" element={<HomePage />} />

        <Route
          path="/flights/results"
          element={<FlightResultsPage />}
        />
        <Route
          path="/flights/:flightId"
          element={<FlightDetailPage />}
        />

        <Route
          path="/booking/passengers"
          element={<PassengerInfoPage />}
        />
        <Route
          path="/booking/review"
          element={<BookingReviewPage />}
        />

        <Route path="/payment" element={<PaymentPage />} />
        <Route
          path="/payment/result"
          element={<PaymentResultPage />}
        />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute customerOnly>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings/:bookingId"
          element={
            <ProtectedRoute customerOnly>
              <BookingDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <main style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h1>Không tìm thấy trang</h1>
              <p>Đường dẫn bạn truy cập không tồn tại.</p>
              <Link to="/">Quay về trang chủ</Link>
            </main>
          }
        />
      </Route>
    </Routes>
  )
}

function AirlineHome() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'AIRLINE_FLIGHT_MANAGER' ? '/airline/flights' : '/airline/dashboard'} replace />
}

export default AppRoutes
