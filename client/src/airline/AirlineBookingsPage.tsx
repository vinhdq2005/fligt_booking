import { useEffect, useMemo, useState } from 'react'
import { getAirportCodes } from '../api'
import { displayStatus, formatDateTime } from '../admin/previewCatalog'
import { getAirlineBooking, getAirlineBookings, type AirlineBookingDetail, type AirlineBookingsResponse } from './airlineApi'

const emptyFilters = { search: '', bookingFromDate: '', bookingToDate: '', flightFromDate: '', flightToDate: '',
  departureCode: '', arrivalCode: '', status: '', paymentStatus: '' }
const money = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
const paymentLabel = (value: string) => value === 'NO_PAYMENT' ? 'Chưa có giao dịch' : displayStatus(value)
const ticketLabel = (value: string) => ({ ISSUED: 'Đã phát hành', USED: 'Đã sử dụng', CANCELLED: 'Đã hủy' } as Record<string, string>)[value] ?? value
const dateOnly = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'UTC' })

function StatePill({ label, live = false }: { label: string; live?: boolean }) {
  return <span className={`airline-status${live ? ' is-live' : ''}`}>{label}</span>
}

export default function AirlineBookingsPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [airports, setAirports] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<AirlineBookingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AirlineBookingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const invalidRange = Boolean(filters.bookingFromDate && filters.bookingToDate && filters.bookingFromDate > filters.bookingToDate ||
    filters.flightFromDate && filters.flightToDate && filters.flightFromDate > filters.flightToDate)
  const filterKey = JSON.stringify(filters)
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()) })
    return params
  }, [filterKey, page, pageSize])
  useEffect(() => { getAirportCodes().then(setAirports).catch(() => {}) }, [])
  useEffect(() => {
    if (invalidRange) { setLoading(false); return }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      getAirlineBookings(query).then(result => { if (active) { setData(result); setError('') } })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải đặt chỗ.') })
        .finally(() => { if (active) setLoading(false) })
    }, filters.search ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, version, invalidRange])
  useEffect(() => {
    if (selectedId === null) return
    let active = true
    setDetail(null); setDetailError(''); setDetailLoading(true)
    getAirlineBooking(selectedId).then(result => { if (active) setDetail(result.item) })
      .catch(cause => { if (active) setDetailError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết đặt chỗ.') })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedId])
  const change = (key: keyof typeof emptyFilters, value: string) => { setFilters(current => ({ ...current, [key]: value })); setPage(1) }
  const close = () => { setSelectedId(null); setDetail(null); setDetailError('') }
  return <div className="content airline-content airline-bookings-page">
    <div className="page-heading"><div><div className="eyebrow">QUẢN LÝ BÁN VÉ</div><h1>Đặt chỗ & vé</h1><p>Tra cứu booking, thông tin liên hệ, hành khách và vé của hãng.</p></div></div>
    <section className="airline-card"><div className="airline-card-header"><div><h2>Danh sách đặt chỗ</h2><p>Ngày đặt và ngày bay là hai bộ lọc riêng. Danh sách sắp xếp theo đặt chỗ mới nhất.</p></div><span>{data?.pagination.total ?? 0} booking</span></div>
      <div className="airline-filters">
        <label>Tìm booking<input type="search" placeholder="Mã, chuyến, liên hệ, hành khách" value={filters.search} onChange={event => change('search', event.target.value)} /></label>
        <label>Đặt từ ngày<input type="date" value={filters.bookingFromDate} onChange={event => change('bookingFromDate', event.target.value)} /></label>
        <label>Đặt đến ngày<input type="date" value={filters.bookingToDate} onChange={event => change('bookingToDate', event.target.value)} /></label>
        <label>Bay từ ngày<input type="date" value={filters.flightFromDate} onChange={event => change('flightFromDate', event.target.value)} /></label>
        <label>Bay đến ngày<input type="date" value={filters.flightToDate} onChange={event => change('flightToDate', event.target.value)} /></label>
        <label>Sân bay đi<select value={filters.departureCode} onChange={event => change('departureCode', event.target.value)}><option value="">Tất cả</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>Sân bay đến<select value={filters.arrivalCode} onChange={event => change('arrivalCode', event.target.value)}><option value="">Tất cả</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>Booking<select value={filters.status} onChange={event => change('status', event.target.value)}><option value="">Tất cả</option>{['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(value => <option key={value} value={value}>{displayStatus(value)}</option>)}</select></label>
        <label>Thanh toán<select value={filters.paymentStatus} onChange={event => change('paymentStatus', event.target.value)}><option value="">Tất cả</option>{['PAID', 'REFUNDED', 'PENDING', 'FAILED', 'NO_PAYMENT'].map(value => <option key={value} value={value}>{paymentLabel(value)}</option>)}</select></label>
        <button className="outline-button" type="button" onClick={() => { setFilters(emptyFilters); setPage(1) }}>Xóa lọc</button>
      </div>
      {invalidRange && <p className="airline-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc trong từng khoảng lọc.</p>}
      {!invalidRange && loading && <div className="airline-state" role="status">Đang tải đặt chỗ…</div>}
      {!invalidRange && !loading && error && <div className="airline-state" role="alert">{error} <button className="outline-button" onClick={() => setVersion(value => value + 1)}>Thử lại</button></div>}
      {!invalidRange && !loading && !error && data && (data.items.length ? <div className="airline-table-scroll"><table><thead><tr><th>MÃ ĐẶT CHỖ</th><th>CHUYẾN BAY</th><th>NGƯỜI LIÊN HỆ</th><th>HÀNH KHÁCH</th><th>TỔNG TIỀN</th><th>BOOKING</th><th>THANH TOÁN</th><th>NGÀY ĐẶT</th><th /></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><button className="booking-code-button" type="button" onClick={() => setSelectedId(item.id)} aria-label={`Xem ${item.passengerCount} hành khách trong đặt chỗ ${item.bookingCode}`}>{item.bookingCode}</button></td><td><strong>Chiều đi · {item.flight.flightNumber}</strong><small>{item.flight.departureCode} → {item.flight.arrivalCode} · {formatDateTime(item.flight.departureTime)}</small>{item.returnFlight && <><strong>Chiều về · {item.returnFlight.flightNumber}</strong><small>{item.returnFlight.departureCode} → {item.returnFlight.arrivalCode} · {formatDateTime(item.returnFlight.departureTime)}</small></>}</td><td><strong>{item.contactName}</strong><small>SĐT: {item.contactPhone || 'Chưa cung cấp'}</small><small>Email: {item.contactEmail || 'Chưa cung cấp'}</small></td><td>{item.passengerCount}</td><td>{money(item.totalAmount)}</td><td><StatePill label={item.status === 'PENDING' && item.expiresAt && new Date(item.expiresAt) <= new Date() ? 'Quá hạn thanh toán' : displayStatus(item.status)} live={item.status === 'CONFIRMED'} /></td><td><StatePill label={paymentLabel(item.paymentStatus)} live={item.paymentStatus === 'PAID'} /></td><td>{formatDateTime(item.createdAt)}</td><td><button className="airline-row-button" type="button" onClick={() => setSelectedId(item.id)}>Xem chi tiết ›</button></td></tr>)}</tbody></table></div> : <div className="airline-empty">Không có đặt chỗ phù hợp bộ lọc.</div>)}
      {data && !invalidRange && !error && <div className="airline-pagination"><span>Hiển thị {data.pagination.total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, data.pagination.total)} trong {data.pagination.total} booking</span><div><label>Số dòng <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước">‹</button><span>Trang {page}/{data.pagination.pageCount}</span><button disabled={page >= data.pagination.pageCount} onClick={() => setPage(value => value + 1)} aria-label="Trang sau">›</button></div></div>}
    </section>
    {selectedId !== null && <div className="airline-panel-backdrop" onMouseDown={close}><aside className="airline-panel airline-booking-panel" role="dialog" aria-modal="true" aria-label="Chi tiết đặt chỗ" onMouseDown={event => event.stopPropagation()}><div className="airline-panel-head"><div><span className="eyebrow">ĐẶT CHỖ & VÉ</span><h2>{detail?.bookingCode ?? 'Chi tiết đặt chỗ'}</h2></div><button onClick={close} aria-label="Đóng">×</button></div>
      {detailLoading && <div className="airline-state" role="status">Đang tải chi tiết…</div>}
      {detailError && <div className="airline-state" role="alert">{detailError}</div>}
      {detail && <div className="airline-panel-body"><div className="booking-detail-section"><h3>Hành khách & vé ({detail.passengers.length})</h3><div className="booking-ticket-table"><table><thead><tr><th>HÀNH KHÁCH</th><th>NGÀY SINH</th><th>QUỐC TỊCH</th><th>CHUYẾN BAY</th><th>MÃ VÉ</th><th>GIÁ VÉ</th><th>TRẠNG THÁI VÉ</th><th>PHÁT HÀNH</th><th>SỬ DỤNG</th></tr></thead><tbody>{detail.passengers.flatMap(person => (person.tickets.length ? person.tickets : [null]).map((ticket, ticketIndex) => <tr key={`${person.id}-${ticket?.flightId ?? 'pending'}`}><td><strong>{person.fullName}</strong></td><td>{ticketIndex === 0 && person.dateOfBirth ? dateOnly(person.dateOfBirth) : '—'}</td><td>{ticketIndex === 0 ? person.nationality || '—' : '—'}</td><td>{ticket?.flight.flightNumber ?? '—'}</td><td>{ticket?.ticketCode || '—'}</td><td>{ticket ? money(ticket.price) : '—'}</td><td>{ticket ? <StatePill label={ticketLabel(ticket.status)} live={ticket.status === 'ISSUED'} /> : 'Chưa phát hành'}</td><td>{ticket ? formatDateTime(ticket.issuedAt) : '—'}</td><td>{ticket?.usedAt ? formatDateTime(ticket.usedAt) : '—'}</td></tr>))}</tbody></table></div></div>
        <div className="booking-detail-section"><h3>Đặt chỗ</h3><dl><div><dt>Trạng thái</dt><dd>{detail.status === 'PENDING' && detail.expiresAt && new Date(detail.expiresAt) <= new Date() ? 'Quá hạn thanh toán' : displayStatus(detail.status)}</dd></div><div><dt>Thanh toán</dt><dd>{paymentLabel(detail.paymentStatus)}</dd></div><div><dt>Ngày đặt</dt><dd>{formatDateTime(detail.createdAt)}</dd></div><div><dt>Hạn thanh toán</dt><dd>{detail.expiresAt ? formatDateTime(detail.expiresAt) : '—'}</dd></div><div><dt>Tổng tiền</dt><dd>{money(detail.totalAmount)}</dd></div></dl></div>
        <div className="booking-detail-section"><h3>Chiều đi</h3><dl><div><dt>Số hiệu</dt><dd>{detail.flight.flightNumber}</dd></div><div><dt>Tuyến</dt><dd>{detail.flight.departureCode} → {detail.flight.arrivalCode}</dd></div><div><dt>Khởi hành</dt><dd>{formatDateTime(detail.flight.departureTime)}</dd></div><div><dt>Đến nơi</dt><dd>{formatDateTime(detail.flight.arrivalTime)}</dd></div></dl>{detail.returnFlight && <><h4>Chiều về</h4><dl><div><dt>Số hiệu</dt><dd>{detail.returnFlight.flightNumber}</dd></div><div><dt>Tuyến</dt><dd>{detail.returnFlight.departureCode} → {detail.returnFlight.arrivalCode}</dd></div><div><dt>Khởi hành</dt><dd>{formatDateTime(detail.returnFlight.departureTime)}</dd></div><div><dt>Đến nơi</dt><dd>{formatDateTime(detail.returnFlight.arrivalTime)}</dd></div></dl></>}</div>
        <div className="booking-detail-section"><h3>Người liên hệ</h3><dl><div><dt>Họ tên</dt><dd>{detail.contactName}</dd></div><div><dt>Số điện thoại</dt><dd>{detail.contactPhone || 'Chưa cung cấp'}</dd></div><div><dt>Email</dt><dd className="booking-email">{detail.contactEmail || 'Chưa cung cấp'}</dd></div></dl></div>
        <div className="booking-detail-section"><h3>Giao dịch ({detail.payments.length})</h3>{detail.payments.length ? <div className="booking-payment-list">{detail.payments.map(payment => <div key={payment.id}><strong>{money(payment.amount)}</strong><StatePill label={paymentLabel(payment.status)} live={payment.status === 'PAID'} /><small>{formatDateTime(payment.createdAt)} · {payment.method}</small>{payment.reviewStatus === 'NEEDS_REVIEW' && <small>Cần kiểm tra thủ công</small>}</div>)}</div> : <p>Chưa có giao dịch thanh toán.</p>}</div>
      </div>}
    </aside></div>}
  </div>
}
