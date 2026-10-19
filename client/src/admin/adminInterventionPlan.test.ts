import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRealInterventionPlan } from './adminInterventionPlan'
import { AdminRequestError, submitAdminIntervention } from './adminReadApi'

test('UI blocks unsafe actions and explains the impact of cancellation', () => {
  const self = getRealInterventionPlan('users', { id: 1, name: 'Admin', email: 'admin@example.test', status: 'ACTIVE', role: 'ADMIN', activeAdminCount: 1 }, 1)
  assert.match(self?.disabledReason ?? '', /tự khóa/)
  const lastAdmin = getRealInterventionPlan('users', { id: 2, name: 'Admin 2', status: 'ACTIVE', role: 'ADMIN', activeAdminCount: 1 }, 1)
  assert.match(lastAdmin?.disabledReason ?? '', /cuối cùng/)
  const pastFlight = getRealInterventionPlan('flights', { id: 3, flightNumber: 'FB1', status: 'SCHEDULED', saleStatus: 'HIDDEN', departureTime: '2020-01-01T00:00:00Z', airlineStatus: 'ACTIVE' }, 1)
  assert.match(pastFlight?.disabledReason ?? '', /đã đến giờ/)
  const booking = getRealInterventionPlan('bookings', { id: 4, bookingCode: 'B4', status: 'CONFIRMED', flightStatus: 'SCHEDULED', departureTime: '2099-01-01T00:00:00Z', flightNumber: 'FB1', passengers: [{ id: 1 }], payments: [{ status: 'PAID' }], hasUsedTicket: false }, 1)
  assert.equal(booking?.disabledReason, undefined)
  assert.match(booking?.consequences.join(' ') ?? '', /không tự hoàn tiền/)
  const usedTicket = getRealInterventionPlan('bookings', { id: 4, bookingCode: 'B4', status: 'CONFIRMED', flightStatus: 'SCHEDULED', departureTime: '2099-01-01T00:00:00Z', passengers: [{ id: 1 }], payments: [], hasUsedTicket: true }, 1)
  assert.match(usedTicket?.disabledReason ?? '', /vé được sử dụng/)
  assert.equal(getRealInterventionPlan('audit-logs', { id: 5 }, 1), null)
})

test('intervention request sends session, CSRF intent and a stable request key', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string; init: RequestInit }> = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path: String(path), init: init ?? {} })
    return new Response(JSON.stringify({ status: 'applied', auditLogId: 7 }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  try {
    const result = await submitAdminIntervention({ action: 'HIDE_FLIGHT', entityId: 3, reason: 'Kiểm tra lịch bay' }, '11111111-1111-4111-8111-111111111111')
    assert.equal(result.auditLogId, 7)
    assert.equal(calls[0].path, '/api/admin/interventions')
    assert.equal(calls[0].init.credentials, 'same-origin')
    assert.equal((calls[0].init.headers as Record<string, string>)['x-csrf-intent'], '1')
    assert.equal((calls[0].init.headers as Record<string, string>)['idempotency-key'], '11111111-1111-4111-8111-111111111111')
  } finally { globalThis.fetch = originalFetch }
})

test('intervention request exposes business conflicts to the dialog', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Trạng thái đã thay đổi.' }), { status: 409, headers: { 'content-type': 'application/json' } })
  try {
    await assert.rejects(submitAdminIntervention({ action: 'HIDE_FLIGHT', entityId: 3, reason: 'Kiểm tra lịch bay' }, '11111111-1111-4111-8111-111111111111'),
      (error: unknown) => error instanceof AdminRequestError && error.status === 409)
  } finally { globalThis.fetch = originalFetch }
})
