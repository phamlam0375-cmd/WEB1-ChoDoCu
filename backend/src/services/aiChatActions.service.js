'use strict';

function clean(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s.,-]/g, ' ')
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectChatIntent(message) {
  const input = clean(message);

  if (/^(so sanh|compare)\b/.test(input)) return 'COMPARE';
  if (/\b(re nhat|gia re nhat|mon re nhat|gia mem nhat)\b/.test(input)) {
    return 'CHEAPEST';
  }
  if (/\b(mac nhat|dat nhat|gia cao nhat|gia dat nhat)\b/.test(input)) {
    return 'MOST_EXPENSIVE';
  }
  if (/\b(con xai|xai tot|hoat dong tot|con hoat dong|dung tot|con dung duoc|tinh trang)\b/.test(input)) {
    return 'CONDITION';
  }
  if (/\b(con hang|con san|het hang|da ban|khong con hang|ton kho|mua duoc)\b/.test(input)) {
    return 'AVAILABILITY';
  }

  return 'SEARCH';
}

function detectAvailability(message) {
  const input = clean(message);

  if (
    /\bcon hang\b.*\bhet hang\b/.test(input) ||
    /\bhet hang\b.*\bcon hang\b/.test(input)
  ) {
    return 'ANY';
  }
  if (/\b(con hang|con san)\s+khong\b/.test(input)) {
    return 'CHECK';
  }
  if (/\b(het hang|da ban|khong con hang|sold out)\b/.test(input)) {
    return 'UNAVAILABLE';
  }
  if (/\b(con hang|con san|dang ban|mua duoc|ton kho)\b/.test(input)) {
    return 'AVAILABLE';
  }

  return 'CHECK';
}

function extractComparisonNames(message) {
  const input = clean(message)
    .replace(/^so sanh(?: nhanh)?\s+(?:giua\s+)?/, '')
    .replace(/\s+(?:giup minh|giup|nhe|nha|nao)$/, '');
  const match = input.match(/^(.+?)\s+(?:voi|va|and)\s+(.+)$/);

  if (!match) return [];
  return [match[1].trim(), match[2].trim()];
}

function resolveProductByName(name, products) {
  const query = clean(name);
  if (!query) return { product: null, ambiguous: false, options: [] };

  const titles = products.map(product => ({
    product,
    title: clean(product.Title),
  }));
  const exact = titles.filter(item => item.title === query);
  if (exact.length === 1) {
    return { product: exact[0].product, ambiguous: false, options: [] };
  }
  if (exact.length > 1) {
    return {
      product: null,
      ambiguous: true,
      options: exact.map(item => item.product),
    };
  }

  const contains = titles.filter(item =>
    item.title.includes(query) || query.includes(item.title)
  );
  if (contains.length === 1) {
    return { product: contains[0].product, ambiguous: false, options: [] };
  }
  if (contains.length > 1) {
    return {
      product: null,
      ambiguous: true,
      options: contains.slice(0, 5).map(item => item.product),
    };
  }

  return { product: null, ambiguous: false, options: [] };
}

module.exports = {
  detectAvailability,
  detectChatIntent,
  extractComparisonNames,
  resolveProductByName,
};
