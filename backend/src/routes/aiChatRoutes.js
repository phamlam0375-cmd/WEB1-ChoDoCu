
'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { Listings, Users } = require('../models');

const router = express.Router();

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

const formatPrice = (value) =>
  Number(value).toLocaleString('vi-VN') + 'đ';

function parseMoney(value, unit = '') {
  const number = Number(String(value).replace(',', '.'));
  const normalizedUnit = normalize(unit);

  if (['k', 'nghin', 'ngan'].includes(normalizedUnit)) {
    return number * 1000;
  }

  if (['tr', 'trieu', 'm'].includes(normalizedUnit)) {
    return number * 1000000;
  }

  return number;
}

const MONEY_UNIT = '(trieu|tr|nghin|ngan|k|m)';
const MONEY_VALUE = '(\\d+(?:[.,]\\d+)?)';

function extractPrice(text) {
  const input = normalize(text);

  const rangeRegex = new RegExp(
    `${MONEY_VALUE}\\s*${MONEY_UNIT}?\\s*(?:-|den|toi)\\s*${MONEY_VALUE}\\s*${MONEY_UNIT}?`,
    'i'
  );

  const range = input.match(rangeRegex);

  if (range) {
    const firstUnit = range[2] || range[4] || '';
    const secondUnit = range[4] || range[2] || '';

    const min = parseMoney(range[1], firstUnit);
    const max = parseMoney(range[3], secondUnit);

    return {
      min: Math.min(min, max),
      max: Math.max(min, max)
    };
  }

  const underRegex = new RegExp(
    `(?:duoi|khong qua|toi da|re hon)\\s*${MONEY_VALUE}\\s*${MONEY_UNIT}?`,
    'i'
  );

  const under = input.match(underRegex);

  if (under) {
    return {
      max: parseMoney(under[1], under[2])
    };
  }

  const overRegex = new RegExp(
    `(?:tren|tu|it nhat)\\s*${MONEY_VALUE}\\s*${MONEY_UNIT}`,
    'i'
  );

  const over = input.match(overRegex);

  if (over) {
    return {
      min: parseMoney(over[1], over[2])
    };
  }

  return null;
}

function getCasualReply(text) {
  const input = normalize(text).replace(/[!?.,]/g, '');

  if (/^(xin chao|chao|hello|hi|hey|alo)( ban| shop| ad| nha)?$/.test(input)) {
    return 'Xin chào bạn! 👋 Mình là trợ lý tư vấn của Chợ Đồ Cũ. Bạn muốn tìm sản phẩm gì hôm nay?';
  }

  if (/^(cam on|thanks|thank you)( ban| nha| nhe| a)?$/.test(input)) {
    return 'Không có gì đâu ạ! ❤️ Bạn cần tìm sản phẩm gì cứ hỏi mình nhé!';
  }

  if (/^(ban la ai|ban ten gi|ai day)$/.test(input)) {
    return 'Mình là trợ lý tư vấn sản phẩm của Chợ Đồ Cũ. Mình có thể giúp bạn tìm sản phẩm theo giá, tên người bán và nhu cầu.';
  }

  return null;
}

