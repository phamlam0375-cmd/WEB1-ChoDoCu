
'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { ConditionOptions, Listings, Users } = require('../models');
const {
  isConfigured: isGeminiConfigured,
  interpretMessage,
} = require('../services/aiChat.service');
const {
  detectAvailability,
  detectChatIntent,
  extractComparisonNames,
  resolveProductByName,
} = require('../services/aiChatActions.service');
const {
  exactSellerNameMatch,
  extractSellerName,
  hasSellerNameDiacritics,
} = require('../services/aiChatSeller.service');

const router = express.Router();
const PUBLIC_LISTING_STATUSES = ['ACTIVE', 'RESERVED', 'SOLD'];
const listingStatusLabels = {
  ACTIVE: 'Đang bán',
  RESERVED: 'Đang có người đặt',
  SOLD: 'Đã bán',
};
const LISTING_ATTRIBUTES = [
  'ListingId',
  'SellerId',
  'Title',
  'Description',
  'KnownDefects',
  'Price',
  'ConditionLevel',
  'Status',
];

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (value) =>
  normalize(value)
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const moneyText = (value) =>
  Number(value).toLocaleString('vi-VN') + 'đ';

const respond = (res, reply, products = []) =>
  res.json({ success: true, reply, products });

// ===== 1. TÌM KIẾM TÊN GẦN ĐÚNG =====

function levenshtein(a, b) {
  const x = clean(a);
  const y = clean(b);

  let previous = Array.from(
    { length: y.length + 1 },
    (_, i) => i
  );

  for (let i = 1; i <= x.length; i++) {
    const current = [i];

    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] +
        (x[i - 1] === y[j - 1] ? 0 : 1)
      );
    }

    previous = current;
  }

  return previous[y.length];
}

function similarity(a, b) {
  const x = clean(a);
  const y = clean(b);

  if (!x || !y) return 0;
  if (x === y) return 1;

  return 1 - levenshtein(x, y) /
    Math.max(x.length, y.length);
}

function sellerScore(query, fullName) {
  const q = clean(query);
  const name = clean(fullName);

  if (!q || !name) return 0;
  if (q === name) return 1;

  const words = name.split(' ');
  const qLength = q.split(' ').length;

  const candidates = [name];

  // So khớp cả tên rút gọn
  for (let size = 1; size <= Math.min(
    words.length, qLength + 1
  ); size++) {
    for (let i = 0; i + size <= words.length; i++) {
      candidates.push(
        words.slice(i, i + size).join(' ')
      );
    }
  }

  return Math.max(
    ...candidates.map(v => similarity(q, v))
  );
}

// ===== 2. NHẬN DIỆN NGƯỜI BÁN =====



function asksAboutSeller(text) {
  const input = clean(text);

  return (
    /\b(san pham cua|do cua|hang cua|mon cua|nguoi ban)\b/.test(input) ||
    /\b(dang ban gi|ban gi|ban nhung gi|co ban gi|co san pham gi|co nhung gi)\b/.test(input) ||
    /\b(anh|chi|co|chu)\s+.+\s+(dang ban|co ban|co san pham)\b/.test(input)
  );
}


// ===== 3. TỪ ĐỒNG NGHĨA SẢN PHẨM =====

const groups = {
  'dien thoai': [
    'dien thoai', 'dt', 'phone', 'smartphone',
    'iphone', 'samsung', 'oppo', 'xiaomi',
    'vivo', 'realme', 'nokia'
  ],
  'laptop': [
    'laptop', 'notebook', 'may tinh xach tay',
    'macbook'
  ],
  'may tinh': [
    'may tinh', 'pc', 'desktop', 'laptop'
  ],
  'tai nghe': [
    'tai nghe', 'headphone', 'earphone',
    'airpods'
  ],
  'ban phim': ['ban phim', 'keyboard'],
  'chuot': ['chuot', 'mouse'],
  'xe dap': ['xe dap', 'bicycle'],
  'giay': ['giay', 'sneaker'],
  'tui xach': ['tui xach', 'handbag']
};

