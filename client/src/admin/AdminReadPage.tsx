import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminRequestError, getAdminDetail, getAdminOptions, getAdminOverview, listAdminData, submitAdminIntervention, type AdminOptions } from './adminReadApi'
import { getRealInterventionPlan, type RealInterventionPlan } from './adminInterventionPlan'
import AdminInterventionDialog from './AdminInterventionDialog'
import AdminCreateStaffDialog from './AdminCreateStaffDialog'
import { useAuth } from '../auth/AuthContext'
import type { AdminDashboard, PageResult } from './models'
import { displayStatus, formatDateTime, formatMoney, type ListKind } from './previewCatalog'

type Kind = 'dashboard' | ListKind
type Item = Record<string, unknown>
type Filter = { key: string; label: string; values?: string[]; date?: boolean }
type Column = { label: string; value: (item: Item) => string; sort?: string }
const text = (item: Item, key: string) => String(item[key] ?? '—')
const date = (item: Item, key: string) => formatDateTime(item[key] ? String(item[key]) : null)
const money = (item: Item, key: string) => formatMoney(Number(item[key] ?? 0))
const airlineFilter: Filter = { key: 'airlineId', label: 'Hãng bay' }
const status = (item: Item, key: string) => displayStatus(text(item, key))
const roleLabels: Record<string, string> = { ADMIN: 'Quản trị viên', CUSTOMER: 'Khách hàng', AIRLINE_FLIGHT_MANAGER: 'Quản lý chuyến', AIRLINE_SALES_MANAGER: 'Quản lý bán vé' }
const role = (value: unknown) => roleLabels[String(value)] ?? String(value ?? '—')
const actionLabels: Record<string, string> = { LOCK_AIRLINE: 'Khóa hãng', UNLOCK_AIRLINE: 'Mở hãng', LOCK_USER: 'Khóa tài khoản', UNLOCK_USER: 'Mở tài khoản', HIDE_FLIGHT: 'Tạm ẩn chuyến', REOPEN_FLIGHT: 'Mở bán lại', CANCEL_BOOKING_EXCEPTION: 'Hủy booking ngoại lệ', MARK_PAYMENT_REVIEW: 'Đánh dấu cần kiểm tra' }
const action = (value: unknown) => actionLabels[String(value)] ?? String(value ?? '—')
const auditSection = (item: Item) => ({ title: 'Nhật ký liên quan', fields: [[
  'Can thiệp',
  (item.auditTrail as Array<{ action: string; reason: string | null; actorName: string; createdAt: string }> | undefined)?.map(log => `${formatDateTime(log.createdAt)} · ${log.actorName}: ${action(log.action)}${log.reason ? ` — ${log.reason}` : ''}`).join('; ') || 'Chưa có can thiệp',
]] as Array<[string, string]> })
const configurations: Record<ListKind, { title: string; search: string; columns: Column[]; filters: Filter[] }> = {
  airlines: { title: 'Hãng bay', search: 'Mã hoặc tên hãng', filters: [{ key: 'status', label: 'Trạng thái', values: ['ACTIVE', 'LOCKED'] }], columns: [
    { label: 'MÃ HÃNG', value: i => text(i, 'code'), sort: 'code' }, { label: 'TÊN HÃNG', value: i => text(i, 'name'), sort: 'name' }, { label: 'TRẠNG THÁI', value: i => status(i, 'status'), sort: 'status' }, { label: 'NHÂN VIÊN', value: i => text(i, 'staffCount') }, { label: 'CHUYẾN ĐANG BÁN', value: i => text(i, 'onSaleFlightCount') },
  ] },
  users: { title: 'Tài khoản', search: 'Tên hoặc email', filters: [{ key: 'role', label: 'Vai trò', values: ['ADMIN', 'CUSTOMER', 'AIRLINE_FLIGHT_MANAGER', 'AIRLINE_SALES_MANAGER'] }, airlineFilter, { key: 'status', label: 'Trạng thái', values: ['ACTIVE', 'LOCKED'] }], columns: [
    { label: 'HỌ TÊN', value: i => text(i, 'name'), sort: 'name' }, { label: 'EMAIL', value: i => text(i, 'email'), sort: 'email' }, { label: 'VAI TRÒ', value: i => role(i.role), sort: 'role' }, { label: 'HÃNG BAY', value: i => text(i, 'airlineName') }, { label: 'TRẠNG THÁI', value: i => status(i, 'status'), sort: 'status' }, { label: 'ĐĂNG NHẬP', value: i => date(i, 'lastLoginAt'), sort: 'lastLoginAt' },
  ] },
  flights: { title: 'Chuyến bay', search: 'Mã chuyến hoặc hãng', filters: [airlineFilter, { key: 'departureCode', label: 'Sân bay đi' }, { key: 'arrivalCode', label: 'Sân bay đến' }, { key: 'departureDate', label: 'Ngày bay', date: true }, { key: 'status', label: 'Trạng thái bay', values: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'] }, { key: 'saleStatus', label: 'Mở bán', values: ['ON_SALE', 'HIDDEN'] }], columns: [
    { label: 'MÃ CHUYẾN', value: i => text(i, 'flightNumber'), sort: 'flightNumber' }, { label: 'HÃNG', value: i => text(i, 'airlineName') }, { label: 'TUYẾN', value: i => `${text(i, 'departureCode')} → ${text(i, 'arrivalCode')}` }, { label: 'GIỜ ĐI', value: i => date(i, 'departureTime'), sort: 'departureTime' }, { label: 'GIÁ', value: i => money(i, 'basePrice'), sort: 'basePrice' }, { label: 'CHỖ CÒN', value: i => `${text(i, 'availableSeats')}/${text(i, 'capacity')}` }, { label: 'MỞ BÁN', value: i => status(i, 'saleStatus'), sort: 'saleStatus' },
  ] },
  bookings: { title: 'Booking', search: 'Mã booking, khách hoặc chuyến', filters: [airlineFilter, { key: 'status', label: 'Trạng thái', values: ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'] }, { key: 'departureDate', label: 'Ngày bay', date: true }, { key: 'fromDate', label: 'Tạo từ', date: true }, { key: 'toDate', label: 'Đến ngày', date: true }], columns: [
    { label: 'MÃ BOOKING', value: i => text(i, 'bookingCode'), sort: 'bookingCode' }, { label: 'HÃNG', value: i => text(i, 'airlineName') }, { label: 'CHUYẾN', value: i => text(i, 'flightNumber') }, { label: 'KHÁCH LIÊN HỆ', value: i => text(i, 'contactName'), sort: 'contactName' }, { label: 'TỔNG TIỀN', value: i => money(i, 'totalAmount'), sort: 'totalAmount' }, { label: 'TRẠNG THÁI', value: i => status(i, 'status'), sort: 'status' }, { label: 'NGÀY TẠO', value: i => date(i, 'createdAt'), sort: 'createdAt' },
  ] },
  payments: { title: 'Thanh toán', search: 'Mã giao dịch hoặc booking', filters: [airlineFilter, { key: 'status', label: 'Trạng thái', values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] }, { key: 'reviewStatus', label: 'Kiểm tra', values: ['NONE', 'NEEDS_REVIEW', 'RESOLVED'] }, { key: 'fromDate', label: 'Từ ngày', date: true }, { key: 'toDate', label: 'Đến ngày', date: true }], columns: [
    { label: 'GIAO DỊCH', value: i => i.providerTransactionId ? text(i, 'providerTransactionId') : `#${text(i, 'id')}`, sort: 'id' }, { label: 'BOOKING', value: i => text(i, 'bookingCode') }, { label: 'HÃNG', value: i => text(i, 'airlineName') }, { label: 'SỐ TIỀN', value: i => money(i, 'amount'), sort: 'amount' }, { label: 'TRẠNG THÁI', value: i => status(i, 'status'), sort: 'status' }, { label: 'KIỂM TRA', value: i => status(i, 'reviewStatus'), sort: 'reviewStatus' }, { label: 'THỜI GIAN', value: i => date(i, 'createdAt'), sort: 'createdAt' },
  ] },
  'audit-logs': { title: 'Nhật ký', search: 'Người thực hiện hoặc lý do', filters: [{ key: 'actorId', label: 'Người thực hiện' }, { key: 'action', label: 'Hành động' }, { key: 'entityType', label: 'Đối tượng', values: ['AIRLINE', 'USER', 'FLIGHT', 'BOOKING', 'PAYMENT'] }, { key: 'fromDate', label: 'Từ ngày', date: true }, { key: 'toDate', label: 'Đến ngày', date: true }], columns: [
    { label: 'THỜI GIAN', value: i => date(i, 'createdAt'), sort: 'createdAt' }, { label: 'NGƯỜI THỰC HIỆN', value: i => text(i, 'actorName') }, { label: 'HÀNH ĐỘNG', value: i => action(i.action), sort: 'action' }, { label: 'ĐỐI TƯỢNG', value: i => `${text(i, 'entityType')} #${text(i, 'entityId')}`, sort: 'entityType' }, { label: 'KẾT QUẢ', value: i => status(i, 'result'), sort: 'result' },
  ] },
}

function detailSections(kind: ListKind, item: Item): Array<{ title: string; fields: Array<[string, string]> }> {
  const field = (label: string, key: string): [string, string] => [label, text(item, key)]
  if (kind === 'airlines') return [
    { title: 'Thông tin hãng', fields: [field('Mã hãng', 'code'), field('Tên hãng', 'name'), ['Trạng thái', status(item, 'status')], ['Ngày tạo', date(item, 'createdAt')]] },
    { title: 'Liên quan', fields: [['Tài khoản', text(item, 'staffCount')], ['Chuyến đang bán', text(item, 'onSaleFlightCount')], ['Nhân viên (tối đa 20)', (item.users as Array<{ name: string }> | undefined)?.map(user => user.name).join(', ') || 'Không có'], ['Chuyến (tối đa 20)', (item.flights as Array<{ flightNumber: string }> | undefined)?.map(flight => flight.flightNumber).join(', ') || 'Không có']] }, auditSection(item),
  ]
  if (kind === 'users') return [
    { title: 'Hồ sơ', fields: [field('Họ tên', 'name'), field('Email', 'email'), field('Số điện thoại', 'phone'), ['Đăng nhập gần nhất', date(item, 'lastLoginAt')]] },
    { title: 'Quyền truy cập', fields: [['Vai trò', role(item.role)], field('Hãng bay', 'airlineName'), ['Trạng thái', status(item, 'status')]] }, auditSection(item),
  ]
  if (kind === 'flights') return [
    { title: 'Lịch bay', fields: [field('Mã chuyến', 'flightNumber'), field('Hãng bay', 'airlineName'), ['Tuyến', `${text(item, 'departureCode')} → ${text(item, 'arrivalCode')}`], ['Giờ đi', date(item, 'departureTime')], ['Giờ đến', date(item, 'arrivalTime')]] },
    { title: 'Bán vé nội bộ', fields: [['Trạng thái bay', status(item, 'status')], ['Mở bán', status(item, 'saleStatus')], ['Giá cơ bản', money(item, 'basePrice')], ['Chỗ còn', `${text(item, 'availableSeats')}/${text(item, 'capacity')}`], field('Số booking', 'bookingCount')] },
    { title: 'Booking (tối đa 30)', fields: [['Mã booking', (item.bookings as Array<{ bookingCode: string; status: string }> | undefined)?.map(booking => `${booking.bookingCode} (${displayStatus(booking.status)})`).join(', ') || 'Không có']] }, auditSection(item),
  ]
  if (kind === 'bookings') return [
    { title: 'Booking', fields: [field('Mã booking', 'bookingCode'), ['Trạng thái', status(item, 'status')], ['Tổng tiền', money(item, 'totalAmount')], ['Ngày tạo', date(item, 'createdAt')], ['Giữ chỗ đến', date(item, 'expiresAt')]] },
    { title: 'Chuyến bay', fields: [field('Hãng bay', 'airlineName'), field('Mã chuyến', 'flightNumber'), ['Tuyến', `${text(item, 'departureCode')} → ${text(item, 'arrivalCode')}`], ['Giờ đi', date(item, 'departureTime')]] },
    { title: 'Liên hệ và hành khách', fields: [field('Khách liên hệ', 'contactName'), field('Email', 'contactEmail'), field('Điện thoại', 'contactPhoneMasked'), ['Hành khách', (item.passengers as Array<{ fullName: string; documentNumberMasked: string | null }> | undefined)?.map(person => `${person.fullName} (${person.documentNumberMasked ?? 'chưa có giấy tờ'})`).join(', ') || 'Không có']] },
    { title: 'Thanh toán', fields: [['Giao dịch', (item.payments as Array<{ id: number; status: string; amount: number }> | undefined)?.map(payment => `#${payment.id}: ${displayStatus(payment.status)} · ${formatMoney(payment.amount)}`).join(', ') || 'Không có']] }, auditSection(item),
  ]
  if (kind === 'payments') return [
    { title: 'Giao dịch', fields: [field('Mã giao dịch', 'providerTransactionId'), field('Phương thức', 'method'), ['Số tiền', money(item, 'amount')], ['Trạng thái', status(item, 'status')], ['Ngày tạo', date(item, 'createdAt')]] },
    { title: 'Đối soát', fields: [['Kiểm tra', status(item, 'reviewStatus')], field('Mã booking', 'bookingCode'), ['Trạng thái booking', status(item, 'bookingStatus')], field('Hãng bay', 'airlineName')] }, auditSection(item),
  ]
  return [
    { title: 'Thao tác', fields: [['Thời gian', date(item, 'createdAt')], field('Người thực hiện', 'actorName'), ['Vai trò', role(item.actorRole)], ['Hành động', action(item.action)], ['Đối tượng', `${text(item, 'entityType')} #${text(item, 'entityId')}`], ['Kết quả', status(item, 'result')], field('Lý do', 'reason'), field('Mã yêu cầu', 'requestId')] },
    { title: 'Thay đổi', fields: [['Trước', item.before ? JSON.stringify(item.before) : '—'], ['Sau', item.after ? JSON.stringify(item.after) : '—']] },
  ]
}

function Dashboard() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [summary, setSummary] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate)
  useEffect(() => {
    if (invalidRange) return
    let active = true
    const params = new URLSearchParams()
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)
    getAdminOverview(params).then(({ item }) => { if (active) { setSummary(item); setError('') } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải tổng quan.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fromDate, toDate, invalidRange, retry])
  const link = (path: string, extra: Record<string, string>) => { const params = new URLSearchParams(extra); if (fromDate) params.set('fromDate', fromDate); if (toDate) params.set('toDate', toDate); return `${path}?${params}` }
  const cards = summary ? [
    { label: 'Hãng đang hoạt động', value: summary.activeAirlines, to: '/admin/airlines?status=ACTIVE' },
    { label: 'Tài khoản đang hoạt động', value: summary.activeUsers, to: '/admin/users?status=ACTIVE' },
    { label: 'Chuyến đang bán', value: summary.onSaleFlights, to: '/admin/flights?saleStatus=ON_SALE' },
    { label: 'Booking xác nhận', value: summary.bookingsByStatus.CONFIRMED, to: link('/admin/bookings', { status: 'CONFIRMED' }) },
    { label: 'Thanh toán cần kiểm tra', value: summary.needsReviewPayments, to: link('/admin/payments', { reviewStatus: 'NEEDS_REVIEW' }) },
    { label: 'Thanh toán mô phỏng', value: formatMoney(summary.simulatedPaidAmount), to: link('/admin/payments', { status: 'PAID' }) },
  ] : []
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">ADMIN DASHBOARD</div><h1>Tổng quan hệ thống</h1><p>Số liệu từ database; tiền thanh toán là mô phỏng nội bộ.</p></div></div>
    <div className="admin-dashboard-range"><strong>Khoảng ngày booking và thanh toán</strong><label>Từ ngày <input type="date" value={fromDate} onChange={event => { setFromDate(event.target.value); setLoading(true) }} /></label><label>Đến ngày <input type="date" value={toDate} onChange={event => { setToDate(event.target.value); setLoading(true) }} /></label></div>
    {invalidRange && <p className="admin-filter-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
    {invalidRange ? null : loading ? <p role="status">Đang tải số liệu…</p> : error ? <p className="admin-filter-error" role="alert">{error} <button onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Thử lại</button></p> : <><div className="admin-dashboard-grid">{cards.map(card => <Link className="summary-card admin-summary-link" to={card.to} key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>Xem danh sách ›</small></Link>)}</div><section className="list-card admin-intro-card"><h2>Việc cần chú ý</h2><p>{summary?.hiddenFlights ?? 0} chuyến đang tạm ẩn · {summary?.failedPayments ?? 0} thanh toán lỗi · {summary?.lockedUsers ?? 0} tài khoản bị khóa.</p></section></>}
  </div>
}

function ListPage({ kind }: { kind: ListKind }) {
  const config = configurations[kind]
  const { user } = useAuth()
  const [urlParams] = useSearchParams()
  const [search, setSearch] = useState(urlParams.get('search') ?? '')
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries(config.filters.map(filter => [filter.key, urlParams.get(filter.key) ?? ''])))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [options, setOptions] = useState<AdminOptions | null>(null)
  const [optionsError, setOptionsError] = useState('')
  const [result, setResult] = useState<PageResult<Item> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Item | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailRetry, setDetailRetry] = useState(0)
  const [dialogPlan, setDialogPlan] = useState<RealInterventionPlan | null>(null)
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const invalidRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
  const activeFilters = Boolean(search || Object.values(filters).some(Boolean))
  const filterKey = JSON.stringify(filters)
  const params = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search.trim()) value.set('search', search.trim())
    if (sort) { value.set('sort', sort); value.set('direction', direction) }
    Object.entries(filters).forEach(([key, option]) => { if (option) value.set(key, option) })
    return value
  }, [page, pageSize, search, sort, direction, filterKey])
  useEffect(() => { getAdminOptions().then(data => { setOptions(data); setOptionsError('') }).catch(() => setOptionsError('Không tải được lựa chọn bộ lọc.')) }, [])
  useEffect(() => {
    if (selectedId === null) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !dialogPlan) setSelectedId(null) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedId, dialogPlan])
  useEffect(() => { if (selectedId !== null && !dialogPlan) closeRef.current?.focus() }, [selectedId, dialogPlan])
  useEffect(() => {
    if (invalidRange) return
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      listAdminData(kind, params).then(data => { if (active) { setResult(data); setError('') } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách.') }).finally(() => { if (active) setLoading(false) })
    }, search ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [kind, params, invalidRange, retry])
  useEffect(() => {
    if (selectedId === null) return
    let active = true
    setDetail(null)
    setDetailError('')
    getAdminDetail(kind, selectedId).then(({ item }) => { if (active) setDetail(item) }).catch(cause => { if (active) setDetailError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết.') })
    return () => { active = false }
  }, [kind, selectedId, detailRetry])
  const plan = detail ? getRealInterventionPlan(kind, detail, user?.id) : null
  async function openAction() {
    if (selectedId === null || !plan || actionBusy) return
    setActionBusy(true)
    setNotice('')
    setNoticeError(false)
    try {
      const { item } = await getAdminDetail(kind, selectedId)
      setDetail(item)
      const freshPlan = getRealInterventionPlan(kind, item, user?.id)
      if (!freshPlan || freshPlan.action !== plan.action || freshPlan.disabledReason) {
        setNotice(freshPlan?.disabledReason || 'Trạng thái bản ghi đã thay đổi. Hãy kiểm tra lại chi tiết.')
        setNoticeError(true)
        setRetry(value => value + 1)
        return
      }
      setDialogPlan(freshPlan)
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Không thể tải lại chi tiết.'); setNoticeError(true) }
    finally { setActionBusy(false) }
  }
  async function confirmAction(reason: string, requestId: string) {
    if (!dialogPlan) return
    try {
      const outcome = await submitAdminIntervention({ action: dialogPlan.action, entityId: dialogPlan.entityId, reason }, requestId)
      setDialogPlan(null)
      setNotice(outcome.status === 'applied' ? `${dialogPlan.label} thành công. Nhật ký đã được ghi.` : 'Trạng thái đã được xử lý. Dữ liệu đã tải lại.')
      setNoticeError(false)
      setDetailRetry(value => value + 1)
      setRetry(value => value + 1)
    } catch (cause) {
      if (cause instanceof AdminRequestError && cause.status === 409) {
        setDialogPlan(null)
        setNotice(`${cause.message} Chi tiết đã được tải lại; hãy kiểm tra trước khi thử tiếp.`)
        setNoticeError(true)
        setDetailRetry(value => value + 1)
        setRetry(value => value + 1)
        return
      }
      throw cause
    }
  }
  const choices = (filter: Filter) => {
    if (filter.key === 'airlineId') return options?.airlines.map(item => ({ value: String(item.id), label: item.name })) ?? []
    if (filter.key === 'actorId') return options?.admins.map(item => ({ value: String(item.id), label: item.name })) ?? []
    if (filter.key === 'action') return options?.actions.map(value => ({ value, label: action(value) })) ?? []
    if (filter.key === 'departureCode' || filter.key === 'arrivalCode') return options?.airports.map(value => ({ value, label: value })) ?? []
    return filter.values?.map(value => ({ value, label: filter.key === 'role' ? role(value) : displayStatus(value) })) ?? []
  }
  function changeFilter(key: string, value: string) { setFilters(current => ({ ...current, [key]: value })); setPage(1); setSelectedId(null) }
  function clearFilters() { setSearch(''); setFilters({}); setPage(1); setSelectedId(null) }
  function staffCreated(created: { id: number; name: string; email: string }) {
    setShowCreateStaff(false)
    setSearch('')
    setFilters({})
    setPage(1)
    setSelectedId(created.id)
    setNotice(`Đã tạo tài khoản ${created.email}. Hãy chuyển mật khẩu khởi tạo cho nhân viên qua kênh riêng.`)
    setNoticeError(false)
    setRetry(value => value + 1)
  }
  function changeSort(field: string) { if (!field) return; setDirection(current => sort === field && current === 'asc' ? 'desc' : 'asc'); setSort(field); setPage(1) }
  const total = result?.pagination.total ?? 0
  const pageCount = result?.pagination.pageCount ?? 1
  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total)
  return <><div className="content"><div className="page-heading"><div><div className="eyebrow">ADMIN CONTENT</div><h1>{config.title}</h1><p>Dữ liệu hiện tại từ hệ thống.</p></div><span className="admin-data-label">Dữ liệu hệ thống · {kind === 'audit-logs' ? 'chỉ đọc' : 'Có kiểm soát'}</span></div>
    {notice && <div className={`admin-demo-notice${noticeError ? ' admin-error-notice' : ''}`} role={noticeError ? 'alert' : 'status'}><strong>{notice}</strong><button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
    <section className="list-card"><div className="list-card-header"><div><h2>Danh sách {config.title.toLowerCase()}</h2><p>Lọc và phân trang tại server.</p></div><div className="admin-list-heading-actions"><span className="admin-result-count">{total} kết quả</span>{kind === 'users' && <button type="button" className="primary-button" disabled={!options?.airlines.some(airline => airline.status === 'ACTIVE')} onClick={() => setShowCreateStaff(true)}>+ Tạo nhân viên hãng</button>}</div></div>
      <form className="admin-list-filters" onSubmit={(event: FormEvent) => event.preventDefault()}><label className="admin-search-field">Tìm kiếm<input type="search" value={search} placeholder={config.search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
        {config.filters.map(filter => <label key={filter.key}>{filter.label}{filter.date ? <input type="date" value={filters[filter.key] ?? ''} onChange={event => changeFilter(filter.key, event.target.value)} /> : <select value={filters[filter.key] ?? ''} onChange={event => changeFilter(filter.key, event.target.value)}><option value="">Tất cả</option>{choices(filter).map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>}</label>)}
        <button className="admin-clear-button" type="button" disabled={!activeFilters} onClick={clearFilters}>Xóa lọc</button></form>
      {optionsError && <p className="admin-filter-error" role="alert">{optionsError} <button onClick={() => getAdminOptions().then(data => { setOptions(data); setOptionsError('') }).catch(() => setOptionsError('Không tải được lựa chọn bộ lọc.'))}>Thử lại</button></p>}
      {invalidRange && <p className="admin-filter-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

      {/* Thêm phần khung chứa thanh cuộn cho bảng dữ liệu */}
      {!invalidRange && (loading ? <div className="empty-state" role="status">Đang tải danh sách…</div> : error ? <div className="empty-state" role="alert"><strong>Không thể tải dữ liệu</strong><p>{error}</p><button className="outline-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : result?.items.length ? <div style={{ maxHeight: '480px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', position: 'relative' }}><table className="admin-preview-table" style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{config.columns.map(column => <th key={column.label} style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }} aria-sort={column.sort && sort === column.sort ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>{column.sort ? <button type="button" onClick={() => changeSort(column.sort!)}>{column.label}{sort === column.sort ? direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</button> : column.label}</th>)}<th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }} aria-label="Chi tiết" /></tr></thead><tbody>{result.items.map(item => <tr key={Number(item.id)}>{config.columns.map(column => <td key={column.label}>{column.value(item)}</td>)}<td><button className="row-action" onClick={() => setSelectedId(Number(item.id))}>Chi tiết ›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>{activeFilters ? 'Không có kết quả phù hợp' : 'Chưa có dữ liệu'}</strong><p>{activeFilters ? 'Thử đổi hoặc xóa bộ lọc.' : 'Danh sách này hiện chưa có bản ghi.'}</p>{activeFilters && <button className="outline-button" onClick={clearFilters}>Xóa bộ lọc</button>}</div>)}

      <div className="table-footer admin-list-footer"><span>Hiển thị {start}–{end} trong {total} bản ghi</span><div className="admin-page-controls"><label>Số dòng <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước">‹</button><span>Trang {page}/{pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(value => value + 1)} aria-label="Trang sau">›</button></div></div>
    </section></div>
    {selectedId !== null && <div className="overlay" onMouseDown={() => { if (!dialogPlan) setSelectedId(null) }}>
      <aside className="details-panel" role="dialog" aria-modal={!dialogPlan} aria-label={`Chi tiết ${config.title}`} onMouseDown={event => event.stopPropagation()}>
        <div className="panel-header"><div><span className="eyebrow">CHI TIẾT · DỮ LIỆU THẬT</span><h2>{config.title} #{selectedId}</h2></div><button ref={closeRef} className="icon-button" aria-label="Đóng chi tiết" disabled={Boolean(dialogPlan)} onClick={() => setSelectedId(null)}>×</button></div>
        <div className="panel-body admin-preview-details">
          {detailError ? <p role="alert">{detailError} <button onClick={() => setDetailRetry(value => value + 1)}>Thử lại</button></p>
            : !detail ? <p role="status">Đang tải chi tiết…</p>
              : detailSections(kind, detail).map(section => <section className="admin-detail-section" key={section.title}><h3>{section.title}</h3><dl>{section.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}
          {plan && <section className="admin-intervention-section"><h3>Can thiệp quản trị</h3><button className="admin-intervention-button" disabled={Boolean(plan.disabledReason) || actionBusy} onClick={openAction}>{actionBusy ? 'Đang kiểm tra…' : plan.label}</button>{plan.disabledReason && <p className="admin-disabled-reason">{plan.disabledReason}</p>}</section>}
          {kind === 'audit-logs' && <p>Nhật ký chỉ đọc, không thể sửa hoặc xóa.</p>}
        </div>
      </aside>
    </div>}
    {dialogPlan && <AdminInterventionDialog plan={dialogPlan} onCancel={() => setDialogPlan(null)} onConfirm={confirmAction} />}
    {showCreateStaff && options && <AdminCreateStaffDialog airlines={options.airlines} onCancel={() => setShowCreateStaff(false)} onCreated={staffCreated} />}
  </>
}

export default function AdminReadPage({ kind }: { kind: Kind }) { return kind === 'dashboard' ? <Dashboard /> : <ListPage key={kind} kind={kind} /> }