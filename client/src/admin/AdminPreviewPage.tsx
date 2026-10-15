import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { demoAirlines, demoBookings, demoDashboard, demoFlights, demoPayments, demoUsers } from './fixtures'
import { formatMoney, previewCatalog, type CatalogRow, type ListKind } from './previewCatalog'
import { initialPreviewQuery, queryPreviewRows, type PreviewQuery } from './previewQuery'

type PreviewKind = 'dashboard' | ListKind
const demoCaption = 'Dữ liệu mẫu để duyệt giao diện; chưa kết nối API quản trị.'

function DashboardPreview() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate)
  const inRange = (value: string) => {
    const date = value.slice(0, 10)
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
  }
  const bookings = invalidRange ? [] : demoBookings.filter((item) => inRange(item.createdAt))
  const payments = invalidRange ? [] : demoPayments.filter((item) => inRange(item.createdAt))
  const querySuffix = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra)
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)
    return params.size ? `?${params}` : ''
  }
  const cards = [
    { label: 'Hãng đang hoạt động', value: String(demoDashboard.activeAirlines), to: '/admin/airlines?status=ACTIVE' },
    { label: 'Tài khoản đang hoạt động', value: String(demoDashboard.activeUsers), to: '/admin/users?status=ACTIVE' },
    { label: 'Chuyến đang bán', value: String(demoDashboard.onSaleFlights), to: '/admin/flights?saleStatus=ON_SALE' },
    { label: 'Booking xác nhận', value: String(bookings.filter((item) => item.status === 'CONFIRMED').length), to: `/admin/bookings${querySuffix({ status: 'CONFIRMED' })}` },
    { label: 'Thanh toán cần kiểm tra', value: String(payments.filter((item) => item.reviewStatus === 'NEEDS_REVIEW').length), to: `/admin/payments${querySuffix({ reviewStatus: 'NEEDS_REVIEW' })}` },
    { label: 'Doanh thu mô phỏng', value: formatMoney(payments.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0)), to: `/admin/payments${querySuffix({ status: 'PAID' })}` },
  ]
  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">ADMIN DASHBOARD</div><h1>Tổng quan hệ thống</h1><p>{demoCaption}</p></div></div>
    <div className="admin-dashboard-range">
      <strong>Khoảng ngày booking và thanh toán</strong>
      <label>Từ ngày <input aria-label="Từ ngày tổng quan" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>Đến ngày <input aria-label="Đến ngày tổng quan" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      {(fromDate || toDate) && <button type="button" onClick={() => { setFromDate(''); setToDate('') }}>Xóa lọc</button>}
    </div>
    {invalidRange && <p className="admin-filter-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
    <div className="admin-dashboard-grid">{cards.map((card) => <Link className="summary-card admin-summary-link" to={card.to} key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>Xem danh sách ›</small></Link>)}</div>
    <section className="list-card admin-intro-card"><h2>Việc cần chú ý</h2><p>{demoDashboard.hiddenFlights} chuyến đang tạm ẩn · {payments.filter((item) => item.status === 'FAILED').length} thanh toán lỗi · {demoDashboard.lockedUsers} tài khoản bị khóa.</p><p>Chọn một thẻ hoặc mục trong menu để tra cứu dữ liệu.</p></section>
  </div>
}

