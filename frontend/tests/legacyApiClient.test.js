import { test } from 'node:test'
import assert from 'node:assert/strict'
import legacyApi from '../src/services/apiClient.js'
import { api } from '../src/lib/api.js'

test('Trang chủ/store dùng cùng nguồn API D01, giữ prefix legacy và không gọi localhost production', async t => {
  assert.equal(legacyApi.defaults.baseURL, api.defaults.baseURL.replace(/\/v1\/?$/, ''))
  assert.equal(legacyApi.defaults.baseURL, '/api')
  const previous = legacyApi.defaults.adapter
  t.after(() => { legacyApi.defaults.adapter = previous })
  legacyApi.defaults.adapter = async config => {
    assert.equal(legacyApi.getUri(config), '/api/seller/listing?page=1&limit=100')
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { data: [{ ListingId: 10 }] } }
  }
  const response = await legacyApi.get('/seller/listing', { params: { page: 1, limit: 100 } })
  assert.equal(response.data.data[0].ListingId, 10)
})
