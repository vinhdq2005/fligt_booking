import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialDemoState } from './demoInterventions'
import { createPreviewCatalog } from './previewCatalog'
import { initialPreviewQuery, queryPreviewRows } from './previewQuery'

const previewCatalog = createPreviewCatalog(createInitialDemoState())

test('tìm booking không phân biệt dấu tiếng Việt', () => {
  const result = queryPreviewRows(previewCatalog.bookings.rows, { ...initialPreviewQuery, search: 'Do Nam' })
  assert.deepEqual(result.items.map((row) => row.cells[0]), ['BK-DEMO-002'])
})

test('lọc nhiều điều kiện và khoảng ngày cùng lúc', () => {
  const result = queryPreviewRows(previewCatalog.bookings.rows, {
    ...initialPreviewQuery,
    choices: { airlineId: '1', status: 'CONFIRMED' },
    dates: { departureDate: '2026-11-01' },
    fromDate: '2026-10-14', toDate: '2026-10-14',
  })
  assert.deepEqual(result.items.map((row) => row.cells[0]), ['BK-DEMO-001'])
})

test('sắp xếp giá như số và phân trang không lặp bản ghi', () => {
  const rows = previewCatalog.flights.rows
  const first = queryPreviewRows(rows, { ...initialPreviewQuery, sortIndex: 4, sortDirection: 'asc' })
  const second = queryPreviewRows(rows, { ...initialPreviewQuery, sortIndex: 4, sortDirection: 'asc', page: 2 })
  assert.deepEqual(first.items.map((row) => row.cells[0]), ['VJ602', 'VN315'])
  assert.deepEqual(second.items.map((row) => row.cells[0]), ['VN201'])
  assert.equal(second.total, 3)
  assert.equal(second.pageCount, 2)
})

test('trang vượt quá tổng số được đưa về trang cuối sau khi lọc', () => {
  const result = queryPreviewRows(previewCatalog.users.rows, {
    ...initialPreviewQuery, choices: { status: 'LOCKED' }, page: 4,
  })
  assert.equal(result.page, 1)
  assert.equal(result.total, 1)
  assert.equal(result.items[0]?.cells[0], 'Khách Demo')
})
