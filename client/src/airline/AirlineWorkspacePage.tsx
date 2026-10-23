import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getAirportCodes } from '../api'
import { displayStatus, formatDateTime } from '../admin/previewCatalog'
import { createAirlineFlight, getAirlineWorkspace, saveAirlineSalesSettings, updateAirlineSaleStatus, type AirlineFlight, type AirlineWorkspace } from './airlineApi'

const money = (value: number | null) => value === null ? 'Chưa có' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const date = (value: string) => formatDateTime(value)
const status = (flight: AirlineFlight) => flight.status !== 'SCHEDULED' ? displayStatus(flight.status) : flight.saleStatus === 'ON_SALE' ? 'Đang bán' : 'Chưa mở bán'
const dateError = (filters: Record<string, string>) => Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
const flightDuration = (departureTime: string, arrivalTime: string) => {
  if (!departureTime || !arrivalTime) return null
  const minutes = Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return [hours ? `${hours} giờ` : '', remainder ? `${remainder} phút` : ''].filter(Boolean).join(' ')
}

const awaitingSaleFilters = { salesStage: 'AWAITING_SALE' }

function useWorkspace(initialFilters: Record<string, string> = {}) {
  const [data, setData] = useState<AirlineWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState('departureTime')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const filterKey = JSON.stringify(filters)
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, direction })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value.trim()) })
    return params
  }, [page, pageSize, sort, direction, filterKey])
  useEffect(() => {
    if (dateError(filters)) { setLoading(false); return }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      getAirlineWorkspace(query).then(result => { if (active) { setData(result); setError('') } })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu hãng bay.') })
        .finally(() => { if (active) setLoading(false) })
    }, filters.search ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, version])
  const change = (key: string, value: string) => { setFilters(current => ({ ...current, [key]: value })); setPage(1) }
  const reset = () => { setFilters(initialFilters); setPage(1); setSort('departureTime'); setDirection('asc') }
  const changeSort = (field: string) => { setDirection(current => sort === field && current === 'asc' ? 'desc' : 'asc'); setSort(field); setPage(1) }
  return { data, loading, error, filters, page, pageSize, sort, direction, setPage, setPageSize, change, reset, changeSort,
    invalidRange: dateError(filters), refresh: () => setVersion(value => value + 1) }
}

type WorkspaceHook = ReturnType<typeof useWorkspace>

