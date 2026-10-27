import { useEffect, useRef, useState } from 'react'
import { getFlightCalendarPrices } from '../api'
import '../styles/price-date-picker.css'

type TripType = 'one-way' | 'round-trip'

type Props = {
  tripType: TripType
  from: string
  to: string
  date: string
  returnDate: string
  passengers: number
  airline?: string
  onChange: (date: string, returnDate: string) => void
  variant?: 'home' | 'editor'
}

const weekdays = ['CN', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7']

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function monthStart(date: string) {
  const [year, month] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1))
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shortDate(date: string) {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function priceLabel(price: number) {
  return `${Math.round(price / 1000).toLocaleString('vi-VN')}k`
}

export default function PriceDatePicker({
  tripType, from, to, date, returnDate, passengers, airline, onChange, variant = 'home',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'outbound' | 'inbound'>('outbound')
  const [firstMonth, setFirstMonth] = useState(() => monthStart(date && date >= todayInVietnam() ? date : todayInVietnam()))
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const minDate = todayInVietnam()
  const activeFrom = phase === 'inbound' ? to : from
  const activeTo = phase === 'inbound' ? from : to

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!/^[A-Z]{3}$/.test(activeFrom) || !/^[A-Z]{3}$/.test(activeTo) ||
        activeFrom === activeTo || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
      setPrices({})
      setError('Chọn điểm đi, điểm đến và số hành khách để xem giá.')
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    setPrices({})
    void getFlightCalendarPrices({
      from: activeFrom,
      to: activeTo,
      start: dateKey(firstMonth),
      end: dateKey(addMonths(firstMonth, 2)),
      passengers,
      airline,
    }).then(result => {
      if (active) setPrices(Object.fromEntries(result.items.map(item => [item.date, item.price])))
    }).catch(() => {
      if (active) setError('Chưa tải được giá vé. Vui lòng thử lại.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [open, activeFrom, activeTo, firstMonth, passengers, airline])

  function openCalendar() {
    setFirstMonth(monthStart(date && date >= minDate ? date : minDate))
    setPhase(tripType === 'round-trip' && date && !returnDate ? 'inbound' : 'outbound')
    setOpen(true)
  }

  function selectDay(day: string) {
    if (tripType === 'one-way') {
      onChange(day, '')
      setOpen(false)
    } else if (phase === 'outbound' || !date || day < date) {
      onChange(day, '')
      setPhase('inbound')
    } else {
      onChange(date, day)
      setOpen(false)
    }
  }

  function renderMonth(offset: number) {
    const month = addMonths(firstMonth, offset)
    const year = month.getUTCFullYear()
    const number = month.getUTCMonth()
    const blanks = month.getUTCDay()
    const days = new Date(Date.UTC(year, number + 1, 0)).getUTCDate()
    return <div className="price-calendar-month" key={`${year}-${number}`}>
      <h3>Tháng {number + 1} · {year}</h3>
      <div className="price-calendar-grid">
        {weekdays.map(day => <span className="price-calendar-weekday" key={day}>{day}</span>)}
        {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = dateKey(new Date(Date.UTC(year, number, index + 1)))
          const isPast = day < minDate
          const beforeOutbound = phase === 'inbound' && Boolean(date) && day < date
          const selected = day === date || (tripType === 'round-trip' && day === returnDate)
          const between = tripType === 'round-trip' && date && returnDate && day > date && day < returnDate
          const outboundMarker = phase === 'inbound' && day === date
          return <button
            type="button"
            key={day}
            className={`price-calendar-day${selected ? ' selected' : ''}${between ? ' between' : ''}`}
            disabled={isPast || beforeOutbound || (!loading && !error && prices[day] === undefined)}
            onClick={() => selectDay(day)}
            aria-label={`${shortDate(day)}${outboundMarker ? ', ngày đi đã chọn' : prices[day] !== undefined ? `, từ ${prices[day].toLocaleString('vi-VN')} đồng` : ''}`}
          >
            <span>{index + 1}</span>
            <small>{outboundMarker ? 'Đi' : loading ? '…' : prices[day] !== undefined ? priceLabel(prices[day]) : '—'}</small>
          </button>
        })}
      </div>
    </div>
  }

  return <div className={`price-date-picker ${variant === 'home' ? 'search-field' : 'price-date-editor'}`} ref={rootRef}>
    {variant === 'home' && <span className="field-icon" aria-hidden="true">📅</span>}
    <button type="button" className="price-date-trigger" onClick={() => open ? setOpen(false) : openCalendar()} aria-expanded={open} aria-label={tripType === 'round-trip' ? 'Chọn ngày đi và ngày về' : 'Chọn ngày đi'}>
      <span>{tripType === 'round-trip' ? 'Ngày đi – Ngày về' : 'Ngày đi'}</span>
      <strong>{date ? `${shortDate(date)}${tripType === 'round-trip' ? ` – ${returnDate ? shortDate(returnDate) : 'Chọn ngày về'}` : ''}` : 'Chọn ngày bay'}</strong>
    </button>
    {open && <div className="price-calendar" role="dialog" aria-label="Chọn ngày bay">
      <div className="price-calendar-top">
        <div><strong>{phase === 'outbound' ? 'Chọn chiều đi' : 'Chọn chiều về'}</strong><span>{activeFrom} → {activeTo} · Giá từ mỗi người</span></div>
        <button type="button" className="price-calendar-close" onClick={() => setOpen(false)} aria-label="Đóng lịch">×</button>
      </div>
      <div className="price-calendar-months-nav">
        <button type="button" onClick={() => setFirstMonth(current => addMonths(current, -1))} disabled={dateKey(firstMonth) <= dateKey(monthStart(minDate))} aria-label="Hai tháng trước">‹</button>
        <span>Giá thấp nhất theo ngày</span>
        <button type="button" onClick={() => setFirstMonth(current => addMonths(current, 1))} aria-label="Tháng tiếp theo">›</button>
      </div>
      <div className="price-calendar-months">{renderMonth(0)}{renderMonth(1)}</div>
      {error && <p className="price-calendar-message" role="status">{error}</p>}
      <div className="price-calendar-footer">
        <span>{date ? `Chiều đi ${shortDate(date)}` : 'Chọn ngày đi'}{tripType === 'round-trip' ? ` · ${returnDate ? `Chiều về ${shortDate(returnDate)}` : 'Chọn ngày về'}` : ''}</span>
        {tripType === 'round-trip' && date && <button type="button" onClick={() => { onChange('', ''); setPhase('outbound') }}>Chọn lại</button>}
      </div>
      <p className="price-calendar-disclaimer">Dấu — là ngày chưa có chuyến đủ chỗ. Giá tham khảo có thể thay đổi khi đặt vé.</p>
    </div>}
  </div>
}