function containsPhrase(text, phrase) {
  const source = ` ${clean(text)} `;
  const target = ` ${clean(phrase)} `;

  return source.includes(target);
}

function extractKeyword(text) {
  const input = clean(text);

  // Ưu tiên tên thương hiệu / sản phẩm cụ thể
  const specific = [
    'iphone', 'samsung', 'oppo', 'xiaomi',
    'realme', 'vivo', 'nokia', 'macbook',
    'airpods', 'messi', 'ronaldo'
  ];

  for (const word of specific) {
    if (containsPhrase(input, word)) return word;
  }

  for (const [category, aliases] of Object.entries(groups)) {
    if (aliases.some(word => containsPhrase(input, word))) {
      return category;
    }
  }

  return null;
}

function matchProduct(product, keyword) {
  if (!keyword) return true;

  const text = clean(
    `${product.Title || ''} ${product.Description || ''}`
  );

  const q = clean(keyword);
  const aliases = groups[q] || [q];

  return aliases.some(word => containsPhrase(text, word));
}

async function getConditionOptions(products) {
  const codes = [...new Set(
    products.map(product => product.ConditionLevel).filter(Boolean)
  )];
  if (!codes.length) return new Map();

  const options = await ConditionOptions.findAll({
    where: {
      ConditionCode: { [Op.in]: codes },
      Status: 'ACTIVE',
    },
    attributes: ['ConditionCode', 'Label', 'Description'],
    raw: true,
  });

  return new Map(options.map(option => [
    option.ConditionCode,
    option,
  ]));
}

function getConditionLabel(product, options) {
  return options.get(product.ConditionLevel)?.Label ||
    product.ConditionLevel ||
    'Chưa cập nhật';
}

function productCards(products) {
  return products.map(product => ({
    id: product.ListingId,
    name: product.Title,
    price: Number(product.Price),
    url: `/products/${product.ListingId}`,
  }));
}

function listingFacts(product, conditionOptions) {
  const condition = conditionOptions.get(product.ConditionLevel);
  const facts = [
    `Giá: ${moneyText(product.Price)}`,
    `Tình trạng người bán khai báo: ${condition?.Label || product.ConditionLevel || 'Chưa cập nhật'}`,
  ];

  if (condition?.Description) {
    facts.push(`Mô tả tình trạng: ${condition.Description}`);
  }
  facts.push(`Trạng thái tin: ${listingStatusLabels[product.Status] || 'Không rõ'}`);
  if (product.KnownDefects) {
    facts.push(`Lỗi đã khai báo: ${product.KnownDefects}`);
  }

  return facts.join('\n');
}

async function findExtremeListing(where, keyword, direction) {
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const batch = await Listings.findAll({
      where,
      attributes: LISTING_ATTRIBUTES,
      order: [
        ['Price', direction],
        ['ListingId', 'ASC'],
      ],
      limit: pageSize,
      offset,
    });
    const match = batch.find(product => matchProduct(product, keyword));

    if (match) return match;
    if (batch.length < pageSize) return null;
    offset += pageSize;
  }
}

// ===== 4. NHẬN DIỆN GIÁ =====

function parseAmount(number, unit) {
  const n = Number(String(number).replace(',', '.'));
  const u = clean(unit);

  if (!Number.isFinite(n)) return null;

  if (['k', 'nghin', 'ngan'].includes(u)) {
    return n * 1000;
  }

  if (['tr', 'trieu', 'm'].includes(u)) {
    return n * 1000000;
  }

  return n;
}

const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const UNIT = '(trieu|tr|nghin|ngan|k|m)';

