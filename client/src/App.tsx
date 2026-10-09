import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  getFlights,
  getImportStatus,
  importFlights,
  type Flight,
  type FlightList,
  type ImportForm,
  type ImportStatus,
} from "./api";

type IconName = "plane" | "grid" | "database" | "search" | "plus" | "close" | "chevron" | "calendar" | "refresh" | "arrow" | "clock" | "info";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    plane: <><path d="m3 12 18-8-5 17-4-7-9-2Z" /><path d="m12 14 9-10" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 12.3-3" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const airportNames: Record<string, string> = {
  HAN: "Hà Nội", SGN: "TP. Hồ Chí Minh", DAD: "Đà Nẵng", CXR: "Nha Trang",
  PQC: "Phú Quốc", HUI: "Huế", DLI: "Đà Lạt", VCA: "Cần Thơ",
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const timeFormatter = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
const moneyFormatter = new Intl.NumberFormat("vi-VN");

function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} giờ ${remainder ? `${remainder} phút` : ""}`.trim() : `${remainder} phút`;
}

function flightLabel(flight: Flight) {
  return flight.segments.map((segment) => segment.flightNumber).join(" · ") || `Lựa chọn #${flight.id}`;
}

function StatusBadge({ status }: { status: Flight["status"] }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{status === "fresh" ? "Còn hạn" : "Hết hạn"}</span>;
}

type Filters = { from: string; to: string; date: string; status: "all" | "fresh" | "expired"; page: number };
const initialFilters: Filters = { from: "", to: "", date: "", status: "all", page: 1 };

function FlightDetails({ flight, onClose }: { flight: Flight; onClose: () => void }) {
  return <div className="overlay" onMouseDown={onClose}>
    <aside className="details-panel" role="dialog" aria-modal="true" aria-label="Chi tiết chuyến bay" onMouseDown={(event) => event.stopPropagation()}>
      <div className="panel-header">
        <div><span className="eyebrow">CHI TIẾT LỰA CHỌN</span><h2>{flightLabel(flight)}</h2></div>
        <button className="icon-button" aria-label="Đóng chi tiết" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="panel-body">
        <div className="route-hero">
          <div><strong>{flight.departureCode}</strong><span>{airportNames[flight.departureCode] || "Điểm đi"}</span></div>
          <div className="route-hero-line"><Icon name="plane" size={20} /><small>{flight.segments.length > 1 ? `${flight.segments.length} chặng` : "Bay thẳng"}</small></div>
          <div><strong>{flight.arrivalCode}</strong><span>{airportNames[flight.arrivalCode] || "Điểm đến"}</span></div>
        </div>

        <div className="detail-facts">
          <div><span>Ngày bay</span><strong>{dateFormatter.format(new Date(flight.outboundDate))}</strong></div>
          <div><span>Thời lượng</span><strong>{formatDuration(flight.totalDurationMinutes)}</strong></div>
          <div><span>Giá tham khảo</span><strong>{moneyFormatter.format(flight.price)} {flight.currency}</strong></div>
          <div><span>Trạng thái dữ liệu</span><StatusBadge status={flight.status} /></div>
        </div>

        <h3 className="section-heading">Các chặng bay</h3>
        <div className="segment-list">
          {flight.segments.map((segment, index) => <div className="segment-card" key={segment.id}>
            <div className="segment-card-top"><span>CHẶNG {index + 1}</span><strong>{segment.airlineName}</strong></div>
            <div className="segment-flight-number">{segment.flightNumber}</div>
            <div className="segment-route">
              <div><strong>{timeFormatter.format(new Date(segment.departureTime))}</strong><span>{segment.departureCode}</span></div>
              <div className="segment-line"><Icon name="arrow" size={18} /><small>{formatDuration(segment.durationMinutes)}</small></div>
              <div><strong>{timeFormatter.format(new Date(segment.arrivalTime))}</strong><span>{segment.arrivalCode}</span></div>
            </div>
            <div className="segment-date">{dateTimeFormatter.format(new Date(segment.departureTime))} → {dateTimeFormatter.format(new Date(segment.arrivalTime))}</div>
          </div>)}
        </div>

        <div className="source-note"><Icon name="info" size={18} /><span>Dữ liệu tham khảo từ SerpApi, cập nhật lúc {dateTimeFormatter.format(new Date(flight.fetchedAt))}. Đây chưa phải chuyến bay có tồn chỗ để đặt trên hệ thống.</span></div>
        <div className="detail-id">Mã lựa chọn #{flight.id} · Mã lượt tìm #{flight.searchId}</div>
      </div>
    </aside>
  </div>;
}