function extractSellerName(text) {
  const input = normalize(text);

  const patterns = [
    /(?:anh|chi|ban|nguoi ban)\s+(.+?)\s+(?:dang ban gi|ban gi|co ban gi|co nhung gi|co san pham gi|co mon gi)/,
    /(?:san pham cua|do cua)\s+(.+?)(?:\s+(?:gia|duoi|tren|tu)\s+|$)/,
    /(.+?)\s+(?:dang ban gi|ban gi|co ban gi|co san pham gi|co mon gi)/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function extractKeyword(text) {
  const input = normalize(text);

  const keywords = [
    'iphone', 'samsung', 'oppo', 'xiaomi',
    'realme', 'vivo', 'nokia',
    'laptop', 'dien thoai', 'may tinh',
    'tai nghe', 'ban phim', 'chuot',
    'ao', 'giay', 'tui xach', 'xe dap',
    'messi', 'ronaldo'
  ];

  return keywords.find((word) => input.includes(word)) || null;
}

function hasSearchIntent(text) {
  const input = normalize(text);

  return /\b(mua|tim|ban|san pham|mon|do|gia|co gi|can|kiem|goi y|tu van)\b/.test(input);
}

router.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();

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

    const casualReply = getCasualReply(message);

    if (casualReply) {
      return res.json({
        success: true,
        reply: casualReply,
        products: []
      });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-10)
      : [];

    const previousUserMessages = history
      .filter((item) => item?.role === 'user')
      .map((item) => String(item.content || ''));

    const normalizedMessage = normalize(message);
    const cheaperRequest =
      /(?:re hon|thap hon|gia mem hon)/.test(normalizedMessage);

    const currentPrice = extractPrice(message);
    const currentSeller = extractSellerName(message);
    const currentKeyword = extractKeyword(message);

    let price = currentPrice;
    let sellerName = currentSeller;
    let keyword = currentKeyword;

    if (cheaperRequest && !currentPrice) {
      const previousPrice = previousUserMessages
        .slice()
        .reverse()
        .map(extractPrice)
        .find(Boolean);

      if (previousPrice) {
        price = {
          max: previousPrice.min || previousPrice.max
        };
      }
    }

    if (cheaperRequest) {
      for (const previous of previousUserMessages.slice().reverse()) {
        if (!sellerName) {
          sellerName = extractSellerName(previous);
        }

        if (!keyword) {
          keyword = extractKeyword(previous);
        }
      }
    }

    if (
      !hasSearchIntent(message) &&
      !currentPrice &&
      !currentSeller &&
      !currentKeyword &&
      !cheaperRequest
    ) {
      return res.json({
        success: true,
        reply: 'Mình có thể giúp bạn tìm sản phẩm theo tên, ngân sách hoặc người đăng bán. Bạn đang muốn tìm gì ạ?',
        products: []
      });
    }

    const where = {
      Status: 'ACTIVE'
    };

    if (price) {
      where.Price = {};

      if (price.min !== undefined) {
        where.Price[Op.gte] = price.min;
      }

      if (price.max !== undefined) {
        where.Price[Op.lte] = price.max;
      }
    }

    if (keyword) {
      where[Op.or] = [
        { Title: { [Op.like]: `%${keyword}%` } },
        { Description: { [Op.like]: `%${keyword}%` } }
      ];
    }

    let seller = null;

    if (sellerName) {
      const sellers = await Users.findAll({
        where: {
          Status: 'ACTIVE',
          FullName: {
            [Op.like]: `%${sellerName}%`
          }
        },
        attributes: ['UserId', 'FullName'],
        limit: 5
      });

      if (sellers.length === 0) {
        return res.json({
          success: true,
          reply: `Mình chưa tìm thấy người bán tên "${sellerName}". Bạn thử nhập tên đầy đủ hơn nhé!`,
          products: []
        });
      }

      if (sellers.length > 1) {
        return res.json({
          success: true,
          reply:
            'Mình tìm thấy nhiều người bán trùng tên:\n\n' +
            sellers.map((user, index) =>
              `${index + 1}. ${user.FullName} (ID: ${user.UserId})`
            ).join('\n') +
            '\n\nBạn muốn tìm sản phẩm của người nào?',
          products: []
        });
      }

      seller = sellers[0];
      where.SellerId = seller.UserId;
    }

    const products = await Listings.findAll({
      where,
      attributes: [
        'ListingId',
        'SellerId',
        'Title',
        'Description',
        'Price',
        'ConditionLevel'
      ],
      order: [['Price', 'ASC']],
      limit: 5
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        reply: 'Hiện mình chưa tìm thấy sản phẩm phù hợp với yêu cầu của bạn. Bạn muốn thử mức giá hoặc từ khóa khác không?',
        products: []
      });
    }

    const productLines = products.map((product, index) =>
      `${index + 1}. ${product.Title}\n` +
      `Giá: ${formatPrice(product.Price)}\n` +
      `Tình trạng: ${product.ConditionLevel}`
    );

    const intro = seller
      ? `Người bán ${seller.FullName} hiện có các sản phẩm phù hợp:`
      : `Mình tìm thấy ${products.length} sản phẩm phù hợp:`;

    return res.json({
      success: true,
      reply:
        `${intro}\n\n` +
        productLines.join('\n\n') +
        '\n\nBạn muốn xem chi tiết sản phẩm nào?',
      products: products.map((product) => ({
        id: product.ListingId,
        name: product.Title,
        price: Number(product.Price),
        url: `/products/${product.ListingId}`
      }))
    });

  } catch (error) {
    console.error('AI chat error:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể xử lý yêu cầu tư vấn lúc này'
    });
  }
});

module.exports = router;