function extractPrice(text) {
  const input = normalize(text);

  const range = input.match(new RegExp(
    `${NUMBER}\\s*${UNIT}?\\s*(?:-|den|toi)\\s*${NUMBER}\\s*${UNIT}?`,
    'i'
  ));

  if (range) {
    const u1 = range[2] || range[4];
    const u2 = range[4] || range[2];

    if (!u1 || !u2) return { unclear: true };

    const a = parseAmount(range[1], u1);
    const b = parseAmount(range[3], u2);

    return {
      min: Math.min(a, b),
      max: Math.max(a, b)
    };
  }

  const under = input.match(new RegExp(
    `(?:duoi|khong qua|toi da|re hon)\\s*${NUMBER}\\s*${UNIT}`,
    'i'
  ));

  if (under) {
    return { max: parseAmount(under[1], under[2]) };
  }

  const over = input.match(new RegExp(
    `(?:tren|it nhat|tu)\\s*${NUMBER}\\s*${UNIT}`,
    'i'
  ));

  if (over) {
    return { min: parseAmount(over[1], over[2]) };
  }

  const standalone = input.match(new RegExp(
    `(?:gia|tam|khoang|duoi|tren)\\s*${NUMBER}\\s*${UNIT}`,
    'i'
  ));

  if (standalone) {
    const value = parseAmount(
      standalone[1], standalone[2]
    );

    if (/\bduoi\b/.test(input)) {
      return { max: value };
    }

    if (/\btren\b/.test(input)) {
      return { min: value };
    }

    return { max: value };
  }

  if (/\b\d+\s*(?:k|tr|trieu|nghin)\b/.test(input)) {
    const found = input.match(
      new RegExp(`${NUMBER}\\s*${UNIT}`, 'i')
    );

    if (found) {
      return { max: parseAmount(found[1], found[2]) };
    }
  }

  if (/^\d+$/.test(input)) {
    return { unclear: true };
  }

  return null;
}

// ===== 5. CÂU HỎI THÔNG THƯỜNG =====

function casualReply(text) {
  const input = clean(text);

  if (/^(hi|hello|hey|xin chao|chao|alo)( ban| shop| ad)?$/.test(input)) {
    return 'Xin chào! 👋 Mình là trợ lý Chợ Đồ Cũ. Bạn muốn tìm sản phẩm gì hôm nay?';
  }

  if (/^(cam on|thanks|thank you)( ban| nha| nhe)?$/.test(input)) {
    return 'Không có gì ạ! ❤️ Bạn cần tìm món gì cứ nhắn mình nhé.';
  }

  if (/^(ban la ai|ban ten gi|ai day)$/.test(input)) {
    return 'Mình là chatbot hỗ trợ tìm sản phẩm và người bán trên Chợ Đồ Cũ.';
  }

  return null;
}

function hasSearchIntent(text) {
  return /\b(tim|mua|kiem|san pham|ban gi|dang ban|gia|duoi|tren|re hon|co gi|goi y|tu van|can mua|xem do|xem hang)\b/
    .test(clean(text));
}

// ===== 6. LỊCH SỬ HỘI THOẠI =====

function getUserHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .filter(item =>
      item &&
      item.role === 'user' &&
      typeof item.content === 'string'
    )
    .map(item => item.content.slice(0, 1000));
}

function getPrevious(messages, extractor) {
  for (const text of [...messages].reverse()) {
    const value = extractor(text);
    if (value) return value;
  }

  return null;
}

async function findPublicSellers() {
  const listings = await Listings.findAll({
    where: { Status: { [Op.in]: PUBLIC_LISTING_STATUSES } },
    attributes: ['SellerId'],
    group: ['SellerId'],
    raw: true,
    limit: 2000,
  });

  const sellerIds = [...new Set(
    listings.map(listing => Number(listing.SellerId))
  )].filter(Number.isInteger);

  if (!sellerIds.length) return [];

  return Users.findAll({
    where: {
      Status: 'ACTIVE',
      UserId: { [Op.in]: sellerIds },
    },
    attributes: ['UserId', 'FullName'],
    order: [['FullName', 'ASC']],
  });
}

// ===== 7. API CHATBOT =====

