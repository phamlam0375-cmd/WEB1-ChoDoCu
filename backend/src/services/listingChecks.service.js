"use strict";

// B05: kiểm tra tự động một tin đăng (không cần AI), hiện trong trang kiểm duyệt để quản trị tham khảo.
// Phát hiện tin trùng lặp và các lỗi hay gặp: thông tin liên hệ trong tin, thiếu ảnh, tiêu đề không dấu.
const { Op } = require("sequelize");
const { Listings, ListingMedia, Users } = require("../models");

// Trạng thái tin còn "sống": tin mới trùng với các tin này thì cần xem lại.
const LIVE_STATUSES = ["PENDING", "ACTIVE", "RESERVED", "HIDDEN", "SUSPENDED"];
const SAME_SELLER_SIMILARITY = 0.6;
const OTHER_SELLER_SIMILARITY = 0.85;
const MAX_CANDIDATES = 300;
const MAX_DUPLICATES = 5;

// Bỏ dấu, chữ thường, chỉ giữ chữ và số.
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (value) => new Set(normalize(value).split(" ").filter((word) => word.length > 1));

// Độ giống nhau của hai tiêu đề theo tập từ (Jaccard), từ 0 đến 1.
const titleSimilarity = (a, b) => {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / (left.size + right.size - common);
};

const findDuplicates = async (listing) => {
  const candidates = await Listings.findAll({
    where: {
      ListingId: { [Op.ne]: listing.ListingId },
      Status: { [Op.in]: LIVE_STATUSES },
      [Op.or]: [{ SellerId: listing.SellerId }, { Price: listing.Price }],
    },
    attributes: ["ListingId", "SellerId", "Title", "Price", "Status", "CreatedAt"],
    include: [{ model: Users, as: "Seller", attributes: ["UserId", "FullName"] }],
    order: [["CreatedAt", "DESC"]],
    limit: MAX_CANDIDATES,
  });

  return candidates
    .map((item) => {
      const sameSeller = item.SellerId === listing.SellerId;
      const similarity = titleSimilarity(listing.Title, item.Title);
      const samePrice = Number(item.Price) === Number(listing.Price);
      // Người bán khác: chỉ coi là trùng khi tiêu đề gần như y hệt và cùng giá (nghi dùng nhiều tài khoản).
      const match = sameSeller ? similarity >= SAME_SELLER_SIMILARITY : samePrice && similarity >= OTHER_SELLER_SIMILARITY;
      return match
        ? {
            ListingId: item.ListingId,
            Title: item.Title,
            Price: item.Price,
            Status: item.Status,
            Seller: item.Seller,
            sameSeller,
            samePrice,
            similarity: Math.round(similarity * 100),
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_DUPLICATES);
};

const PHONE = /(?:\+?84|0)(?:[\s.-]?\d){8,10}/;
const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|vn|net|org|me|ly)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const SOCIAL = /\b(?:zalo|facebook|fb\.com|messenger|telegram)\b/i;
const VIETNAMESE_MARKS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const COMMON_UNMARKED_WORDS = new Set([
  "ban", "can", "moi", "cu", "con", "dien", "thoai", "may", "tinh", "xe", "ao", "quan", "giay", "dep",
  "nha", "sach", "dong", "ho", "tu", "lanh", "gia", "re", "hang", "chinh", "hieu", "nhu", "dung", "bao", "hanh",
  "ghe", "giat", "noi", "com", "nuoc", "tre", "em", "nu", "nam", "thanh", "ly", "lai",
]);

const contactWarnings = (listing) => {
  const warnings = [];
  const fields = [
    ["tiêu đề", listing.Title],
    ["mô tả", listing.Description],
  ];
  for (const [label, value] of fields) {
    const found = [
      PHONE.test(value || "") && "số điện thoại",
      EMAIL.test(value || "") && "email",
      URL.test(value || "") && "đường link",
      SOCIAL.test(value || "") && "mạng xã hội",
    ].filter(Boolean);
    if (found.length) {
      warnings.push({ code: "CONTACT_INFO", message: `Phần ${label} có ${found.join(", ")} — có thể kéo người mua giao dịch ngoài website.` });
    }
  }
  return warnings;
};

// Trả { duplicates, warnings } cho trang chi tiết tin.
const checkListing = async (listing) => {
  const duplicates = await findDuplicates(listing);
  const warnings = [];

  if (duplicates.length) {
    const sameSeller = duplicates.filter((item) => item.sameSeller).length;
    const otherSeller = duplicates.length - sameSeller;
    if (sameSeller) {
      warnings.push({ code: "DUPLICATE", message: `Có ${sameSeller} tin khác của cùng người bán với tiêu đề gần giống (kể cả tin đã ẩn).` });
    }
    if (otherSeller) {
      warnings.push({ code: "DUPLICATE", message: `Có ${otherSeller} tin của người bán khác trùng tiêu đề và giá — nghi đăng bằng nhiều tài khoản.` });
    }
  }

  warnings.push(...contactWarnings(listing));

  const mediaCount = Array.isArray(listing.Media)
    ? listing.Media.length
    : await ListingMedia.count({ where: { ListingId: listing.ListingId } });
  if (mediaCount === 0) warnings.push({ code: "NO_IMAGE", message: "Tin không có ảnh sản phẩm." });

  // Chỉ báo khi tiêu đề không có dấu nhưng chứa từ tiếng Việt thường gặp (tránh báo nhầm tên hàng tiếng Anh).
  const unmarkedWords = [...tokens(listing.Title)].filter((word) => COMMON_UNMARKED_WORDS.has(word)).length;
  if (!VIETNAMESE_MARKS.test(listing.Title) && unmarkedWords >= 2) {
    warnings.push({ code: "NO_DIACRITICS", message: "Tiêu đề viết tiếng Việt không dấu, khó tìm kiếm." });
  }

  if (normalize(listing.Description).length < 20) {
    warnings.push({ code: "SHORT_DESCRIPTION", message: "Mô tả quá ngắn, thiếu thông tin về tình trạng và lý do bán." });
  }

  return { duplicates, warnings };
};

module.exports = { checkListing, titleSimilarity, normalize };
