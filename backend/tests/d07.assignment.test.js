'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { driverPolicy, createAssignmentService } = require('../src/services/D07_TaiXeNhanChuyen/assignment.service');
const v = require('../src/validators/D07_TaiXeNhanChuyen/assignment.validator');
const valid = () => ({ user: { Status: 'ACTIVE' }, application: { Status: 'APPROVED' }, hasRole: true,
  profile: { VehicleType: 'MOTORBIKE', VehiclePlate: 'TEST', ServiceArea: 'AREA_1', MaxDistanceKm: null, AvailabilityStatus: 'AVAILABLE' }, active: null });
test('D07 driver policy: C01 DRIVER + B02 + fresh role + D11, không tự cấp quyền/AVAILABLE', () => {
  assert.equal(driverPolicy(valid()).allowed, true);
  for (const [change, code] of [
    [{ user: null }, 'ACCOUNT_UNAVAILABLE'], [{ user: { Status: 'LOCKED' } }, 'ACCOUNT_UNAVAILABLE'],
    [{ application: null }, 'DRIVER_NOT_REGISTERED'], [{ application: { Status: 'PENDING' } }, 'DRIVER_NOT_APPROVED'],
    [{ application: { Status: 'REJECTED' } }, 'DRIVER_NOT_APPROVED'], [{ application: { Status: 'NEED_INFO' } }, 'DRIVER_NOT_APPROVED'],
    [{ hasRole: false }, 'DRIVER_NOT_APPROVED'], [{ profile: null }, 'DRIVER_PROFILE_INCOMPLETE'],
    [{ active: { DeliveryId: 1 } }, 'DRIVER_BUSY'],
  ]) assert.equal(driverPolicy({ ...valid(), ...change }).code, code);
  for (const status of ['BUSY', 'OFFLINE', 'INVALID']) {
    const state = valid(); state.profile.AvailabilityStatus = status;
    assert.equal(driverPolicy(state).allowed, false);
    assert.equal(driverPolicy(state, { replay: true }).allowed, true);
  }
  for (const [key, value] of [['VehiclePlate', ''], ['VehicleType', ''], ['ServiceArea', ''], ['MaxDistanceKm', '-1'], ['MaxDistanceKm', 'NaN']]) {
    const state = valid(); state.profile[key] = value; assert.equal(driverPolicy(state).allowed, false);
  }
  assert.equal(driverPolicy({ ...valid(), hasRole: false }, { replay: true }).allowed, false);
});
test('D07 validation strict: giới hạn phân trang/lọc/sort, không nhận ID/phí/trạng thái client', () => {
  assert.equal(v.id('4294967295'), 4294967295);
  for (const id of [0, -1, '1x', '1e2', '4294967296', undefined]) assert.throws(() => v.id(id), { status: 400 });
  for (const query of [{ limit: 51 }, { page: 0 }, { sort: 'fee' }, { DriverId: 2 }, { pickupArea: ['A'] }, { vehicleType: '' }]) assert.throws(() => v.list(query), { status: 400 });
  assert.equal(v.list({ page: '2', limit: '12' }).offset, 12);
  for (const body of [{ DriverId: 2 }, { driverFee: '0' }, { Status: 'ACCEPTED' }, [], null]) assert.throws(() => v.accept(body), { status: 400 });
  v.accept({}); v.accept(undefined);
});
test('D07 rollback/lock contention được trả 409, migration thiếu trả 503, không nuốt lỗi khác', async () => {
  for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']) {
    const service = createAssignmentService({ repository: { withTransaction: async () => { throw { original: { code } }; } } });
    await assert.rejects(service.status({ UserId: 1 }), { status: code.startsWith('ER_LOCK') ? 409 : 503 });
  }
});
