import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api } from '../src/lib/api.js'
import { completeLogin, resolvePostLoginPath } from '../src/lib/auth.js'
import { loginWithPassword } from '../src/services/authApi.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

function setup(t, adapter) {
  const previous = { adapter: api.defaults.adapter, window: globalThis.window, localStorage: globalThis.localStorage }
  const storage = new MemoryStorage()
  const redirectStorage = new MemoryStorage()
  globalThis.window = { localStorage: storage, sessionStorage: redirectStorage }
  globalThis.localStorage = storage
  api.defaults.adapter = adapter
  t.after(() => {
    api.defaults.adapter = previous.adapter
    globalThis.window = previous.window
    globalThis.localStorage = previous.localStorage
  })
  return { storage, redirectStorage }
}

const response = (config, data) => ({ config, status: 200, statusText: 'OK', data, headers: { 'content-type': 'application/json' } })

test('returnTo uu tien query -> state -> session -> trang chu', () => {
  assert.equal(resolvePostLoginPath('/orders/create/10', '/store/3', '/orders/create/20'), '/orders/create/10')
  assert.equal(resolvePostLoginPath(null, { pathname: '/orders/create/12', search: '?pickup=1', hash: '#form' }, '/'), '/orders/create/12?pickup=1#form')
  assert.equal(resolvePostLoginPath(null, null, '/orders/create/20'), '/orders/create/20')
  assert.equal(resolvePostLoginPath(null, null, null), '/')
})

test('khong chap nhan URL ngoai, protocol-relative, backslash, encoded slash/control', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/%5cevil.test', '/%2fevil.test', '/%0aevil.test', 'javascript:alert(1)', '/%zz']) {
    assert.equal(resolvePostLoginPath(path, null, null), '/', path)
  }
  assert.equal(resolvePostLoginPath('//evil.test', '/orders/create/10', '/'), '/orders/create/10')
})

test('dang nhap sai khong luu phien, khong xoa postLoginRedirect', async (t) => {
  const { storage, redirectStorage } = setup(t, async (config) => {
    assert.equal(api.getUri(config), '/api/auth/login')
    assert.equal(config.headers.Authorization, undefined)
    assert.equal(config.headers['x-user-id'], undefined)
    const error = new Error('Unauthorized')
    error.response = { status: 401, data: { message: 'Sai mat khau' } }
    throw error
  })
  storage.setItem('choDoCu.devUserId', '2')
  redirectStorage.setItem('postLoginRedirect', '/orders/create/42')
  await assert.rejects(loginWithPassword('buyer@example.test', 'wrong'), { message: 'Unauthorized' })
  assert.equal(storage.getItem('accessToken'), null)
  assert.equal(redirectStorage.getItem('postLoginRedirect'), '/orders/create/42')
})

test('API chi tra user khong co token thi khong gia mao phien D01', async (t) => {
  const { storage, redirectStorage } = setup(t, async (config) => response(config, { user: { UserId: 2 } }))
  redirectStorage.setItem('postLoginRedirect', '/orders/create/42')
  await assert.rejects(loginWithPassword('buyer@example.test', 'password'), /chưa trả phiên xác thực/)
  assert.equal(storage.getItem('accessToken'), null)
  assert.equal(redirectStorage.getItem('postLoginRedirect'), '/orders/create/42')
})

test('login -> xac minh /me -> luu dung user -> quay ve D01 -> gui JWT khi preview', async (t) => {
  const calls = []
  const { storage, redirectStorage } = setup(t, async (config) => {
    calls.push(api.getUri(config))
    if (config.method === 'post') return response(config, {
      token: 'verified-session-token', user: { UserId: 2, Email: 'buyer@example.test' },
    })
    assert.equal(config.headers.Authorization, 'Bearer verified-session-token')
    if (config.url === '/me') return response(config, { data: {
      UserId: 315, FullName: 'Actual Buyer', roles: ['USER'],
    } })
    return response(config, { data: { listing: { listingId: 42 } } })
  })
  storage.setItem('choDoCu.devUserId', '2')
  redirectStorage.setItem('postLoginRedirect', '/orders/create/42')
  const session = await loginWithPassword('buyer@example.test', 'password')
  const navigation = []
  completeLogin(session, {
    storage, redirectStorage,
    clearDevIdentity: () => storage.removeItem('choDoCu.devUserId'),
    navigate: (...args) => navigation.push(args),
  })
  assert.equal(JSON.parse(storage.getItem('user')).UserId, 315)
  assert.equal(storage.getItem('choDoCu.devUserId'), null)
  assert.equal(storage.getItem('accessToken'), 'verified-session-token')
  assert.equal(redirectStorage.getItem('postLoginRedirect'), null)
  assert.deepEqual(navigation, [['/orders/create/42', { replace: true }]])
  await api.get('/orders/preview/42')
  assert.deepEqual(calls, ['/api/auth/login', '/api/v1/me', '/api/v1/orders/preview/42'])
})

test('token khong duoc /me chap nhan thi khong luu hoac dieu huong', async (t) => {
  const { storage, redirectStorage } = setup(t, async (config) => {
    if (config.method === 'post') return response(config, { accessToken: 'bad-token', user: { UserId: 315 } })
    throw new Error('Invalid token')
  })
  redirectStorage.setItem('postLoginRedirect', '/orders/create/42')
  await assert.rejects(loginWithPassword('buyer@example.test', 'password'), /Invalid token/)
  assert.equal(storage.getItem('accessToken'), null)
  assert.equal(redirectStorage.getItem('postLoginRedirect'), '/orders/create/42')
})

test('loi luu storage khong xoa duong dan quay lai hoac bao dang nhap thanh cong', () => {
  const redirectStorage = new MemoryStorage()
  redirectStorage.setItem('postLoginRedirect', '/orders/create/42')
  assert.throws(() => completeLogin({ accessToken: 'token', user: { UserId: 315 } }, {
    storage: { setItem: () => { throw new Error('Storage blocked') } },
    redirectStorage,
    clearDevIdentity: () => assert.fail('must not clear'),
    navigate: () => assert.fail('must not navigate'),
  }), /Storage blocked/)
  assert.equal(redirectStorage.getItem('postLoginRedirect'), '/orders/create/42')
})
