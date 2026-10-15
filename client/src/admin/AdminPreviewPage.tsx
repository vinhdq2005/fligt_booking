import { useState } from 'react'
import {
  demoAirlines,
  demoAuditLogs,
  demoBookings,
  demoDashboard,
  demoFlights,
  demoPayments,
  demoUsers,
} from './fixtures'

type PreviewKind = 'dashboard' | 'airlines' | 'users' | 'flights' | 'bookings' | 'payments' | 'audit-logs'
type PreviewRow = { id: number; cells: string[]; details: Array<[string, string]> }
type PreviewConfig = { title: string; description: string; columns: string[]; rows: PreviewRow[] }

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
  : '—'
const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`

const configs: Record<Exclude<PreviewKind, 'dashboard'>, PreviewConfig> = {
  airlines: {
    title: 'Hãng bay', description: 'Danh sách các hãng trong hệ thống.',
    columns: ['MÃ HÃNG', 'TÊN HÃNG', 'TRẠNG THÁI', 'NHÂN VIÊN', 'CHUYẾN ĐANG BÁN'],
    rows: demoAirlines.map((item) => ({ id: item.id, cells: [item.code, item.name, item.status, String(item.staffCount), String(item.onSaleFlightCount)], details: [['Mã hãng', item.code], ['Tên hãng', item.name], ['Trạng thái', item.status], ['Ngày tạo', dateTime(item.createdAt)]] })),
  },
  users: {
    title: 'Tài khoản', description: 'Tài khoản khách hàng và nhân viên các hãng bay.',
    columns: ['HỌ TÊN', 'EMAIL', 'VAI TRÒ', 'HÃNG BAY', 'TRẠNG THÁI'],
    rows: demoUsers.map((item) => ({ id: item.id, cells: [item.name, item.email, item.role, item.airlineName ?? '—', item.status], details: [['Họ tên', item.name], ['Email', item.email], ['Vai trò', item.role], ['Hãng bay', item.airlineName ?? '—'], ['Đăng nhập gần nhất', dateTime(item.lastLoginAt)]] })),
  },
  flights: {
    title: 'Chuyến bay', description: 'Chuyến bay nội bộ do hãng tạo và có thể mở bán trong hệ thống demo.',
    columns: ['MÃ CHUYẾN', 'HÃNG BAY', 'TUYẾN', 'GIỜ ĐI', 'GIÁ', 'MỞ BÁN'],
    rows: demoFlights.map((item) => ({ id: item.id, cells: [item.flightNumber, item.airlineName, `${item.departureCode} → ${item.arrivalCode}`, dateTime(item.departureTime), money(item.basePrice), item.saleStatus], details: [['Mã chuyến', item.flightNumber], ['Hãng bay', item.airlineName], ['Giờ đi', dateTime(item.departureTime)], ['Giờ đến', dateTime(item.arrivalTime)], ['Chỗ còn', `${item.availableSeats}/${item.capacity}`], ['Booking', String(item.bookingCount)], ['Trạng thái bay', item.status], ['Trạng thái bán', item.saleStatus]] })),
  },
  bookings: {
    title: 'Booking', description: 'Tra cứu booking của mọi hãng trong hệ thống demo.',
    columns: ['MÃ BOOKING', 'HÃNG BAY', 'CHUYẾN', 'KHÁCH LIÊN HỆ', 'TỔNG TIỀN', 'TRẠNG THÁI'],
    rows: demoBookings.map((item) => ({ id: item.id, cells: [item.bookingCode, item.airlineName, item.flightNumber, item.contactName, money(item.totalAmount), item.status], details: [['Mã booking', item.bookingCode], ['Hãng bay', item.airlineName], ['Chuyến bay', item.flightNumber], ['Khách liên hệ', item.contactName], ['Email', item.contactEmail ?? '—'], ['Điện thoại', item.contactPhoneMasked ?? '—'], ['Hành khách', item.passengers.map((p) => p.fullName).join(', ')], ['Thanh toán', item.paymentIds.map((id) => `#${id}`).join(', ')], ['Ngày tạo', dateTime(item.createdAt)]] })),
  },
  payments: {
    title: 'Thanh toán', description: 'Giao dịch thanh toán mô phỏng; trang này chỉ hiển thị để đối soát.',
    columns: ['GIAO DỊCH', 'BOOKING', 'HÃNG BAY', 'SỐ TIỀN', 'TRẠNG THÁI', 'KIỂM TRA'],
    rows: demoPayments.map((item) => ({ id: item.id, cells: [item.providerTransactionId ?? `#${item.id}`, item.bookingCode, item.airlineName, money(item.amount), item.status, item.reviewStatus], details: [['Giao dịch', item.providerTransactionId ?? `#${item.id}`], ['Booking', item.bookingCode], ['Hãng bay', item.airlineName], ['Phương thức', item.method], ['Số tiền', money(item.amount)], ['Trạng thái', item.status], ['Cần kiểm tra', item.reviewStatus], ['Ngày tạo', dateTime(item.createdAt)]] })),
  },
  'audit-logs': {
    title: 'Nhật ký', description: 'Lịch sử can thiệp quản trị, chỉ đọc.',
    columns: ['THỜI GIAN', 'NGƯỜI THỰC HIỆN', 'HÀNH ĐỘNG', 'ĐỐI TƯỢNG', 'KẾT QUẢ'],
    rows: demoAuditLogs.map((item) => ({ id: item.id, cells: [dateTime(item.createdAt), item.actorName, item.action, `${item.entityType} #${item.entityId}`, item.result], details: [['Thời gian', dateTime(item.createdAt)], ['Người thực hiện', item.actorName], ['Vai trò', item.actorRole], ['Hành động', item.action], ['Đối tượng', `${item.entityType} #${item.entityId}`], ['Kết quả', item.result], ['Lý do', item.reason], ['Trước', JSON.stringify(item.before)], ['Sau', JSON.stringify(item.after)]] })),
  },
}

