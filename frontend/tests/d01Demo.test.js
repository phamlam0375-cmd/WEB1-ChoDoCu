import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isD01DemoEnabled } from '../src/lib/d01Demo.js'

test('demo D01 la opt-in ro rang, hoat dong trong production build khong phu thuoc DEV', () => {
  assert.equal(isD01DemoEnabled({ DEV: false, PROD: true, VITE_D01_DEMO_MODE: 'true' }), true)
  assert.equal(isD01DemoEnabled({ DEV: true, VITE_D01_DEMO_MODE: 'true' }), true)
  for (const value of [undefined, '', 'false', 'TRUE', '1', true]) {
    assert.equal(isD01DemoEnabled({ DEV: true, VITE_D01_DEMO_MODE: value }), false)
  }
  assert.equal(isD01DemoEnabled(), false) // Node test không có cấu hình build Vite.
})
