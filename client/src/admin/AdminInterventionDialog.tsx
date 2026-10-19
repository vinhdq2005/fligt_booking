import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { RealInterventionPlan } from './adminInterventionPlan'

export default function AdminInterventionDialog({ plan, onCancel, onConfirm }: {
  plan: RealInterventionPlan
  onCancel: () => void
  onConfirm: (reason: string, requestId: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const requestRef = useRef<{ reason: string; id: string } | null>(null)
  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = reason.trim()
    if (value.length < 10 || value.length > 1000) { setError('Lý do phải có từ 10 đến 1000 ký tự.'); return }
    const request = requestRef.current?.reason === value ? requestRef.current : { reason: value, id: crypto.randomUUID() }
    requestRef.current = request
    setBusy(true)
    setError('')
    try { await onConfirm(value, request.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể thực hiện thao tác.') }
    finally { setBusy(false) }
  }

  return <div className="admin-intervention-backdrop" onMouseDown={() => { if (!busy) onCancel() }}>
    <form className="admin-intervention-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-intervention-title" onMouseDown={event => event.stopPropagation()} onSubmit={submit}>
      <span className="eyebrow">XÁC NHẬN CAN THIỆP</span>
      <h2 id="admin-intervention-title">{plan.label}</h2>
      <p className="admin-intervention-subject">{plan.subject}</p>
      <div className="admin-impact-box"><strong>Tác động dự kiến</strong><ul>{plan.consequences.map(item => <li key={item}>{item}</li>)}</ul></div>
      <label htmlFor="admin-reason">Lý do can thiệp <span aria-hidden="true">*</span></label>
      <textarea ref={inputRef} id="admin-reason" value={reason} maxLength={1000} disabled={busy} required rows={3}
        onChange={event => { setReason(event.target.value); setError(''); requestRef.current = null }}
        placeholder="Nêu lý do cụ thể (ít nhất 10 ký tự)" aria-describedby="admin-reason-hint" />
      <small id="admin-reason-hint">Lý do sẽ được lưu trong nhật ký quản trị.</small>
      {error && <p className="admin-filter-error" role="alert">{error}</p>}
      <div className="admin-intervention-actions"><button type="button" className="outline-button" disabled={busy} onClick={onCancel}>Quay lại</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button></div>
    </form>
  </div>
}