router.post('/chat', async (req, res) => {
  try {
    const message =
      typeof req.body?.message === 'string'
        ? req.body.message.trim()
        : '';

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tin nhắn'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn quá dài'
      });
    }

    const casual = casualReply(message);

    if (casual && !isGeminiConfigured()) {
      return respond(res, casual);
    }

    const input = clean(message);
    const history = getUserHistory(req.body?.history);

    // ===== XỬ LÝ KHÁCH CHỌN NGƯỜI BÁN =====

    const rawHistory = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const lastAssistant = [...rawHistory]
      .reverse()
      .find(item => item?.role === 'assistant');

    const previousReply =
      typeof lastAssistant?.content === 'string'
        ? lastAssistant.content
        : '';

    let selectedSeller = null;

    // Kiểm tra chatbot vừa gợi ý danh sách người bán
    if (
      previousReply.includes('người bán có tên gần giống') &&
      previousReply.includes('(ID:')
    ) {
      const suggestedIds = [
        ...previousReply.matchAll(
          /^\s*\d+\.\s+.+?\(ID:\s*(\d+)\)/gm
        )
      ].map(match => Number(match[1]));

      let selectedId = null;

      // Khách chọn số thứ tự: 1, 2, 3...
      if (/^\d+$/.test(input)) {
        const index = Number(input) - 1;

        if (
          index >= 0 &&
          index < suggestedIds.length
        ) {
          selectedId = suggestedIds[index];
        }
      }

      if (selectedId !== null) {
        selectedSeller = await Users.findOne({
          where: {
            UserId: selectedId,
            Status: 'ACTIVE'
          },
          attributes: ['UserId', 'FullName']
        });
      } else {
        // Khách nhập lại tên đầy đủ
        const users = await findPublicSellers();

        const matches = users.filter(user =>
          exactSellerNameMatch(user.FullName, message) &&
          suggestedIds.includes(user.UserId)
        );

        if (matches.length === 1) {
          selectedSeller = matches[0];
        }
      }

      if (
        !selectedSeller &&
        /^\d+$/.test(input)
      ) {
        return respond(
          res,
          'Bạn vui lòng chọn đúng số thứ tự trong danh sách người bán nhé.'
        );
      }
    }

    let aiInterpretation = null;
    let aiUnavailable = false;
    const awaitingSellerChoice =
      previousReply.includes('người bán có tên gần giống') &&
      previousReply.includes('(ID:');

    if (
      isGeminiConfigured() &&
      !selectedSeller &&
      !awaitingSellerChoice
    ) {
      try {
        aiInterpretation = await interpretMessage({
          message,
          history: rawHistory,
        });
      } catch (error) {
        aiUnavailable = true;
        console.error(
          'Gemini chat unavailable; continuing with local search parsing:',
          error
        );
      }

      if (
        aiInterpretation &&
        ['CHAT', 'CLARIFY'].includes(aiInterpretation.intent)
      ) {
        return respond(
          res,
          aiInterpretation.reply ||
            'Bạn cho mình biết thêm một chút về món đồ muốn tìm nhé.'
        );
      }
    }

    const reply = (text, products = []) =>
      respond(
        res,
        aiUnavailable
          ? `AI đang tạm không phản hồi; mình thử xử lý yêu cầu bằng tìm kiếm cơ bản.\n\n${text}`
          : text,
        products
      );

    const localIntent = detectChatIntent(message);
    const intent = aiInterpretation?.intent === 'SEARCH' &&
      localIntent !== 'SEARCH'
      ? localIntent
      : aiInterpretation?.intent || localIntent;
    const availability =
      aiInterpretation?.availability &&
      aiInterpretation.availability !== 'ANY'
        ? aiInterpretation.availability
        : detectAvailability(message);
    const comparisonNames =
      aiInterpretation?.compareProduct1 &&
      aiInterpretation?.compareProduct2
        ? [
          aiInterpretation.compareProduct1,
          aiInterpretation.compareProduct2,
        ]
        : extractComparisonNames(message);

    if (aiUnavailable && casual) {
      return reply(casual);
    }

    const cheaper = /\b(re hon|gia thap hon|gia mem hon)\b/
      .test(input);

    const followUp = cheaper ||
      /^(con|co cai nao|co mon nao|loai nao)/.test(input);

    let sellerName =
    extractSellerName(message) || aiInterpretation?.sellerName;
    let keyword =
      aiInterpretation?.keyword || extractKeyword(message);
    let price = aiInterpretation &&
      (aiInterpretation.minPrice || aiInterpretation.maxPrice)
      ? {
        ...(aiInterpretation.minPrice
          ? { min: aiInterpretation.minPrice }
          : {}),
        ...(aiInterpretation.maxPrice
          ? { max: aiInterpretation.maxPrice }
          : {}),
      }
      : extractPrice(message);

    const sellerQuestion = asksAboutSeller(message);

    // Khách đang hỏi người bán nhưng không đọc được tên
    if (sellerQuestion && !sellerName) {
      return reply(
        'Mình chưa xác định được tên người bán. Bạn nhập tên đầy đủ hơn giúp mình nhé!'
      );
    }

    // Chỉ kế thừa ngữ cảnh với câu hỏi tiếp nối
    if (followUp) {
      if (!keyword) {
        keyword = getPrevious(history, extractKeyword);
      }

      if (!sellerName) {
        sellerName = getPrevious(history, extractSellerName);
      }

      if (cheaper && !price) {
        const oldPrice = getPrevious(
          history,
          extractPrice
        );

        if (oldPrice && !oldPrice.unclear) {
          const limit = oldPrice.min ?? oldPrice.max;

          if (limit !== undefined) {
            price = { max: Math.max(0, limit - 1) };
          }
        }
      }
    }

    if (price?.unclear && !selectedSeller) {
      return reply(
        'Bạn muốn tìm sản phẩm giá bao nhiêu? Ví dụ: 200k, 2 triệu hoặc từ 200k đến 500k.'
      );
    }

    if (cheaper && !price) {
      return reply(
        'Bạn muốn tìm sản phẩm rẻ hơn mức giá nào? Ví dụ: dưới 300k.'
      );
    }

    // ===== TÌM NGƯỜI BÁN =====

    let seller = selectedSeller;

    if (sellerName && !seller) {
      const users = await findPublicSellers();

      const ranked = users
        .map(user => ({
          user,
          score: sellerScore(
            sellerName,
            user.FullName
          )
        }))
        .filter(item => item.score >= 0.67)
        .sort((a, b) => b.score - a.score);

      const exact = ranked.filter(item =>
        clean(item.user.FullName) === clean(sellerName)
      );
      const exactAccented = hasSellerNameDiacritics(sellerName)
        ? ranked.filter(item =>
          exactSellerNameMatch(item.user.FullName, sellerName)
        )
        : [];

      if (exactAccented.length === 1) {
        seller = exactAccented[0].user;
      } else if (!hasSellerNameDiacritics(sellerName) && exact.length === 1) {
        seller = exact[0].user;
      } else if (ranked.length === 0) {
        return reply(
          `Mình chưa tìm thấy người bán có tên gần giống "${sellerName}". Bạn thử nhập tên đầy đủ hơn nhé.`
        );
      } else {
        // Không tự chọn người bán khi chưa chắc chắn
        const suggestions = ranked
          .slice(0, 5)
          .map((item, index) =>
            `${index + 1}. ${item.user.FullName} (ID: ${item.user.UserId})`
          )
          .join('\n');

        return reply(
          `Mình tìm thấy những người bán có tên gần giống "${sellerName}":\n\n` +
          suggestions +
          '\n\nBạn hãy nhập lại tên đầy đủ của người muốn tìm nhé.'
        );
      }
    }

    // Nếu khách chỉ nhập tên người bán được gợi ý
    // nhưng không có từ khóa "bán gì", hỗ trợ xác nhận
    if (!seller && !sellerName && history.length) {
      const lastAssistant = Array.isArray(req.body?.history)
        ? [...req.body.history].reverse().find(
          item => item?.role === 'assistant'
        )
        : null;

      if (
        typeof lastAssistant?.content === 'string' &&
        lastAssistant.content.includes(
          'người bán có tên gần giống'
        )
      ) {
        const users = await findPublicSellers();

        const matches = users.filter(
          user => exactSellerNameMatch(user.FullName, message)
        );

        if (matches.length === 1) {
          seller = matches[0];
        }
      }
    }

    // ===== TRUY VẤN MYSQL =====

    const where = {
      Status: { [Op.in]: PUBLIC_LISTING_STATUSES },
    };

    if (seller) {
      where.SellerId = seller.UserId;
    }

    if (price) {
      where.Price = {};

      if (price.min !== undefined) {
        where.Price[Op.gte] = price.min;
      }

      if (price.max !== undefined) {
        where.Price[Op.lte] = price.max;
      }
    }

    if (intent === 'COMPARE') {
      if (comparisonNames.length < 2) {
        return reply(
          'Bạn gửi tên của hai sản phẩm muốn so sánh nhé. Ví dụ: "So sánh iPhone 11 với Samsung A52".'
        );
      }

      const candidates = await Listings.findAll({
        where,
        attributes: LISTING_ATTRIBUTES,
        order: [['CreatedAt', 'DESC'], ['ListingId', 'DESC']],
        limit: 1000,
      });
      const first = resolveProductByName(comparisonNames[0], candidates);
      const second = resolveProductByName(comparisonNames[1], candidates);
      const unresolved = [
        { name: comparisonNames[0], result: first },
        { name: comparisonNames[1], result: second },
      ].find(item => !item.result.product);

      if (unresolved) {
        if (unresolved.result.ambiguous) {
          const options = unresolved.result.options
            .map(product => `• ${product.Title}`)
            .join('\n');
          return reply(
            `Mình thấy nhiều sản phẩm phù hợp với "${unresolved.name}":\n${options}\n\nBạn gửi tên đầy đủ hơn để mình so sánh chính xác nhé.`,
            unresolved.result.options.map(product => ({
              id: product.ListingId,
              name: product.Title,
              price: Number(product.Price),
              url: `/products/${product.ListingId}`,
            }))
          );
        }

        return reply(
          `Mình chưa tìm thấy sản phẩm "${unresolved.name}" trong các tin đang công khai. Bạn kiểm tra lại tên sản phẩm giúp mình nhé.`
        );
      }

      if (first.product.ListingId === second.product.ListingId) {
        return reply(
          'Hai tên bạn gửi đang khớp cùng một tin đăng. Bạn nhập tên hai sản phẩm khác nhau để mình so sánh nhé.'
        );
      }

      const products = [first.product, second.product];
      const conditionOptions = await getConditionOptions(products);
      const details = products.map(product =>
        `${product.Title}\n${listingFacts(product, conditionOptions)}`
      );
      const difference = Math.abs(
        Number(products[0].Price) - Number(products[1].Price)
      );
      const priceNote = difference === 0
        ? 'Hai sản phẩm có cùng mức giá.'
        : `${products[0].Title} ${Number(products[0].Price) < Number(products[1].Price) ? 'rẻ hơn' : 'đắt hơn'} ${products[1].Title} ${moneyText(difference)}.`;

      return reply(
        `So sánh theo thông tin người bán đăng:\n\n${details.join('\n\n')}\n\n${priceNote}\nLưu ý: mình chỉ đối chiếu thông tin trên tin đăng, không thể kiểm tra chất lượng thực tế.`,
        productCards(products)
      );
    }

    if (intent === 'CONDITION') {
      const productName =
        aiInterpretation?.productName || keyword;

      if (!productName) {
        return reply(
          'Bạn cho mình tên hoặc model sản phẩm cần kiểm tra tình trạng nhé.'
        );
      }

      const candidates = await Listings.findAll({
        where,
        attributes: LISTING_ATTRIBUTES,
        order: [['CreatedAt', 'DESC'], ['ListingId', 'DESC']],
        limit: 1000,
      });
      const resolved = resolveProductByName(productName, candidates);

      if (resolved.ambiguous) {
        const options = resolved.options
          .map(product => `• ${product.Title}`)
          .join('\n');
        return reply(
          `Mình thấy nhiều sản phẩm phù hợp với "${productName}":\n${options}\n\nBạn gửi tên đầy đủ hơn để mình kiểm tra đúng món nhé.`,
          resolved.options.map(product => ({
            id: product.ListingId,
            name: product.Title,
            price: Number(product.Price),
            url: `/products/${product.ListingId}`,
          }))
        );
      }
      if (!resolved.product) {
        return reply(
          `Mình chưa tìm thấy sản phẩm "${productName}" trong các tin đang công khai. Bạn kiểm tra lại tên hoặc model nhé.`
        );
      }

      const product = resolved.product;
      const conditionOptions = await getConditionOptions([product]);
      const declaredCondition =
        conditionOptions.get(product.ConditionLevel);
      const description = String(product.Description || '')
        .trim()
        .slice(0, 500);
      const details = [
        `Tình trạng người bán khai báo: ${declaredCondition?.Label || product.ConditionLevel || 'Chưa cập nhật'}`,
      ];
      if (declaredCondition?.Description) {
        details.push(`Mô tả tình trạng: ${declaredCondition.Description}`);
      }
      if (description) details.push(`Mô tả tin đăng: ${description}`);
      if (product.KnownDefects) {
        details.push(`Lỗi đã khai báo: ${product.KnownDefects}`);
      }
      details.push(
        'Mình chỉ dựa trên thông tin người bán đăng, không thể xác minh tình trạng thực tế của sản phẩm.'
      );

      return reply(
        `${product.Title}\n${details.join('\n')}`,
        productCards([product])
      );
    }

    if (intent === 'AVAILABILITY') {
      const productName = aiInterpretation?.productName;
      const checkSpecificProduct =
        Boolean(productName) || availability === 'CHECK';

      if (checkSpecificProduct) {
        const query = productName || keyword;
        if (!query) {
          return reply(
            'Bạn cho mình tên hoặc model sản phẩm cần kiểm tra còn hàng nhé.'
          );
        }

        const candidates = await Listings.findAll({
          where,
          attributes: LISTING_ATTRIBUTES,
          order: [['CreatedAt', 'DESC'], ['ListingId', 'DESC']],
          limit: 1000,
        });
        const resolved = resolveProductByName(query, candidates);

        if (resolved.ambiguous) {
          const options = resolved.options
            .map(product => `• ${product.Title} — ${moneyText(product.Price)} — ${listingStatusLabels[product.Status]}`)
            .join('\n');
          return reply(
            `Mình thấy nhiều sản phẩm phù hợp với "${query}":\n${options}\n\nBạn chọn hoặc gửi tên đầy đủ của sản phẩm nhé.`,
            resolved.options.map(product => ({
              id: product.ListingId,
              name: product.Title,
              price: Number(product.Price),
              url: `/products/${product.ListingId}`,
            }))
          );
        }
        if (!resolved.product) {
          return reply(
            `Mình chưa tìm thấy sản phẩm "${query}" trong các tin đang công khai.`
          );
        }

        const product = resolved.product;
        const availabilityText = product.Status === 'ACTIVE'
          ? 'Sản phẩm đang được rao bán.'
          : product.Status === 'RESERVED'
          ? 'Sản phẩm đang có người đặt nên có thể chưa mua được.'
          : 'Sản phẩm đã bán và hiện không còn hàng.';

        return reply(
          `${product.Title}: ${availabilityText}\nGiá: ${moneyText(product.Price)}\nTrạng thái tin: ${listingStatusLabels[product.Status] || 'Không rõ'}`,
          productCards([product])
        );
      }

      if (availability !== 'ANY') {
        const requestedStatuses = availability === 'UNAVAILABLE'
          ? ['RESERVED', 'SOLD']
          : ['ACTIVE'];
        where.Status = { [Op.in]: requestedStatuses };
      }
      if (!keyword && !seller) {
        return reply(
          availability === 'UNAVAILABLE'
            ? 'Bạn muốn kiểm tra loại sản phẩm nào đã có người đặt hoặc đã bán?'
            : availability === 'AVAILABLE'
            ? 'Bạn muốn xem loại sản phẩm nào đang còn hàng?'
            : 'Bạn muốn kiểm tra loại sản phẩm nào?'
        );
      }
    }

    if (intent === 'CHEAPEST' || intent === 'MOST_EXPENSIVE') {
      const direction = intent === 'CHEAPEST' ? 'ASC' : 'DESC';
      const product = await findExtremeListing(where, keyword, direction);

      if (!product) {
        return reply(
          seller
            ? `Hiện chưa tìm thấy sản phẩm phù hợp của ${seller.FullName}.`
            : 'Hiện chưa tìm thấy sản phẩm phù hợp trong Chợ Đồ Cũ.'
        );
      }

      const conditionOptions = await getConditionOptions([product]);
      const label = intent === 'CHEAPEST' ? 'rẻ nhất' : 'đắt nhất';

      return reply(
        `Sản phẩm ${label}${keyword ? ` trong nhóm "${keyword}"` : ''} là:\n${product.Title}\n${listingFacts(product, conditionOptions)}`,
        productCards([product])
      );
    }

    if (
      !seller &&
      !keyword &&
      !price &&
      !hasSearchIntent(message)
    ) {
      return reply(
        'Mình có thể tìm sản phẩm theo tên, giá hoặc người bán. Ví dụ: "Tìm điện thoại dưới 500k" hoặc "Chị Ngọc Anh bán gì?".'
      );
    }

    // Tránh tự liệt kê sản phẩm khi câu hỏi quá mơ hồ
    if (
      !seller &&
      !keyword &&
      !price
    ) {
      return reply(
        'Bạn muốn tìm loại sản phẩm nào? Ví dụ: điện thoại, laptop hoặc sản phẩm dưới 300k.'
      );
    }

    const candidates = await Listings.findAll({
      where,
      attributes: LISTING_ATTRIBUTES,
      order: [['Price', 'ASC']],
      limit: 1000
    });

    const products = candidates
      .filter(product =>
        matchProduct(product, keyword)
      )
      .slice(0, 5);

    if (!products.length) {
      return reply(
        seller
          ? `Hiện chưa tìm thấy sản phẩm phù hợp của ${seller.FullName}. Mình sẽ không lấy sản phẩm của người bán khác để thay thế.`
          : 'Hiện chưa tìm thấy sản phẩm phù hợp trong Chợ Đồ Cũ. Bạn thử từ khóa hoặc khoảng giá khác nhé.'
      );
    }

    const intro = aiUnavailable
      ? 'Mình tìm được kết quả theo từ khóa nhận diện:'
      : seller
      ? `Sản phẩm của ${seller.FullName}:`
      : intent === 'AVAILABILITY'
      ? availability === 'UNAVAILABLE'
        ? 'Các sản phẩm đã có người đặt hoặc đã bán:'
        : availability === 'AVAILABLE'
        ? 'Các sản phẩm đang còn hàng:'
        : 'Các tin phù hợp; trạng thái hiển thị bên dưới:'
      : 'Mình tìm thấy các sản phẩm phù hợp:';

    const conditionOptions = await getConditionOptions(products);
    const lines = products.map((product, index) =>
      `${index + 1}. ${product.Title}\n` +
      `Giá: ${moneyText(product.Price)}\n` +
      `Trạng thái tin: ${listingStatusLabels[product.Status] || 'Không rõ'}\n` +
      `Tình trạng: ${getConditionLabel(product, conditionOptions)}`
    );

    return reply(
      intro +
      '\n\n' +
      lines.join('\n\n') +
      '\n\nBạn có thể bấm vào sản phẩm để xem chi tiết.',
      productCards(products)
    );

  } catch (error) {
    console.error('Chatbot error:', error);

    return res.status(500).json({
      success: false,
      message: 'Chatbot đang gặp lỗi xử lý. Vui lòng thử lại.'
    });
  }
});

module.exports = router;
