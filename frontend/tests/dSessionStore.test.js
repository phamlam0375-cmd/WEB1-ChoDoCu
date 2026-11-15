import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { sessionToken } from '../src/components/D05_TheoDoiDonHang/dSessionStore.js'
const token = claims => 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature'
test('D UI session clears on expiry boundary; payload never grants authorization', () => {
  assert.equal(sessionToken(null, 1000), null)
  assert.equal(sessionToken(token({ exp: 1 }), 1000), null)
  const validTime = token({ sub: 2, exp: 2 })
  assert.equal(sessionToken(validTime, 1000), validTime)
  assert.equal(sessionToken('invalid', 1000), 'invalid') // Backend phải xác minh chữ ký, UI không tự công nhận role.
});