function ImportDialog({ initial, onClose, onImported }: {
  initial: Filters;
  onClose: () => void;
  onImported: () => void;
}) {
  const [form, setForm] = useState<ImportForm>({ departureCode: initial.from || "HAN", arrivalCode: initial.to || "SGN", date: initial.date });
  const [preview, setPreview] = useState<ImportStatus | null>(null);
  const [busy, setBusy] = useState<"checking" | "importing" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function change(key: keyof ImportForm, value: string) {
    setForm((current) => ({ ...current, [key]: key === "date" ? value : value.toUpperCase().slice(0, 3) }));
    setPreview(null);
    setError("");
    setSuccess("");
  }

  async function check() {
    if (!/^[A-Z]{3}$/.test(form.departureCode) || !/^[A-Z]{3}$/.test(form.arrivalCode) ||
        form.departureCode === form.arrivalCode || !form.date) {
      setError("Nhập hai mã sân bay khác nhau (3 chữ cái) và chọn ngày bay.");
      return;
    }
    setBusy("checking");
    setError("");
    setSuccess("");
    try {
      setPreview(await getImportStatus(form));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không kiểm tra được dữ liệu.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmImport() {
    setBusy("importing");
    setError("");
    try {
      const result = await importFlights(form);
      setSuccess(result.status === "already_fresh"
        ? `Dữ liệu đã còn hạn (lượt tìm #${result.searchId}); không gọi SerpApi.`
        : `Đã nhập ${result.offerCount} lựa chọn chuyến bay (lượt tìm #${result.searchId}).`);
      setPreview({ status: "fresh", latestId: result.searchId });
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được dữ liệu.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="overlay modal-overlay" onMouseDown={onClose}>
    <div className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading">
        <div className="modal-icon"><Icon name="database" size={22} /></div>
        <button className="icon-button" aria-label="Đóng" onClick={onClose}><Icon name="close" /></button>
      </div>
      <h2 id="import-title">Nhập dữ liệu chuyến bay</h2>
      <p className="muted modal-intro">Kiểm tra dữ liệu đã lưu trước. SerpApi chỉ được gọi khi dữ liệu thiếu hoặc hết hạn và bạn xác nhận.</p>
      <div className="import-form">
        <label>Mã sân bay đi<input value={form.departureCode} onChange={(event) => change("departureCode", event.target.value)} placeholder="HAN" maxLength={3} /></label>
        <label>Mã sân bay đến<input value={form.arrivalCode} onChange={(event) => change("arrivalCode", event.target.value)} placeholder="SGN" maxLength={3} /></label>
        <label className="wide-field">Ngày bay<input type="date" value={form.date} onChange={(event) => change("date", event.target.value)} /></label>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice notice-success" role="status">{success}</div>}
      {preview?.status === "fresh" && !success && <div className="notice notice-success">Đã có dữ liệu còn hạn (lượt tìm #{preview.latestId}). Không cần gọi SerpApi.</div>}
      {(preview?.status === "missing" || preview?.status === "expired") && <div className="confirm-box">
        <div><Icon name="info" size={20} /><strong>{preview.status === "missing" ? "Chưa có dữ liệu" : "Dữ liệu đã hết hạn"}</strong></div>
        <p>Gọi SerpApi cho {form.departureCode} → {form.arrivalCode} ngày {dateFormatter.format(new Date(`${form.date}T00:00:00Z`))} và lưu kết quả mới vào database?</p>
        <button className="primary-button" disabled={busy !== null} onClick={confirmImport}>{busy === "importing" ? "Đang nhập…" : "Xác nhận gọi SerpApi"}</button>
      </div>}
      <div className="modal-actions">
        <button className="text-button" onClick={onClose}>{success ? "Đóng" : "Hủy"}</button>
        {!success && <button className="primary-button" disabled={busy !== null} onClick={check}>{busy === "checking" ? "Đang kiểm tra…" : "Kiểm tra dữ liệu"}</button>}
      </div>
    </div>
  </div>;
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [result, setResult] = useState<FlightList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Flight | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getFlights(applied).then((data) => {
      if (active) setResult(data);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được chuyến bay.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [applied, refreshKey]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setApplied({ ...filters, from: filters.from.toUpperCase(), to: filters.to.toUpperCase(), page: 1 });
  }

  function resetFilters() {
    setFilters(initialFilters);
    setApplied(initialFilters);
  }

  function changePage(page: number) {
    setApplied((current) => ({ ...current, page }));
  }

  return <div className="app-canvas">
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-symbol"><Icon name="plane" size={21} /></div><span>Flight<span>Booking</span></span></div>
        <div className="sidebar-main">
          <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
          <div className="nav-item nav-muted"><Icon name="grid" size={18} />Tổng quan</div>
          <div className="nav-label nav-label-modules">QUẢN LÝ DỮ LIỆU</div>
          <div className="nav-item nav-active"><Icon name="plane" size={18} />Chuyến bay<span className="nav-active-indicator" /></div>
          <button className="nav-item nav-button" onClick={() => setShowImport(true)}><Icon name="database" size={18} />Nhập dữ liệu</button>
          <div className="sidebar-tip"><div className="tip-icon"><Icon name="info" size={18} /></div><strong>Dữ liệu tham khảo</strong><p>Giá và lịch bay được lưu từ SerpApi. Chưa có tồn chỗ để đặt vé.</p></div>
        </div>
        <div className="sidebar-footer"><div className="avatar">QT</div><div><strong>Quản trị viên</strong><span>Không gian nội bộ</span></div></div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="breadcrumbs">Quản lý dữ liệu <Icon name="chevron" size={14} /> <strong>Chuyến bay</strong></div><div className="topbar-right"><span className="topbar-indicator" />Hệ thống quản trị</div></header>
        <main className="content">
          <div className="page-heading"><div><div className="eyebrow">FLIGHT MANAGEMENT</div><h1>Danh sách chuyến bay</h1><p>Quản lý các lựa chọn chuyến bay đã lưu từ nguồn dữ liệu tham khảo.</p></div><button className="primary-button add-button" onClick={() => setShowImport(true)}><Icon name="plus" size={18} />Nhập dữ liệu mới</button></div>

          <div className="summary-grid">
            <div className="summary-card"><span>Tổng lựa chọn</span><strong>{result?.summary.total ?? "—"}</strong><small>Trong dữ liệu đã lưu</small><div className="summary-card-icon blue"><Icon name="plane" size={20} /></div></div>
            <div className="summary-card"><span>Dữ liệu còn hạn</span><strong>{result?.summary.fresh ?? "—"}</strong><small>Có thể hiển thị tham khảo</small><div className="summary-card-icon green"><Icon name="clock" size={20} /></div></div>
            <div className="summary-card"><span>Dữ liệu hết hạn</span><strong>{result?.summary.expired ?? "—"}</strong><small>Có thể nhập lại từ SerpApi</small><div className="summary-card-icon amber"><Icon name="refresh" size={20} /></div></div>
          </div>

          <section className="list-card" aria-label="Danh sách chuyến bay">
            <div className="list-card-header"><div><h2>Tất cả chuyến bay</h2><p>Giá hiển thị là giá tham khảo tại thời điểm nhập dữ liệu.</p></div><button className="outline-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><Icon name="refresh" size={16} />Làm mới</button></div>
            <form className="filters" onSubmit={applyFilters}>
              <label><span>TỪ</span><input aria-label="Sân bay đi" placeholder="Mã sân bay" value={filters.from} maxLength={3} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value.toUpperCase() }))} /></label>
              <label><span>ĐẾN</span><input aria-label="Sân bay đến" placeholder="Mã sân bay" value={filters.to} maxLength={3} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value.toUpperCase() }))} /></label>
              <label className="date-filter"><span>NGÀY BAY</span><input aria-label="Ngày bay" type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} /></label>
              <label className="status-filter"><span>TRẠNG THÁI</span><select aria-label="Trạng thái dữ liệu" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Filters["status"] }))}><option value="all">Tất cả</option><option value="fresh">Còn hạn</option><option value="expired">Hết hạn</option></select></label>
              <button className="filter-button" type="submit"><Icon name="search" size={16} />Lọc</button>
              <button className="reset-button" type="button" onClick={resetFilters}>Xóa lọc</button>
            </form>

            {error && <div className="list-error" role="alert"><Icon name="info" />{error}<button onClick={() => setRefreshKey((key) => key + 1)}>Thử lại</button></div>}
            <div className="table-scroll"><table className="flight-table"><thead><tr><th>CHUYẾN BAY</th><th>HÀNH TRÌNH</th><th>KHỞI HÀNH</th><th>THỜI LƯỢNG</th><th>GIÁ THAM KHẢO</th><th>DỮ LIỆU</th><th>CẬP NHẬT</th><th aria-label="Thao tác" /></tr></thead><tbody>
              {!loading && result?.items.map((flight) => {
                const first = flight.segments[0];
                return <tr key={flight.id}><td><div className="flight-cell"><span className="flight-cell-icon"><Icon name="plane" size={17} /></span><div><strong>{flightLabel(flight)}</strong><small>{first?.airlineName || "Chưa rõ hãng bay"}</small></div></div></td><td><div className="route-cell"><strong>{flight.departureCode}</strong><span>→</span><strong>{flight.arrivalCode}</strong></div><small className="cell-subtitle">{flight.segments.length > 1 ? `${flight.segments.length} chặng` : "Bay thẳng"}</small></td><td><strong className="normal-weight">{first ? timeFormatter.format(new Date(first.departureTime)) : "—"}</strong><small className="cell-subtitle">{dateFormatter.format(new Date(flight.outboundDate))}</small></td><td className="normal-cell">{formatDuration(flight.totalDurationMinutes)}</td><td><strong className="price-cell">{moneyFormatter.format(flight.price)} ₫</strong></td><td><StatusBadge status={flight.status} /></td><td className="normal-cell">{dateFormatter.format(new Date(flight.fetchedAt))}</td><td><button className="row-action" onClick={() => setSelected(flight)}>Chi tiết <Icon name="chevron" size={15} /></button></td></tr>;
              })}
            </tbody></table></div>
            {loading && <div className="empty-state"><div className="loading-spinner" /><strong>Đang tải danh sách chuyến bay…</strong></div>}
            {!loading && !error && result?.items.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="plane" size={26} /></div><strong>Chưa có chuyến bay phù hợp</strong><p>Thử đổi bộ lọc hoặc nhập dữ liệu mới cho tuyến bạn cần.</p><button className="outline-button" onClick={() => setShowImport(true)}><Icon name="plus" size={16} />Nhập dữ liệu</button></div>}
            {!loading && result && result.pagination.total > 0 && <div className="table-footer"><span>Hiển thị {(result.pagination.page - 1) * result.pagination.pageSize + 1}–{Math.min(result.pagination.page * result.pagination.pageSize, result.pagination.total)} trong {result.pagination.total} lựa chọn</span><div className="pagination"><button disabled={result.pagination.page <= 1} onClick={() => changePage(result.pagination.page - 1)} aria-label="Trang trước">‹</button><span>Trang {result.pagination.page} / {result.pagination.pageCount}</span><button disabled={result.pagination.page >= result.pagination.pageCount} onClick={() => changePage(result.pagination.page + 1)} aria-label="Trang sau">›</button></div></div>}
          </section>
          <div className="page-footnote"><Icon name="info" size={16} />Dữ liệu này chỉ dùng để tham khảo. Chỗ ngồi và đặt vé chưa được quản lý trong bảng chuyến bay hiện tại.</div>
        </main>
      </div>
    </div>
    {selected && <FlightDetails flight={selected} onClose={() => setSelected(null)} />}
    {showImport && <ImportDialog initial={filters} onClose={() => setShowImport(false)} onImported={() => { setApplied({ ...initialFilters }); setFilters(initialFilters); setRefreshKey((key) => key + 1); }} />}
  </div>;
}
