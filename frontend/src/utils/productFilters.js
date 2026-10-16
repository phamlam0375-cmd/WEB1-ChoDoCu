function normalizeCategoryValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''

  return String(value)
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

export function matchesProductCategory(product, selectedCategory, categories) {
  if (selectedCategory === 'all') return true

  const category = categories.find((item) => item.id === selectedCategory)
  if (!category) return false

  const productCategory = product.category
  const productCategoryValues = typeof productCategory === 'object' && productCategory !== null
    ? [productCategory.id, productCategory.name]
    : [productCategory]
  const productValues = [
    ...productCategoryValues,
    product.categoryId,
    product.categoryName,
  ].map(normalizeCategoryValue).filter(Boolean)
  const selectedValues = [category.id, category.name].map(normalizeCategoryValue)

  return productValues.some((value) => selectedValues.includes(value))
}
