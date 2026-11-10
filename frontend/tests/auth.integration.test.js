import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'

const email = process.env.AUTH_TEST_EMAIL?.trim().toLowerCase()
const password = process.env.AUTH_TEST_PASSWORD
const expectedRole = (process.env.AUTH_TEST_EXPECT_ROLE || 'USER').toUpperCase()
const baseUrl = (process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
const validRoles = new Set(['USER', 'ADMIN', 'SELLER', 'DRIVER'])

test('đăng nhập bằng tài khoản thật và kiểm tra quyền từ database', {
  skip: !email || !password
    ? 'Cần AUTH_TEST_EMAIL và AUTH_TEST_PASSWORD để chạy với tài khoản thật.'
    : false,
}, async () => {
  assert.ok(validRoles.has(expectedRole), 'AUTH_TEST_EXPECT_ROLE không hợp lệ.')

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(loginResponse.status, 200, 'Đăng nhập thật thất bại.')

  const login = await loginResponse.json()
  const token = login.accessToken || login.token
  assert.equal(typeof token, 'string', 'API không trả token đăng nhập.')

  const authHeaders = { authorization: `Bearer ${token}` }
  const meResponse = await fetch(`${baseUrl}/api/v1/me`, {
    headers: authHeaders,
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(meResponse.status, 200, 'API không chấp nhận token đăng nhập.')

  const me = (await meResponse.json()).data
  assert.equal(me?.Email?.toLowerCase(), email, 'API xác thực sai tài khoản.')
  assert.ok(Array.isArray(me.roles), 'API không trả role lấy từ database.')
  assert.ok(me.roles.includes(expectedRole), `Tài khoản thật chưa có role ${expectedRole}.`)

  const adminResponse = await fetch(`${baseUrl}/api/v1/admin/my-activity`, {
    headers: authHeaders,
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(
    adminResponse.status,
    expectedRole === 'ADMIN' ? 200 : 403,
    'API admin không áp dụng đúng quyền ADMIN.',
  )
})
