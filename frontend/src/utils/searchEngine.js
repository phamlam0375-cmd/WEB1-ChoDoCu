const SEARCH_CONCEPTS = [
  ['phone', ['điện thoại', 'di động', 'dt', 'đt', 'phone', 'phones', 'mobile', 'cell phone', 'cellphone', 'smartphone', 'iphone', 'ipad', 'ip']],
  ['laptop', ['laptop', 'notebook', 'computer', 'pc', 'máy tính', 'mt', 'lap']],
  ['headphones', ['tai nghe', 'headphone', 'headphones', 'earphone', 'earphones', 'headset', 'earbuds']],
  ['chair', ['ghế', 'ghe', 'chair', 'chairs', 'seat', 'office chair', 'ghế văn phòng']],
  ['desk', ['bàn', 'ban', 'desk', 'table', 'study desk', 'bàn học']],
  ['rice-cooker', ['nồi cơm điện', 'rice cooker', 'cooker']],
  ['jacket', ['áo khoác', 'ao khoac', 'jacket', 'coat']],
  ['book', ['sách', 'sach', 'book', 'books', 'textbook']],
  ['bicycle', ['xe đạp', 'xe dap', 'bicycle', 'bike']],
  ['motorbike', ['xe máy', 'xe may', 'xm', 'motorbike', 'motorcycle', 'scooter']],
  ['monitor', ['màn hình', 'man hinh', 'monitor', 'display']],
  ['keyboard', ['bàn phím', 'ban phim', 'keyboard']],
  ['camera', ['máy ảnh', 'may anh', 'camera']],
  ['furniture', ['nội thất', 'noi that', 'furniture']],
]

export function normalizeSearchText(value = '') {
  return String(value)
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const conceptsByAlias = new Map()
const knownSearchWords = new Set()

for (const [concept, aliases] of SEARCH_CONCEPTS) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeSearchText(alias)
    if (!normalizedAlias) continue
    const concepts = conceptsByAlias.get(normalizedAlias) || new Set()
    concepts.add(concept)
    conceptsByAlias.set(normalizedAlias, concepts)
    normalizedAlias.split(' ').forEach((word) => knownSearchWords.add(word))
  }
}

function editDistance(first, second) {
  const distances = Array.from(
    { length: first.length + 1 },
    (_, row) => Array.from({ length: second.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0),
  )

  for (let row = 1; row <= first.length; row += 1) {
    for (let column = 1; column <= second.length; column += 1) {
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1),
      )
      if (
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1)
      }
    }
  }

  return distances[first.length][second.length]
}

function findCorrectedConcept(word) {
  if (word.length < 4 || knownSearchWords.has(word)) return null

  let bestDistance = 2
  let matches = new Set()
  for (const alias of conceptsByAlias.keys()) {
    for (const aliasWord of alias.split(' ')) {
      if (aliasWord.length < 4 || Math.abs(aliasWord.length - word.length) > 1) continue
      const distance = editDistance(word, aliasWord)
      if (distance < bestDistance) {
        bestDistance = distance
        matches = new Set(conceptsByAlias.get(alias))
      } else if (distance === bestDistance) {
        conceptsByAlias.get(alias).forEach((concept) => matches.add(concept))
      }
    }
  }

  return matches.size === 1 ? [...matches][0] : null
}

function parseQuery(query) {
  const words = normalizeSearchText(query).split(' ').filter(Boolean)
  const components = []
  let index = 0

  while (index < words.length) {
    let aliasMatch = null
    for (let end = words.length; end > index; end -= 1) {
      const phrase = words.slice(index, end).join(' ')
      const concepts = conceptsByAlias.get(phrase)
      if (concepts) {
        aliasMatch = { end, concepts: [...concepts] }
        break
      }
    }

    if (aliasMatch) {
      components.push(aliasMatch.concepts)
      index = aliasMatch.end
      continue
    }

    const correctedConcept = findCorrectedConcept(words[index])
    components.push(correctedConcept ? [correctedConcept] : [words[index]])
    index += 1
  }

  return components
}

function textHasPhrase(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `)
}

function componentMatches(component, text, tokens) {
  for (const term of component) {
    const aliases = SEARCH_CONCEPTS.find(([concept]) => concept === term)?.[1]
    if (aliases) {
      if (aliases.some((alias) => textHasPhrase(text, normalizeSearchText(alias)))) return true
      continue
    }

    if (tokens.includes(term)) return true
    if (term.length >= 4 && tokens.some((token) => editDistance(term, token) === 1)) return true
  }
  return false
}

export function scoreSearchMatch(query, product) {
  const components = parseQuery(query)
  if (!components.length) return 1

  const name = normalizeSearchText(product.name)
  const category = normalizeSearchText(product.categoryName || product.category)
  const nameTokens = name.split(' ')
  const categoryTokens = category.split(' ')
  let score = 0

  for (const component of components) {
    const nameMatches = componentMatches(component, name, nameTokens)
    const categoryMatches = componentMatches(component, category, categoryTokens)
    if (!nameMatches && !categoryMatches) return 0
    score += nameMatches ? 3 : 1.5
  }

  const fullQuery = normalizeSearchText(query)
  if (textHasPhrase(name, fullQuery)) score += 2
  return score
}

export function searchProducts(products, query) {
  if (!normalizeSearchText(query)) return products.map((product) => ({ product, score: 1 }))

  return products
    .map((product) => ({ product, score: scoreSearchMatch(query, product) }))
    .filter((result) => result.score > 0)
    .sort((first, second) => second.score - first.score)
}
