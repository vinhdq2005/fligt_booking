import type { AdminDashboard, PageResult } from './models'
import type { ListKind } from './previewCatalog'
import type { InterventionAction } from './models'

export type AdminOptions = {
  airlines: Array<{ id: number; name: string }>
  airports: string[]
  admins: Array<{ id: number; name: string }>
  actions: string[]
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`)
  return data as T
}

export const getAdminOptions = () => get<AdminOptions>('/api/admin/read/options')
export const getAdminOverview = (params: URLSearchParams) => get<{ item: AdminDashboard }>(`/api/admin/overview?${params}`)
export const listAdminData = (kind: ListKind, params: URLSearchParams) => get<PageResult<Record<string, unknown>>>(`/api/admin/read/${kind}?${params}`)
export const getAdminDetail = (kind: ListKind, id: number) => get<{ item: Record<string, unknown> }>(`/api/admin/read/${kind}/${id}`)

export class AdminRequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function submitAdminIntervention(input: { action: InterventionAction; entityId: number; reason: string }, requestId: string) {
  const response = await fetch('/api/admin/interventions', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-intent': '1', 'idempotency-key': requestId },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new AdminRequestError(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`, response.status)
  return data as { status: 'applied' | 'already_applied' | 'already_processed'; auditLogId?: number }
}
