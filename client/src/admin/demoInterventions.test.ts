import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDemoIntervention, createInitialDemoState, getInterventionPlan } from './demoInterventions'

const now = new Date('2026-10-16T09:00:00+07:00')

test('không khóa admin đang dùng và không hủy booking đã hết hạn', () => {
  const state = createInitialDemoState()
  assert.match(getInterventionPlan(state, 'users', 1, now)?.disabledReason ?? '', /tự khóa/)
  assert.match(getInterventionPlan(state, 'bookings', 502, now)?.disabledReason ?? '', /hết hạn/)
  assert.throws(() => applyDemoIntervention(state, { action: 'LOCK_USER', entityId: 1, reason: 'Kiểm tra tài khoản admin' }, now))
  assert.throws(() => applyDemoIntervention(state, { action: 'CANCEL_BOOKING_EXCEPTION', entityId: 502, reason: 'Yêu cầu hỗ trợ booking' }, now))
})

test('hủy booking đã trả tiền giải phóng chỗ, giữ kết quả thanh toán và tạo nhật ký', () => {
  const original = createInitialDemoState()
  const result = applyDemoIntervention(original, { action: 'CANCEL_BOOKING_EXCEPTION', entityId: 501, reason: 'Khách yêu cầu hủy ngoại lệ' }, now)
  assert.equal(result.state.bookings.find((item) => item.id === 501)?.status, 'CANCELLED')
  assert.equal(result.state.flights.find((item) => item.id === 101)?.availableSeats, 180)
  assert.equal(result.state.payments.find((item) => item.id === 801)?.status, 'PAID')
  assert.equal(result.state.payments.find((item) => item.id === 801)?.reviewStatus, 'NEEDS_REVIEW')
  assert.equal(result.log.reason, 'Khách yêu cầu hủy ngoại lệ')
  assert.equal(result.log.entityType, 'BOOKING')
  assert.equal(original.bookings.find((item) => item.id === 501)?.status, 'CONFIRMED')
  assert.throws(() => applyDemoIntervention(result.state, { action: 'CANCEL_BOOKING_EXCEPTION', entityId: 501, reason: 'Yêu cầu hủy booking lần hai' }, now))
})

test('tạm ẩn chuyến không thay đổi booking; có thể mở lại chuyến còn theo lịch', () => {
  const original = createInitialDemoState()
  const hidden = applyDemoIntervention(original, { action: 'HIDE_FLIGHT', entityId: 101, reason: 'Kiểm tra giờ bay trước khi bán' }, now)
  assert.equal(hidden.state.flights.find((item) => item.id === 101)?.saleStatus, 'HIDDEN')
  assert.deepEqual(hidden.state.bookings, original.bookings)
  const reopened = applyDemoIntervention(hidden.state, { action: 'REOPEN_FLIGHT', entityId: 101, reason: 'Giờ bay đã được xác nhận lại' }, now)
  assert.equal(reopened.state.flights.find((item) => item.id === 101)?.saleStatus, 'ON_SALE')
  assert.equal(reopened.state.auditLogs.length, original.auditLogs.length + 2)
})

test('không mở bán chuyến của hãng bị khóa hoặc hủy booking sau giờ bay', () => {
  const state = createInitialDemoState()
  const locked = applyDemoIntervention(state, { action: 'LOCK_AIRLINE', entityId: 1, reason: 'Tạm khóa để kiểm tra dữ liệu' }, now)
  assert.match(getInterventionPlan(locked.state, 'flights', 103, now)?.disabledReason ?? '', /Hãng đang bị khóa/)
  const afterDeparture = new Date('2026-11-02T09:00:00+07:00')
  assert.match(getInterventionPlan(state, 'bookings', 501, afterDeparture)?.disabledReason ?? '', /quy trình hỗ trợ riêng/)
})

test('yêu cầu lý do có nội dung và không ghi đè trạng thái giao dịch', () => {
  const state = createInitialDemoState()
  assert.throws(() => applyDemoIntervention(state, { action: 'MARK_PAYMENT_REVIEW', entityId: 801, reason: 'ngắn' }, now), /10 ký tự/)
  const result = applyDemoIntervention(state, { action: 'MARK_PAYMENT_REVIEW', entityId: 801, reason: 'Đối soát giao dịch khách báo lỗi' }, now)
  const payment = result.state.payments.find((item) => item.id === 801)
  assert.equal(payment?.reviewStatus, 'NEEDS_REVIEW')
  assert.equal(payment?.status, 'PAID')
  assert.equal(payment?.amount, 2900000)
})
