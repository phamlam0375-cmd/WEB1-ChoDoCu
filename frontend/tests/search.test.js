import assert from 'node:assert/strict'
import { test } from 'node:test'
import { products as homepageProducts } from '../src/data/mockProducts.js'
import { searchProducts } from '../src/utils/searchEngine.js'
import { clearSearchHistory, getSearchHistory, saveSearchHistory } from '../src/utils/searchHistory.js'

const searchFixtures = [
  { id: 1, name: 'Điện thoại iPhone 13', categoryName: 'Điện thoại', location: 'Hà Nội' },
  { id: 2, name: 'Máy tính xách tay', categoryName: 'Laptop', location: 'Đà Nẵng' },
  { id: 3, name: 'Xe máy Honda cũ', categoryName: 'Xe máy', location: 'Hồ Chí Minh' },
]

test('tìm không dấu và sửa lỗi gõ gần đúng, xếp kết quả đúng lên trước', () => {
  assert.equal(searchProducts(searchFixtures, 'dien thoai')[0].product.id, 1)
  assert.equal(searchProducts(searchFixtures, 'iphnoe')[0].product.id, 1)
})

test('nhận viết tắt thông dụng và viết tắt theo chữ cái đầu', () => {
  assert.equal(searchProducts(searchFixtures, 'dt')[0].product.id, 1)
  assert.equal(searchProducts(searchFixtures, 'mt')[0].product.id, 2)
  assert.equal(searchProducts(searchFixtures, 'xm')[0].product.id, 3)
})

test('phone và đt không trả về ghế hoặc laptop do giống vài ký tự', () => {
  const titles = (query) => searchProducts(homepageProducts, query).map(({ product }) => product.name)

  assert.deepEqual(titles('phone'), ['iPhone 13 128GB chính hãng, pin 89%'])
  assert.deepEqual(titles('đt'), ['iPhone 13 128GB chính hãng, pin 89%'])
  assert.equal(titles('phone').some((title) => title.includes('Ghế văn phòng')), false)
  assert.equal(titles('đt').some((title) => title.includes('Laptop')), false)
})

test('tìm bằng từ tiếng Anh theo nghĩa tương ứng', () => {
  const titles = (query) => searchProducts(homepageProducts, query).map(({ product }) => product.name)

  assert.ok(titles('chair').includes('Ghế văn phòng công thái học lưng lưới'))
  assert.ok(titles('office chair').includes('Ghế văn phòng công thái học lưng lưới'))
  assert.ok(titles('computer').includes('Laptop Dell Inspiron 15, Core i5, RAM 16GB'))
  assert.ok(titles('headphones').includes('Tai nghe Bluetooth chống ồn, pin 30 giờ'))
})

test('tìm kiếm theo tên danh mục trên tin đăng tải từ API', () => {
  const apiListing = { id: 20, name: 'Thiết bị thông minh', category: '12', categoryName: 'Điện thoại' }

  assert.equal(searchProducts([apiListing], 'phone')[0].product.id, 20)
})

test('không trả về sản phẩm khi từ khóa không khớp', () => {
  assert.deepEqual(searchProducts(searchFixtures, 'máy ảnh film'), [])
})

test('catalog mẫu dự phòng vẫn giữ sản phẩm cũ có iPhone', () => {
  const result = searchProducts(homepageProducts, 'iphone')
  assert.equal(result[0].product.name, 'iPhone 13 128GB chính hãng, pin 89%')
  assert.equal(homepageProducts.some((product) => product.name.includes('Bình sữa Pigeon')), false)
  assert.equal(homepageProducts.some((product) => product.name.includes('Đèn ngủ LED')), false)
})

test('lưu lịch sử cục bộ, đưa từ khóa mới nhất lên trước và giới hạn số mục', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  for (let index = 0; index < 10; index += 1) {
    saveSearchHistory(`từ khóa ${index}`, storage)
  }
  saveSearchHistory('TỪ KHÓA 9', storage)

  assert.equal(getSearchHistory(storage).length, 8)
  assert.equal(getSearchHistory(storage)[0], 'TỪ KHÓA 9')
  assert.deepEqual(clearSearchHistory(storage), [])
  assert.deepEqual(getSearchHistory(storage), [])
})
