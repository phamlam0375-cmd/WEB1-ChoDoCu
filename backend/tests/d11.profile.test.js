'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/validators/D11_HoSoVanHanhTaiXe/profile.validator');
const { driverPolicy } = require('../src/services/D07_TaiXeNhanChuyen/assignment.service');
const operation = { VehicleType: 'MOTORBIKE', VehiclePlate: '59 A', ServiceArea: 'AREA_1', MaxDistanceKm: null };
const bank = { BankName: 'TEST BANK', BankAccountNumber: '00001234', BankAccountHolder: 'TEST DRIVER' };
test('D11 PATCH whitelist, trim, không mass assign/ép kiểu số tài khoản', () => {
  assert.deepEqual(v.patch({ VehiclePlate: ' 59 a ', BankAccountNumber: '00001234', MaxDistanceKm: null }), { VehiclePlate: '59 A', BankAccountNumber: '00001234', MaxDistanceKm: null });
  for (const key of ['UserId', 'DriverProfileId', 'AvailabilityStatus', 'UpdatedAt', 'QrImageUrl', 'role', '__proto__']) {
    assert.throws(() => v.patch(JSON.parse(`{"${key}":"x"}`)), { status: 400 });
  }
  for (const value of [1234, {}, true]) assert.throws(() => v.patch({ BankAccountNumber: value }), { status: 400 });
  for (const body of [null, [], { VehicleType: 'a'.repeat(31) }, { VehiclePlate: '\nBAD' }, { RemoveQr: 'true' }]) assert.throws(() => v.patch(body), { status: 400 });
  assert.deepEqual(v.patch({ BankName: '' }), { BankName: null });
});
test('D11 bán kính NULL không là 0; chặn vô hạn, âm, vượt DECIMAL và làm tròn ngầm', () => {
  for (const value of [0, -1, Infinity, NaN, '', '1e2', '1.234', '10000', true]) assert.throws(() => v.patch({ MaxDistanceKm: value }), { status: 400 });
  for (const value of ['0.01', '9999.99', 1]) assert.ok(v.patch({ MaxDistanceKm: value }).MaxDistanceKm);
  assert.equal(v.patch({ MaxDistanceKm: null }).MaxDistanceKm, null);
  assert.equal(v.patch({ MaxDistanceKm: ' 1.20 ' }).MaxDistanceKm, '1.20');
  assert.equal(Object.hasOwn(v.patch({}), 'MaxDistanceKm'), false);
});
test('D11 và D07 dùng chung readiness: ngân hàng OR QR, bộ ngân hàng nhập dở không hợp lệ', () => {
  assert.equal(v.readiness({ ...operation, ...bank }).ready, true);
  assert.equal(v.readiness(operation, true).ready, true);
  assert.equal(v.readiness(operation, false).ready, false);
  assert.equal(v.readiness({ ...operation, BankName: 'TEST' }, true).ready, false);
  for (const key of ['VehicleType', 'VehiclePlate', 'ServiceArea']) assert.throws(() => v.validateMerged({ ...operation, [key]: '' }), { status: 400 });
  assert.throws(() => v.validateMerged({ ...operation, BankName: 'TEST' }), { status: 400 });
  const state = { user: { Status: 'ACTIVE' }, application: { Status: 'APPROVED' }, hasRole: true, profile: { ...operation, AvailabilityStatus: 'AVAILABLE' } };
  assert.equal(driverPolicy(state).code, 'DRIVER_RECEIVING_REQUIRED');
  assert.equal(driverPolicy({ ...state, qrValid: true }).allowed, true);
  assert.equal(driverPolicy(state, { replay: true }).allowed, true, 'Không chặn tiếp tục chuyến cũ vì thiếu nhận phí');
  for (const status of ['ACCEPTED', 'PICKED_UP', 'DELIVERING', 'FAILED', 'RETURNING', 'UNKNOWN']) assert.equal(driverPolicy({ ...state, qrValid: true, active: { Status: status } }).code, 'DRIVER_BUSY');
});
test('D11 trạng thái thủ công không chấp nhận BUSY hoặc thêm trường client', () => {
  assert.equal(v.availability({ AvailabilityStatus: 'AVAILABLE' }), 'AVAILABLE');
  for (const body of [{ AvailabilityStatus: 'BUSY' }, { AvailabilityStatus: 'OFFLINE', UserId: 1 }, {}, null]) assert.throws(() => v.availability(body), { status: 400 });
});
