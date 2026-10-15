
import { Routes, Route, Navigate, Link } from 'react-router-dom'

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
import AdminPreviewPage from '../admin/AdminPreviewPage'
import AdminReferenceFlightsPage from '../pages/admin/AdminReferenceFlightsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = localStorage.getItem('flight-booking-current-user')

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPreviewPage kind="dashboard" />} />
        <Route path="airlines" element={<AdminPreviewPage kind="airlines" />} />
        <Route path="users" element={<AdminPreviewPage kind="users" />} />
        <Route path="flights" element={<AdminPreviewPage kind="flights" />} />
        <Route path="bookings" element={<AdminPreviewPage kind="bookings" />} />
        <Route path="payments" element={<AdminPreviewPage kind="payments" />} />
        <Route path="audit-logs" element={<AdminPreviewPage kind="audit-logs" />} />
        <Route path="reference-flights" element={<AdminReferenceFlightsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route element={<MainLayout />}>
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
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings/:bookingId"
          element={
            <ProtectedRoute>
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

export default AppRoutes