function DetailDrawer({ title, row, onClose }: { title: string; row: CatalogRow; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="overlay" onMouseDown={onClose}>
    <aside className="details-panel" role="dialog" aria-modal="true" aria-label={`Chi tiết ${title}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="panel-header"><div><span className="eyebrow">CHI TIẾT · DỮ LIỆU MẪU</span><h2>{title} #{row.id}</h2></div><button ref={closeRef} className="icon-button" aria-label="Đóng chi tiết" onClick={onClose}>×</button></div>
      <div className="panel-body admin-preview-details">
        {row.sections.map((section) => <section key={section.title} className="admin-detail-section"><h3>{section.title}</h3><dl>{section.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></section>)}
        <p>Trang này đang chỉ đọc. Các thao tác can thiệp sẽ triển khai cùng API và phân quyền.</p>
      </div>
    </aside>
  </div>
}

function ListPreview({ kind }: { kind: ListKind }) {
  const config = previewCatalog[kind]
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState<PreviewQuery>(() => ({
    ...initialPreviewQuery,
    choices: Object.fromEntries(config.selects.map((control) => [control.key, searchParams.get(control.key) ?? ''])),
    fromDate: searchParams.get('fromDate') ?? '',
    toDate: searchParams.get('toDate') ?? '',
  }))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const invalidRange = Boolean(query.fromDate && query.toDate && query.fromDate > query.toDate)
  const result = queryPreviewRows(config.rows, query)
  const selected = config.rows.find((row) => row.id === selectedId)
  const activeFilters = Boolean(query.search || query.fromDate || query.toDate || Object.values(query.choices).some(Boolean) || Object.values(query.dates).some(Boolean))

  function updateQuery(change: Partial<PreviewQuery>) {
    setQuery((current) => ({ ...current, ...change, page: 1 }))
    setSelectedId(null)
  }
  function resetFilters() {
    setQuery({ ...initialPreviewQuery, pageSize: query.pageSize })
    setSelectedId(null)
  }
  function changeSort(index: number) {
    setQuery((current) => ({ ...current, sortIndex: index, sortDirection: current.sortIndex === index && current.sortDirection === 'asc' ? 'desc' : 'asc', page: 1 }))
  }
  function submitFilters(event: FormEvent) { event.preventDefault() }

  return <>
    <div className="content">
      <div className="page-heading"><div><div className="eyebrow">ADMIN CONTENT</div><h1>{config.title}</h1><p>{config.description}</p></div><span className="admin-data-label">Dữ liệu mẫu</span></div>
      <section className="list-card">
        <div className="list-card-header"><div><h2>Danh sách {config.title.toLowerCase()}</h2><p>{demoCaption}</p></div><span className="admin-result-count">{result.total} kết quả</span></div>
        <form className="admin-list-filters" onSubmit={submitFilters}>
          <label className="admin-search-field">Tìm kiếm<input type="search" value={query.search} placeholder={config.searchPlaceholder} onChange={(event) => updateQuery({ search: event.target.value })} /></label>
          {config.selects.map((control) => <label key={control.key}>{control.label}<select value={query.choices[control.key] ?? ''} onChange={(event) => updateQuery({ choices: { ...query.choices, [control.key]: event.target.value } })}><option value="">Tất cả</option>{control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
          {config.dates?.map((control) => <label key={control.key}>{control.label}<input type="date" value={query.dates[control.key] ?? ''} onChange={(event) => updateQuery({ dates: { ...query.dates, [control.key]: event.target.value } })} /></label>)}
          {config.rangeLabel && <><label>{config.rangeLabel} từ<input aria-label={`${config.rangeLabel} từ`} type="date" value={query.fromDate} onChange={(event) => updateQuery({ fromDate: event.target.value })} /></label><label>Đến ngày<input aria-label={`${config.rangeLabel} đến`} type="date" value={query.toDate} onChange={(event) => updateQuery({ toDate: event.target.value })} /></label></>}
          <button className="admin-clear-button" type="button" disabled={!activeFilters} onClick={resetFilters}>Xóa lọc</button>
        </form>
        {invalidRange && <p className="admin-filter-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
        {result.total > 0 ? <div className="table-scroll"><table className="admin-preview-table"><thead><tr>{config.columns.map((column, index) => <th key={column} aria-sort={query.sortIndex === index ? (query.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => changeSort(index)}>{column}<span aria-hidden="true">{query.sortIndex === index ? (query.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}<th aria-label="Chi tiết" /></tr></thead><tbody>
          {result.items.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={config.columns[index]}>{cell}</td>)}<td><button className="row-action" onClick={() => setSelectedId(row.id)}>Chi tiết ›</button></td></tr>)}
        </tbody></table></div> : <div className="empty-state"><strong>{activeFilters ? 'Không có kết quả phù hợp' : 'Chưa có dữ liệu'}</strong><p>{activeFilters ? 'Thử đổi hoặc xóa bộ lọc.' : 'Danh sách này hiện chưa có bản ghi.'}</p>{activeFilters && <button className="outline-button" onClick={resetFilters}>Xóa bộ lọc</button>}</div>}
        <div className="table-footer admin-list-footer"><span>Hiển thị {result.start}–{result.end} trong {result.total} bản ghi</span><div className="admin-page-controls"><label>Số dòng <select aria-label="Số dòng mỗi trang" value={query.pageSize} onChange={(event) => updateQuery({ pageSize: Number(event.target.value) })}><option value={2}>2 (demo)</option><option value={5}>5</option><option value={10}>10</option></select></label><button disabled={result.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))} aria-label="Trang trước">‹</button><span>Trang {result.page}/{result.pageCount}</span><button disabled={result.page >= result.pageCount} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))} aria-label="Trang sau">›</button></div></div>
      </section>
    </div>
    {selected && <DetailDrawer title={config.title} row={selected} onClose={() => setSelectedId(null)} />}
  </>
}

export default function AdminPreviewPage({ kind }: { kind: PreviewKind }) {
  return kind === 'dashboard' ? <DashboardPreview /> : <ListPreview key={kind} kind={kind} />
}