function DashboardPreview() {
  const cards = [
    ['Hãng đang hoạt động', String(demoDashboard.activeAirlines)],
    ['Tài khoản đang hoạt động', String(demoDashboard.activeUsers)],
    ['Chuyến đang bán', String(demoDashboard.onSaleFlights)],
    ['Booking xác nhận', String(demoDashboard.bookingsByStatus.CONFIRMED)],
    ['Thanh toán cần kiểm tra', String(demoDashboard.needsReviewPayments)],
    ['Doanh thu mô phỏng', money(demoDashboard.simulatedPaidAmount)],
  ]
  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">ADMIN DASHBOARD</div><h1>Tổng quan hệ thống</h1><p>Các chỉ số dưới đây là dữ liệu mẫu để duyệt giao diện.</p></div></div>
    <div className="admin-dashboard-grid">{cards.map(([label, value]) => <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="list-card admin-intro-card"><h2>Việc cần chú ý</h2><p>{demoDashboard.hiddenFlights} chuyến đang tạm ẩn · {demoDashboard.failedPayments} thanh toán lỗi · {demoDashboard.lockedUsers} tài khoản bị khóa.</p><p>Chọn một mục ở menu để xem danh sách và chi tiết mẫu.</p></section>
  </div>
}

export default function AdminPreviewPage({ kind }: { kind: PreviewKind }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  if (kind === 'dashboard') return <DashboardPreview />

  const config = configs[kind]
  const selected = config.rows.find((row) => row.id === selectedId)
  return <>
    <div className="content">
      <div className="page-heading"><div><div className="eyebrow">ADMIN CONTENT</div><h1>{config.title}</h1><p>{config.description}</p></div><span className="admin-data-label">Dữ liệu mẫu</span></div>
      <section className="list-card">
        <div className="list-card-header"><div><h2>Danh sách {config.title.toLowerCase()}</h2><p>{config.rows.length} bản ghi mẫu · Chọn một dòng để xem chi tiết.</p></div></div>
        <div className="table-scroll"><table className="admin-preview-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th aria-label="Chi tiết" /></tr></thead><tbody>
          {config.rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={config.columns[index]}>{cell}</td>)}<td><button className="row-action" onClick={() => setSelectedId(row.id)}>Chi tiết ›</button></td></tr>)}
        </tbody></table></div>
        <div className="table-footer">Dữ liệu đang dùng để duyệt bố cục. Bộ lọc và phân trang sẽ được làm ở giai đoạn kế tiếp.</div>
      </section>
    </div>
    {selected && <div className="overlay" onMouseDown={() => setSelectedId(null)}><aside className="details-panel" role="dialog" aria-modal="true" aria-label={`Chi tiết ${config.title}`} onMouseDown={(event) => event.stopPropagation()}><div className="panel-header"><div><span className="eyebrow">CHI TIẾT MẪU</span><h2>{config.title} #{selected.id}</h2></div><button className="icon-button" aria-label="Đóng chi tiết" onClick={() => setSelectedId(null)}>×</button></div><div className="panel-body admin-preview-details">{selected.details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}<p>Trang này đang chỉ đọc. Thao tác quản trị sẽ được triển khai sau khi có API và kiểm tra quyền.</p></div></aside></div>}
  </>
}
