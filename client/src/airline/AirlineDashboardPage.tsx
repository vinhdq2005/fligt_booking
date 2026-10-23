import { useEffect, useMemo, useState } from 'react'
import { getAirportCodes } from '../api'
import { displayStatus, formatDateTime } from '../admin/previewCatalog'
import { getAirlineDashboard, type AirlineDashboard, type DashboardMetric, type DashboardPoint } from './airlineApi'

type Metric = keyof DashboardMetric
type Group = 'day' | 'week' | 'month'
type Mode = 'airline' | 'flight'

const metricLabels: Record<Metric, string> = { ticketsSold: 'Vé đã bán', paidBookings: 'Lượt đã thanh toán', revenue: 'Doanh thu mô phỏng' }
const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const emptyFilters = { fromDate: '', toDate: '', departureCode: '', arrivalCode: '', flightNumber: '', status: '', saleStatus: '' }

function groupDate(date: string, group: Group) {
  if (group === 'month') return date.slice(0, 7)
  if (group === 'day') return date
  const monday = new Date(`${date}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function groupPoints(points: DashboardPoint[], group: Group): DashboardPoint[] {
  const grouped = new Map<string, DashboardPoint>()
  for (const point of points) {
    const date = groupDate(point.date, group)
    const current = grouped.get(date) ?? { date, ticketsSold: 0, paidBookings: 0, revenue: 0 }
    current.ticketsSold += point.ticketsSold
    current.paidBookings += point.paidBookings
    current.revenue += point.revenue
    grouped.set(date, current)
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function valueLabel(value: number, metric: Metric) { return metric === 'revenue' ? money(value) : number(value) }

function MetricCards({ metrics, occupancyPercent, flights }: { metrics: DashboardMetric; occupancyPercent: number; flights?: number }) {
  return <div className="airline-summary-grid dashboard-kpis">
    {flights !== undefined && <div><span>Chuyến phù hợp bộ lọc</span><strong>{number(flights)}</strong></div>}
    <div><span>Vé đã bán</span><strong>{number(metrics.ticketsSold)}</strong><small>Vé đã phát hành, còn hiệu lực</small></div>
    <div><span>Lượt đã thanh toán</span><strong>{number(metrics.paidBookings)}</strong><small>Số booking thanh toán thành công</small></div>
    <div><span>Doanh thu mô phỏng</span><strong>{money(metrics.revenue)}</strong><small>Thanh toán thử thành công</small></div>
    <div><span>Tỷ lệ lấp đầy</span><strong>{occupancyPercent}%</strong><small>Vé đã bán / ghế mở bán</small></div>
  </div>
}

function TrendChart({ points, metric, group, title }: { points: DashboardPoint[]; metric: Metric; group: Group; title: string }) {
  const grouped = groupPoints(points, group)
  const maximum = Math.max(1, ...grouped.map(point => point[metric]))
  return <section className="airline-card dashboard-chart-card"><div className="airline-card-header"><div><h2>{title}</h2><p>{metricLabels[metric]} · Nhóm theo {group === 'day' ? 'ngày' : group === 'week' ? 'tuần' : 'tháng'}.</p></div></div>
    {grouped.length ? <div className="dashboard-chart-scroll"><div className="dashboard-bars" role="img" aria-label={`${title}: ${grouped.map(point => `${point.date} ${valueLabel(point[metric], metric)}`).join(', ')}`}>
      {grouped.map(point => <div className="dashboard-bar-item" key={point.date} title={`${point.date}: ${valueLabel(point[metric], metric)}`}><span>{valueLabel(point[metric], metric)}</span><div className="dashboard-bar-track"><i style={{ height: `${point[metric] ? Math.max(4, point[metric] / maximum * 100) : 0}%` }} /></div><small>{point.date}</small></div>)}
    </div></div> : <div className="airline-empty">Chưa có dữ liệu để vẽ biểu đồ.</div>}
  </section>
}

export default function AirlineDashboardPage() {
  const [mode, setMode] = useState<Mode>('airline')
  const [filters, setFilters] = useState(emptyFilters)
  const [airports, setAirports] = useState<string[]>([])
  const [data, setData] = useState<AirlineDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [metric, setMetric] = useState<Metric>('revenue')
  const [group, setGroup] = useState<Group>('month')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const invalidRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
  const filterKey = JSON.stringify(filters)
  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()) })
    return params
  }, [filterKey])
  useEffect(() => { getAirportCodes().then(setAirports).catch(() => {}) }, [])
  useEffect(() => {
    if (selectedId === null) return
    const frame = window.requestAnimationFrame(() => document.getElementById('dashboard-flight-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [selectedId])
  useEffect(() => {
    if (invalidRange) { setLoading(false); return }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      getAirlineDashboard(query).then(result => { if (active) { setData(result); setError(''); setPage(1) } })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Dashboard.') })
        .finally(() => { if (active) setLoading(false) })
    }, filters.flightNumber ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, version, invalidRange])
  const change = (key: keyof typeof emptyFilters, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const selected = data?.flights.find(flight => flight.id === selectedId) ?? null
  const visibleFlights = data?.flights.slice((page - 1) * 10, page * 10) ?? []
  const pageCount = Math.max(1, Math.ceil((data?.flights.length ?? 0) / 10))
  return <div className="content airline-content dashboard-page"><div className="page-heading"><div><div className="eyebrow">KINH DOANH HÃNG BAY</div><h1>Dashboard bán vé</h1><p>Phân tích toàn hãng hoặc từng chuyến. Dữ liệu thanh toán là mô phỏng.</p></div></div>
    <div className="dashboard-tabs" role="tablist" aria-label="Phạm vi phân tích"><button role="tab" aria-selected={mode === 'airline'} className={mode === 'airline' ? 'is-active' : ''} onClick={() => setMode('airline')}>Toàn hãng</button><button role="tab" aria-selected={mode === 'flight'} className={mode === 'flight' ? 'is-active' : ''} onClick={() => setMode('flight')}>Theo chuyến</button></div>
    <section className="airline-card dashboard-filter-card"><div className="airline-card-header"><div><h2>Bộ lọc Dashboard</h2><p>Khoảng thời gian tính theo ngày khởi hành tại Việt Nam. Các chỉ số dùng toàn bộ chuyến phù hợp bộ lọc.</p></div></div><div className="airline-filters">
      <label>Từ ngày bay<input type="date" value={filters.fromDate} onChange={event => change('fromDate', event.target.value)} /></label>
      <label>Đến ngày bay<input type="date" value={filters.toDate} onChange={event => change('toDate', event.target.value)} /></label>
      <label>Sân bay đi<select value={filters.departureCode} onChange={event => change('departureCode', event.target.value)}><option value="">Tất cả</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Sân bay đến<select value={filters.arrivalCode} onChange={event => change('arrivalCode', event.target.value)}><option value="">Tất cả</option>{airports.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Số hiệu chuyến<input type="search" placeholder="Ví dụ VN123" value={filters.flightNumber} onChange={event => change('flightNumber', event.target.value.toUpperCase())} /></label>
      <label>Trạng thái chuyến<select value={filters.status} onChange={event => change('status', event.target.value)}><option value="">Tất cả</option>{['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'].map(value => <option key={value} value={value}>{displayStatus(value)}</option>)}</select></label>
      <label>Trạng thái bán<select value={filters.saleStatus} onChange={event => change('saleStatus', event.target.value)}><option value="">Tất cả</option><option value="ON_SALE">Đang bán</option><option value="HIDDEN">Chưa mở bán</option></select></label>
      <button className="outline-button" onClick={() => setFilters(emptyFilters)}>Xóa lọc</button>
    </div>{invalidRange && <p className="airline-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}</section>
    {loading && <div className="airline-state" role="status">Đang tải số liệu Dashboard…</div>}
    {!loading && error && <div className="airline-state" role="alert">{error} <button className="outline-button" onClick={() => setVersion(value => value + 1)}>Thử lại</button></div>}
    {!loading && !error && !invalidRange && data && <>
      {mode === 'airline' ? <>
        <MetricCards metrics={data.summary} occupancyPercent={data.summary.occupancyPercent} flights={data.summary.flights} />
        <div className="dashboard-chart-controls"><label>Chỉ số trên biểu đồ<select value={metric} onChange={event => setMetric(event.target.value as Metric)}>{(Object.keys(metricLabels) as Metric[]).map(value => <option value={value} key={value}>{metricLabels[value]}</option>)}</select></label><label>Nhóm thời gian<select value={group} onChange={event => setGroup(event.target.value as Group)}><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label></div>
        <TrendChart points={data.departureSeries} metric={metric} group={group} title="Xu hướng theo ngày bay" />
        <section className="airline-card dashboard-routes"><div className="airline-card-header"><div><h2>So sánh tuyến bay</h2><p>8 tuyến dẫn đầu theo {metricLabels[metric].toLowerCase()} trong bộ lọc.</p></div></div>{data.routes.length ? <div className="dashboard-route-list">{[...data.routes].sort((a, b) => b[metric] - a[metric]).slice(0, 8).map(route => <div key={`${route.departureCode}-${route.arrivalCode}`}><span>{route.departureCode} → {route.arrivalCode}</span><div><i style={{ width: `${route[metric] / Math.max(1, ...data.routes.map(item => item[metric])) * 100}%` }} /></div><strong>{valueLabel(route[metric], metric)}</strong></div>)}</div> : <div className="airline-empty">Chưa có tuyến bay phù hợp.</div>}</section>
      </> : <>
        <section className="airline-card dashboard-flight-list"><div className="airline-card-header"><div><h2>Chọn chuyến để phân tích</h2><p>{data.flights.length} chuyến phù hợp bộ lọc Dashboard.</p></div></div>{visibleFlights.length ? <div className="airline-table-scroll"><table><thead><tr><th>CHUYẾN</th><th>NGÀY BAY</th><th>VÉ ĐÃ BÁN</th><th>LƯỢT THANH TOÁN</th><th>DOANH THU MÔ PHỎNG</th><th>LẤP ĐẦY</th><th /></tr></thead><tbody>{visibleFlights.map(flight => <tr key={flight.id}><td><strong>{flight.flightNumber}</strong><small>{flight.departureCode} → {flight.arrivalCode}</small></td><td>{formatDateTime(flight.departureTime)}</td><td>{number(flight.ticketsSold)}</td><td>{number(flight.paidBookings)}</td><td>{money(flight.revenue)}</td><td>{flight.occupancyPercent}%</td><td><button className="airline-row-button" onClick={() => setSelectedId(flight.id)}>Phân tích ›</button></td></tr>)}</tbody></table></div> : <div className="airline-empty">Không có chuyến phù hợp bộ lọc.</div>}{pageCount > 1 && <div className="airline-pagination"><span>Trang {page}/{pageCount}</span><div><button disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước">‹</button><button disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Trang sau">›</button></div></div>}</section>
        {selected && <><div className="dashboard-flight-heading" id="dashboard-flight-detail"><div><span className="eyebrow">PHÂN TÍCH CHUYẾN</span><h2>{selected.flightNumber} · {selected.departureCode} → {selected.arrivalCode}</h2><p>Khởi hành {formatDateTime(selected.departureTime)} · {number(selected.capacity)} ghế mở bán</p></div><button className="outline-button" onClick={() => setSelectedId(null)}>Đóng chi tiết</button></div><MetricCards metrics={selected} occupancyPercent={selected.occupancyPercent} /><div className="dashboard-chart-controls"><label>Chỉ số trên biểu đồ<select value={metric} onChange={event => setMetric(event.target.value as Metric)}>{(Object.keys(metricLabels) as Metric[]).map(value => <option value={value} key={value}>{metricLabels[value]}</option>)}</select></label><label>Nhóm thời gian<select value={group} onChange={event => setGroup(event.target.value as Group)}><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label></div><TrendChart points={data.salesSeriesByFlight[String(selected.id)] ?? []} metric={metric} group={group} title="Diễn biến bán vé theo ngày thanh toán" /></>}
      </>}
    </>}
  </div>
}