function WorkspaceFilters({ state, awaitingOnly = false }: { state: WorkspaceHook; awaitingOnly?: boolean }) {
  const [airports, setAirports] = useState<string[]>([])
  useEffect(() => { getAirportCodes().then(setAirports).catch(() => {}) }, [])
  return <><div className="airline-filters">
    <label>Tìm chuyến<input type="search" placeholder="Số hiệu hoặc sân bay" value={state.filters.search ?? ''} onChange={event => state.change('search', event.target.value)} /></label>
    {(['departureCode', 'arrivalCode'] as const).map(key => <label key={key}>{key === 'departureCode' ? 'Sân bay đi' : 'Sân bay đến'}<select value={state.filters[key] ?? ''} onChange={event => state.change(key, event.target.value)}><option value="">Tất cả</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>)}
    <label>Ngày bay<input type="date" value={state.filters.departureDate ?? ''} onChange={event => state.change('departureDate', event.target.value)} /></label>
    <label>Từ ngày<input type="date" value={state.filters.fromDate ?? ''} onChange={event => state.change('fromDate', event.target.value)} /></label>
    <label>Đến ngày<input type="date" value={state.filters.toDate ?? ''} onChange={event => state.change('toDate', event.target.value)} /></label>
    {!awaitingOnly && <label>Trạng thái chuyến<select value={state.filters.status ?? ''} onChange={event => state.change('status', event.target.value)}><option value="">Tất cả</option>{['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'].map(value => <option key={value} value={value}>{displayStatus(value)}</option>)}</select></label>}
    {!awaitingOnly && <label>Trạng thái bán<select value={state.filters.saleStatus ?? ''} onChange={event => state.change('saleStatus', event.target.value)}><option value="">Tất cả</option><option value="HIDDEN">Chưa mở bán</option><option value="ON_SALE">Đang bán</option></select></label>}
    <button type="button" className="outline-button" onClick={state.reset}>Xóa lọc</button>
  </div>{state.invalidRange && <p className="airline-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}</>
}

function WorkspacePagination({ state }: { state: WorkspaceHook }) {
  const pagination = state.data?.pagination
  if (!pagination) return null
  return <div className="airline-pagination"><span>Hiển thị {pagination.total ? (state.page - 1) * state.pageSize + 1 : 0}–{Math.min(state.page * state.pageSize, pagination.total)} trong {pagination.total} chuyến</span><div><label>Số dòng <select value={state.pageSize} onChange={event => { state.setPageSize(Number(event.target.value)); state.setPage(1) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button disabled={state.page <= 1} onClick={() => state.setPage(value => value - 1)} aria-label="Trang trước">‹</button><span>Trang {state.page}/{pagination.pageCount}</span><button disabled={state.page >= pagination.pageCount} onClick={() => state.setPage(value => value + 1)} aria-label="Trang sau">›</button></div></div>
}

function SortHeading({ label, field, state }: { label: string; field: string; state: WorkspaceHook }) {
  return <th><button className="airline-sort" onClick={() => state.changeSort(field)}>{label} {state.sort === field ? state.direction === 'asc' ? '↑' : '↓' : '↕'}</button></th>
}

function WorkspaceState({ state }: { state: WorkspaceHook }) {
  if (state.invalidRange) return null
  if (state.loading) return <div className="airline-state" role="status">Đang tải dữ liệu hãng bay…</div>
  if (state.error) return <div className="airline-state" role="alert"><strong>Không thể tải dữ liệu</strong><p>{state.error}</p><button className="outline-button" onClick={state.refresh}>Thử lại</button></div>
  return null
}

function CreateFlightDialog({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [airports, setAirports] = useState<string[]>([])
  const [flightNumber, setFlightNumber] = useState('')
  const [departureCode, setDepartureCode] = useState('')
  const [arrivalCode, setArrivalCode] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getAirportCodes().then(setAirports).catch(() => setError('Không tải được danh sách sân bay.')) }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (departureCode === arrivalCode) { setError('Sân bay đi và đến phải khác nhau.'); return }
    const departure = new Date(departureTime)
    const arrival = new Date(arrivalTime)
    if (departure <= new Date() || arrival <= departure) { setError('Giờ đi phải ở tương lai và giờ đến phải sau giờ đi.'); return }
    setBusy(true); setError('')
    try { await createAirlineFlight({ flightNumber: flightNumber.trim(), departureCode, arrivalCode,
      departureTime: departure.toISOString(), arrivalTime: arrival.toISOString() }); onCreated() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo chuyến bay.') }
    finally { setBusy(false) }
  }
  return <div className="airline-modal-backdrop" onMouseDown={() => { if (!busy) onCancel() }}><form className="airline-modal" role="dialog" aria-modal="true" aria-labelledby="create-flight-title" onMouseDown={event => event.stopPropagation()} onSubmit={submit}>
    <span className="eyebrow">LỊCH BAY NỘI BỘ</span><h2 id="create-flight-title">Tạo chuyến bay</h2><p>Nhập lịch trình cơ bản. Phòng vé sẽ đặt số ghế mở bán và giá gốc sau.</p>
    <div className="airline-form-grid"><label>Số hiệu chuyến<input value={flightNumber} onChange={event => setFlightNumber(event.target.value.toUpperCase())} maxLength={20} placeholder="VN123" required disabled={busy} /></label>
      <label>Sân bay đi<select value={departureCode} onChange={event => setDepartureCode(event.target.value)} required disabled={busy}><option value="">Chọn sân bay</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Sân bay đến<select value={arrivalCode} onChange={event => setArrivalCode(event.target.value)} required disabled={busy}><option value="">Chọn sân bay</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Giờ khởi hành<input type="datetime-local" value={departureTime} onChange={event => setDepartureTime(event.target.value)} required disabled={busy} /></label>
      <label>Giờ đến<input type="datetime-local" value={arrivalTime} onChange={event => setArrivalTime(event.target.value)} required disabled={busy} /></label></div>
    <div className="airline-duration" aria-live="polite"><span>Thời gian bay dự kiến</span><strong>{flightDuration(departureTime, arrivalTime) ?? '—'}</strong><small>{departureTime && arrivalTime && !flightDuration(departureTime, arrivalTime) ? 'Giờ đến phải sau giờ khởi hành.' : 'Tự tính từ giờ khởi hành và giờ đến, kể cả chuyến qua ngày.'}</small></div>
    {error && <p className="airline-error" role="alert">{error}</p>}
    <div className="airline-modal-actions"><button type="button" className="outline-button" disabled={busy} onClick={onCancel}>Hủy</button><button className="primary-button" disabled={busy || !airports.length}>{busy ? 'Đang lưu…' : 'Tạo chuyến'}</button></div>
  </form></div>
}

export function FlightManagerPage() {
  const state = useWorkspace()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = state.data?.items.find(item => item.id === selectedId)
  return <div className="content airline-content"><div className="page-heading"><div><div className="eyebrow">ĐIỀU HÀNH CHUYẾN BAY</div><h1>Quản lý chuyến bay</h1><p>{state.data?.airline.name ?? 'Hãng bay'} · Lập lịch và theo dõi các chuyến nội bộ.</p></div><button className="primary-button" onClick={() => setShowCreate(true)}>+ Tạo chuyến bay</button></div>
    {notice && <div className="airline-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    <WorkspaceState state={state} />
    {state.data && <><div className="airline-summary-grid"><div><span>Chuyến phù hợp bộ lọc</span><strong>{state.data.summary.flights}</strong></div><div><span>Đang mở bán</span><strong>{state.data.summary.onSaleFlights}</strong></div><div><span>Chưa mở bán</span><strong>{state.data.summary.flights - state.data.summary.onSaleFlights}</strong></div></div>
      <section className="airline-card"><div className="airline-card-header"><div><h2>Danh sách chuyến bay</h2><p>Lọc, sắp xếp và phân trang tại server.</p></div><span>{state.data.pagination.total} chuyến</span></div><WorkspaceFilters state={state} />
        {state.data.items.length ? <div className="airline-table-scroll"><table><thead><tr><SortHeading label="CHUYẾN" field="flightNumber" state={state} /><th>TUYẾN</th><SortHeading label="KHỞI HÀNH" field="departureTime" state={state} /><SortHeading label="GHẾ BÁN RA" field="capacity" state={state} /><SortHeading label="TRẠNG THÁI" field="saleStatus" state={state} /><th /></tr></thead><tbody>{state.data.items.map(item => <tr key={item.id}><td><strong>{item.flightNumber}</strong></td><td>{item.departureCode} → {item.arrivalCode}</td><td>{date(item.departureTime)}</td><td>{item.capacity ? `${item.capacity} chỗ` : 'Chưa quy định'}</td><td><span className={`airline-status ${item.saleStatus === 'ON_SALE' ? 'is-live' : ''}`}>{status(item)}</span></td><td><button className="airline-row-button" onClick={() => setSelectedId(item.id)}>Chi tiết ›</button></td></tr>)}</tbody></table></div> : <div className="airline-empty">{Object.values(state.filters).some(Boolean) ? 'Không có chuyến phù hợp bộ lọc.' : 'Chưa có chuyến bay. Hãy tạo chuyến đầu tiên.'}</div>}
        <WorkspacePagination state={state} />
      </section></>}
    {selected && <div className="airline-panel-backdrop" onMouseDown={() => setSelectedId(null)}><aside className="airline-panel" role="dialog" aria-modal="true" aria-label={`Chuyến bay ${selected.flightNumber}`} onMouseDown={event => event.stopPropagation()}><div className="airline-panel-head"><div><span className="eyebrow">CHI TIẾT CHUYẾN BAY</span><h2>{selected.flightNumber}</h2></div><button onClick={() => setSelectedId(null)} aria-label="Đóng">×</button></div><div className="airline-panel-body"><dl><div><dt>Tuyến</dt><dd>{selected.departureCode} → {selected.arrivalCode}</dd></div><div><dt>Khởi hành</dt><dd>{date(selected.departureTime)}</dd></div><div><dt>Đến nơi</dt><dd>{date(selected.arrivalTime)}</dd></div><div><dt>Ghế mở bán</dt><dd>{selected.capacity || 'Chưa quy định'}</dd></div><div><dt>Đã xác nhận</dt><dd>{selected.confirmedSeats} chỗ</dd></div><div><dt>Đang giữ</dt><dd>{selected.heldSeats} chỗ</dd></div><div><dt>Còn khả dụng</dt><dd>{selected.availableSeats} chỗ</dd></div><div><dt>Mở bán</dt><dd>{status(selected)}</dd></div></dl><div className="airline-info-box">Số ghế mở bán, giá gốc và trạng thái bán do nhóm quản lý bán vé phụ trách.</div></div></aside></div>}
    {showCreate && <CreateFlightDialog onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setNotice('Đã tạo lịch chuyến. Phòng vé cần quy định số ghế và giá trước khi mở bán.'); state.refresh() }} />}
  </div>
}

export function SalesManagerPage({ awaitingOnly = false }: { awaitingOnly?: boolean }) {
  const state = useWorkspace(awaitingOnly ? awaitingSaleFilters : {})
  const [selected, setSelected] = useState<AirlineFlight | null>(null)
  const [capacity, setCapacity] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingSale, setPendingSale] = useState<'ON_SALE' | 'HIDDEN' | null>(null)
  useEffect(() => {
    if (!state.data) return
    setSelected(current => current ? state.data?.items.find(item => item.id === current.id) ?? current : null)
  }, [state.data])
  function select(item: AirlineFlight) { setSelected(item); setCapacity(item.capacity ? String(item.capacity) : ''); setBasePrice(item.basePrice ? String(item.basePrice) : ''); setActionError('') }
  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const seats = Number(capacity)
    const price = Number(basePrice)
    if (!Number.isSafeInteger(seats) || seats < 1 || seats > 10000 || !Number.isSafeInteger(price) || price < 1000 || price > 1_000_000_000) { setActionError('Số ghế phải từ 1–10.000 và giá gốc từ 1.000–1.000.000.000 VND.'); return }
    setBusy(true); setActionError('')
    try { await saveAirlineSalesSettings(selected.id, seats, price); setSelected({ ...selected, capacity: seats, basePrice: price, availableSeats: seats - selected.confirmedSeats - selected.heldSeats }); setNotice(`Đã lưu số ghế mở bán và giá gốc cho ${selected.flightNumber}.`); state.refresh() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Không thể lưu cấu hình bán vé.') }
    finally { setBusy(false) }
  }
  async function confirmSale() {
    if (!selected || !pendingSale) return
    setBusy(true); setActionError('')
    try { await updateAirlineSaleStatus(selected.id, pendingSale); setSelected({ ...selected, saleStatus: pendingSale }); setNotice(pendingSale === 'ON_SALE' ? `Đã mở bán ${selected.flightNumber}.` : `Đã ngừng nhận booking mới cho ${selected.flightNumber}.`); setPendingSale(null); state.refresh() }
    catch (cause) { setPendingSale(null); setActionError(cause instanceof Error ? cause.message : 'Không thể thay đổi trạng thái bán.') }
    finally { setBusy(false) }
  }
  return <div className="content airline-content"><div className="page-heading"><div><div className="eyebrow">QUẢN LÝ BÁN VÉ</div><h1>{awaitingOnly ? 'Chờ mở bán' : 'Quản lý bán vé'}</h1><p>{awaitingOnly ? 'Chuyến sắp bay chưa công bố vé. Thiết lập số ghế và giá gốc, sau đó mở bán.' : `${state.data?.airline.name ?? 'Hãng bay'} · Quản lý số ghế, giá gốc và trạng thái mở bán từng chuyến.`}</p></div></div>
    {notice && <div className="airline-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    <WorkspaceState state={state} />
    {state.data && <><section className="airline-card"><div className="airline-card-header"><div><h2>{awaitingOnly ? 'Danh sách chờ mở bán' : 'Danh sách quản lý vé'}</h2><p>{awaitingOnly ? 'Chọn chuyến để thiết lập vé hoặc mở bán.' : 'Chọn chuyến để sửa số ghế, giá gốc hoặc trạng thái bán.'}</p></div><span>{state.data.pagination.total} chuyến</span></div><WorkspaceFilters state={state} awaitingOnly={awaitingOnly} />
        {state.data.items.length ? awaitingOnly ? <div className="airline-awaiting-list">{state.data.items.map(item => <div className="airline-awaiting-item" key={item.id}><div><strong>{item.flightNumber}</strong><span>{item.departureCode} → {item.arrivalCode}</span></div><div><span>Khởi hành</span><strong>{date(item.departureTime)}</strong></div><div><span>Chuẩn bị bán vé</span><strong>{item.capacity && item.basePrice ? 'Đã có ghế và giá gốc' : 'Cần thiết lập ghế và giá gốc'}</strong></div><button className="primary-button" onClick={() => select(item)}>{item.capacity && item.basePrice ? 'Xem & mở bán' : 'Thiết lập bán vé'}</button></div>)}</div> : <div className="airline-table-scroll"><table><thead><tr><SortHeading label="CHUYẾN" field="flightNumber" state={state} /><th>TUYẾN</th><SortHeading label="KHỞI HÀNH" field="departureTime" state={state} /><SortHeading label="GHẾ BÁN RA" field="capacity" state={state} /><SortHeading label="GIÁ GỐC" field="basePrice" state={state} /><th>GIÁ HIỆN TẠI</th><SortHeading label="TRẠNG THÁI BÁN" field="saleStatus" state={state} /><th /></tr></thead><tbody>{state.data.items.map(item => <tr key={item.id}><td><strong>{item.flightNumber}</strong></td><td>{item.departureCode} → {item.arrivalCode}</td><td>{date(item.departureTime)}</td><td>{item.capacity ? `${item.capacity} chỗ` : 'Chưa thiết lập'}</td><td>{money(item.basePrice || null)}</td><td>{money(item.currentPrice)}</td><td><span className={`airline-status ${item.saleStatus === 'ON_SALE' ? 'is-live' : ''}`}>{status(item)}</span></td><td><button className="airline-row-button" onClick={() => select(item)}>Quản lý ›</button></td></tr>)}</tbody></table></div> : <div className="airline-empty">{awaitingOnly ? Object.entries(state.filters).some(([key, value]) => key !== 'salesStage' && value) ? 'Không có chuyến chờ mở bán phù hợp bộ lọc.' : 'Không có chuyến nào đang chờ mở bán.' : Object.values(state.filters).some(Boolean) ? 'Không có chuyến phù hợp bộ lọc.' : 'Hãng chưa có chuyến bay để bán.'}</div>}
        <WorkspacePagination state={state} />
      </section></>}
    {selected && <div className="airline-panel-backdrop" onMouseDown={() => { if (!busy) setSelected(null) }}><aside className="airline-panel airline-sales-panel" role="dialog" aria-modal="true" aria-label={`Bán vé chuyến ${selected.flightNumber}`} onMouseDown={event => event.stopPropagation()}><div className="airline-panel-head"><div><span className="eyebrow">QUẢN LÝ BÁN VÉ</span><h2>{selected.flightNumber}</h2><p>{selected.departureCode} → {selected.arrivalCode} · {date(selected.departureTime)}</p></div><button disabled={busy} onClick={() => setSelected(null)} aria-label="Đóng">×</button></div><div className="airline-panel-body">
      <form className="airline-pricing-form" onSubmit={saveSettings}><h3>Cấu hình bán vé</h3><p>Nhập số ghế bán ra và giá gốc. Giá khách trả được backend tự tính; giá booking đã tạo không đổi.</p><label>Số ghế bán ra<input type="number" min="1" max="10000" step="1" value={capacity} onChange={event => setCapacity(event.target.value)} required disabled={busy || selected.status !== 'SCHEDULED' || new Date(selected.departureTime) <= new Date()} /></label><label>Giá gốc (VND)<input type="number" min="1000" max="1000000000" step="1000" value={basePrice} onChange={event => setBasePrice(event.target.value)} required disabled={busy || selected.status !== 'SCHEDULED' || new Date(selected.departureTime) <= new Date()} /></label><button className="primary-button" disabled={busy || selected.status !== 'SCHEDULED' || new Date(selected.departureTime) <= new Date()}>{busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button></form>
      <section className="airline-sale-control"><h3>Trạng thái bán</h3><p>{selected.saleStatus === 'ON_SALE' ? 'Khách đang thấy và có thể đặt chuyến này.' : 'Khách chưa thể đặt chuyến này.'}</p><button className={selected.saleStatus === 'ON_SALE' ? 'outline-button' : 'primary-button'} disabled={busy || selected.status !== 'SCHEDULED' || new Date(selected.departureTime) <= new Date() || (selected.saleStatus === 'HIDDEN' && (!selected.capacity || !selected.basePrice))} onClick={() => setPendingSale(selected.saleStatus === 'ON_SALE' ? 'HIDDEN' : 'ON_SALE')}>{selected.saleStatus === 'ON_SALE' ? 'Ngừng bán' : 'Mở bán chuyến'}</button>{selected.saleStatus === 'HIDDEN' && (!selected.capacity || !selected.basePrice) && <small>Hãy lưu số ghế và giá gốc trước khi mở bán.</small>}</section>
      {actionError && <p className="airline-error" role="alert">{actionError}</p>}</div></aside></div>}
    {selected && pendingSale && <div className="airline-modal-backdrop"><div className="airline-modal airline-confirm" role="dialog" aria-modal="true" aria-labelledby="sale-confirm-title"><span className="eyebrow">XÁC NHẬN BÁN VÉ</span><h2 id="sale-confirm-title">{pendingSale === 'ON_SALE' ? 'Mở bán chuyến?' : 'Ngừng bán chuyến?'}</h2><p>{pendingSale === 'ON_SALE' ? `Khách sẽ nhìn thấy và có thể đặt ${selected.flightNumber} theo giá hệ thống tính từ giá gốc ${money(selected.basePrice)}.` : `Chuyến ${selected.flightNumber} sẽ ngừng nhận booking mới. ${selected.confirmedBookings} booking đã xác nhận và ${selected.heldSeats} chỗ đang giữ vẫn được giữ nguyên.`}</p><div className="airline-modal-actions"><button className="outline-button" disabled={busy} onClick={() => setPendingSale(null)}>Quay lại</button><button className="primary-button" disabled={busy} onClick={confirmSale}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button></div></div></div>}
  </div>
}

