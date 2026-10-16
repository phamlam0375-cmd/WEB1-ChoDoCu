import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categories, products } from '../src/data/mockProducts.js'
import { matchesProductCategory } from '../src/utils/productFilters.js'

test('lọc danh mục Điện thoại bằng mã danh mục trong catalog', () => {
  const results = products.filter((product) => matchesProductCategory(product, 'dien-thoai', categories))

  assert.deepEqual(results.map((product) => product.id), [1])
})

test('lọc danh mục vẫn khớp khi sản phẩm lưu tên danh mục có dấu hoặc đối tượng danh mục', () => {
  const productsWithCategoryLabels = [
    { id: 1, category: 'Điện thoại' },
    { id: 2, category: { id: 'dien-thoai', name: 'Điện thoại' } },
    { id: 3, category: 'Laptop & máy tính' },
  ]
  const results = productsWithCategoryLabels.filter((product) =>
    matchesProductCategory(product, 'dien-thoai', categories))

  assert.deepEqual(results.map((product) => product.id), [1, 2])
})
