"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, SystemSettings, AdminAuditLogs, Users } = require("../models");
const { badRequest, conflict } = require("../utils/httpError");
const { BANKS, BANK_BY_CODE } = require("../utils/banks");
const { logAdminAction } = require("./auditLog.service");

// Cấu hình quy tắc hệ thống: quản trị sửa trên giao diện. Mỗi mục có kiểu,
// khoảng giá trị hợp lệ và giá trị mặc định (dùng khi DB chưa có dòng tương ứng).
const SETTING_GROUPS = {
  COMMISSION: "Hoa hồng và công nợ",
  ORDER: "Đơn hàng và tin VIP",
  REFUND: "Hoàn tiền",
  FEE_BANK: "Tài khoản nhận phí của website",
};

const EMPTY_MESSAGE = "Vui lòng nhập giá trị";
const POSITIVE_MESSAGE = "Giá trị phải là số lớn hơn 0";

const SETTING_DEFINITIONS = [
  {
    key: "COMMISSION_RATE",
    group: "COMMISSION",
    label: "Tỷ lệ hoa hồng",
    description: "Áp cho đơn đặt sau khi lưu. Đơn đã đặt giữ tỷ lệ đã chốt trên đơn.",
    type: "decimal",
    unit: "%",
    min: 0,
    max: 100,
    invalidMessage: "Tỷ lệ hoa hồng phải từ 0 đến 100%",
    defaultValue: "5",
  },
  {
    key: "COMMISSION_DUE_DAYS",
    group: "COMMISSION",
    label: "Hạn nộp hoa hồng",
    description: "Số ngày kể từ khi đơn hoàn tất. Áp cho khoản hoa hồng phát sinh sau khi lưu.",
    type: "integer",
    unit: "ngày",
    min: 1,
    max: 365,
    invalidMessage: POSITIVE_MESSAGE,
    defaultValue: "7",
  },
  {
    key: "SELLER_DEBT_LIMIT",
    group: "COMMISSION",
    label: "Ngưỡng nợ phí của người bán",
    description: "Người bán có tổng phí chưa nộp vượt ngưỡng sẽ bị đánh dấu cần nộp phí.",
    type: "integer",
    unit: "đ",
    min: 1,
    max: 1000000000,
    invalidMessage: POSITIVE_MESSAGE,
    defaultValue: "5000000",
  },
  {
    key: "VIP_FEE",
    group: "ORDER",
    label: "Phí tin VIP",
    description: "Phí người bán nộp cho mỗi lượt đẩy tin VIP (gói 7 ngày).",
    type: "integer",
    unit: "đ",
    min: 1,
    max: 100000000,
    invalidMessage: POSITIVE_MESSAGE,
    defaultValue: "40000",
  },
  {
    key: "RESERVATION_HOURS",
    group: "ORDER",
    label: "Thời gian giữ món",
    description: "Thời gian sản phẩm được giữ cho người mua sau khi đặt hàng.",
    type: "integer",
    unit: "giờ",
    min: 1,
    max: 720,
    invalidMessage: POSITIVE_MESSAGE,
    defaultValue: "24",
  },
  {
    key: "REFUND_WINDOW_DAYS",
    group: "REFUND",
    label: "Hạn yêu cầu hoàn tiền",
    description: "Số ngày kể từ khi đơn hoàn tất. Áp cho đơn đặt sau khi lưu.",
    type: "integer",
    unit: "ngày",
    min: 1,
    max: 365,
    invalidMessage: POSITIVE_MESSAGE,
    defaultValue: "7",
  },
  {
    key: "FEE_BANK_CODE",
    group: "FEE_BANK",
    label: "Ngân hàng",
    description: "Dùng để tạo mã QR chuyển khoản (VietQR) khi người bán nộp phí.",
    type: "bank",
    options: BANKS.map((bank) => ({ value: bank.code, label: `${bank.shortName} — ${bank.name}` })),
    defaultValue: "970418",
  },
  {
    key: "FEE_BANK_ACCOUNT_NUMBER",
    group: "FEE_BANK",
    label: "Số tài khoản",
    description: "Chỉ gồm chữ số.",
    type: "text",
    pattern: /^\d{6,20}$/,
    patternMessage: "Số tài khoản ngân hàng phải gồm 6–20 chữ số",
    defaultValue: "5811768917",
  },
  {
    key: "FEE_BANK_ACCOUNT_HOLDER",
    group: "FEE_BANK",
    label: "Chủ tài khoản",
    description: "Viết HOA không dấu, đúng như tên trên ngân hàng.",
    type: "text",
    transform: (value) => value.toUpperCase().replace(/\s+/g, " "),
    pattern: /^[A-Z][A-Z ]{1,99}$/,
    patternMessage: "Tên chủ tài khoản chỉ gồm chữ HOA không dấu và khoảng trắng (2–100 ký tự)",
    defaultValue: "NGUYEN DUY TUNG",
  },
];

const DEFINITION_BY_KEY = Object.fromEntries(SETTING_DEFINITIONS.map((item) => [item.key, item]));

const isNumeric = (definition) => definition.type === "integer" || definition.type === "decimal";

const toTyped = (definition, raw) => (isNumeric(definition) ? Number(raw) : raw);

// Kiểm tra và chuẩn hóa giá trị người dùng nhập, trả về chuỗi để lưu DB.
const normalizeValue = (definition, input) => {
  const rawText = typeof input === "string" ? input.trim() : String(input ?? "").trim();
  if (!rawText) throw badRequest(`${definition.label}: ${EMPTY_MESSAGE}`);

  if (definition.type === "bank") {
    if (!BANK_BY_CODE[rawText]) throw badRequest(`${definition.label}: ngân hàng không được hỗ trợ`);
    return rawText;
  }

  if (definition.type === "text") {
    const value = definition.transform ? definition.transform(rawText) : rawText;
    if (definition.pattern && !definition.pattern.test(value)) {
      throw badRequest(definition.patternMessage);
    }
    return value;
  }

  // Chỉ chấp nhận chữ số (và dấu thập phân với tỷ lệ), không nhận chữ hay ký hiệu.
  const pattern = definition.type === "integer" ? /^-?\d+$/ : /^-?\d+([.,]\d{1,2})?$/;
  const number = Number(rawText.replace(",", "."));
  const invalid =
    !pattern.test(rawText) || !Number.isFinite(number) || number < definition.min ||
    (definition.min > 0 ? number <= 0 : false);
  if (invalid) throw badRequest(`${definition.label}: ${definition.invalidMessage}`);
  if (number > definition.max) {
    throw badRequest(
      definition.key === "COMMISSION_RATE"
        ? definition.invalidMessage
        : `${definition.label}: tối đa ${definition.max.toLocaleString("vi-VN")} ${definition.unit}`
    );
  }
  return String(number);
};

// Mã phiên bản của toàn bộ cấu hình: đổi khi bất kỳ giá trị nào thay đổi. Giao diện gửi kèm
// khi lưu để phát hiện quản trị viên khác đã sửa trước đó.
const versionOf = (rows) =>
  crypto
    .createHash("sha1")
    .update(
      rows
        .map((row) => `${row.SettingKey}=${row.SettingValue}@${row.UpdatedAt ? new Date(row.UpdatedAt).getTime() : 0}`)
        .sort()
        .join("|")
    )
    .digest("hex")
    .slice(0, 16);

const readRows = (transaction) => SystemSettings.findAll({ transaction });

// Giá trị hiện hành của mọi cấu hình, dạng { KEY: value } đã đúng kiểu.
const getSettingsMap = async ({ transaction } = {}) => {
  const rows = await readRows(transaction);
  const stored = Object.fromEntries(rows.map((row) => [row.SettingKey, row.SettingValue]));
  return Object.fromEntries(
    SETTING_DEFINITIONS.map((definition) => [
      definition.key,
      toTyped(definition, stored[definition.key] ?? definition.defaultValue),
    ])
  );
};

const getSetting = async (key, options) => {
  if (!DEFINITION_BY_KEY[key]) throw new Error(`Cấu hình không tồn tại: ${key}`);
  const map = await getSettingsMap(options);
  return map[key];
};

// Giá trị cấu hình có hiệu lực tại một thời điểm. Vì mỗi lần đổi đều được ghi
// nhật ký "cũ → mới" (và nhật ký không sửa được), giá trị tại thời điểm T chính
// là giá trị cũ của lần đổi đầu tiên sau T; không có lần đổi nào thì là giá trị hiện tại.
// Dùng để quy tắc mới chỉ áp cho đơn/khoản phát sinh sau khi lưu.
const getSettingAt = async (key, at, { transaction } = {}) => {
  const definition = DEFINITION_BY_KEY[key];
  if (!definition) throw new Error(`Cấu hình không tồn tại: ${key}`);
  if (!at) return getSetting(key, { transaction });

  const firstChangeAfter = await AdminAuditLogs.findOne({
    where: {
      Action: "SETTING_UPDATE",
      TargetType: "SETTING",
      TargetId: key,
      CreatedAt: { [Op.gt]: at },
    },
    order: [["CreatedAt", "ASC"], ["LogId", "ASC"]],
    transaction,
  });

  if (firstChangeAfter && firstChangeAfter.OldValue !== null) {
    return toTyped(definition, firstChangeAfter.OldValue);
  }
  return getSetting(key, { transaction });
};

const listSettings = async () => {
  const rows = await SystemSettings.findAll({
    include: [{ model: Users, as: "Updater", attributes: ["UserId", "FullName"] }],
  });
  const byKey = Object.fromEntries(rows.map((row) => [row.SettingKey, row]));

  const items = SETTING_DEFINITIONS.map((definition) => {
    const row = byKey[definition.key];
    return {
      key: definition.key,
      group: definition.group,
      groupLabel: SETTING_GROUPS[definition.group],
      label: definition.label,
      description: definition.description,
      type: definition.type,
      unit: definition.unit || null,
      min: definition.min ?? null,
      max: definition.max ?? null,
      minLength: definition.minLength ?? null,
      maxLength: definition.maxLength ?? null,
      pattern: definition.pattern ? definition.pattern.source : null,
      patternMessage: definition.patternMessage || null,
      invalidMessage: definition.invalidMessage || null,
      options: definition.options || null,
      value: toTyped(definition, row ? row.SettingValue : definition.defaultValue),
      updatedAt: row ? row.UpdatedAt : null,
      updatedBy: row && row.Updater ? row.Updater.FullName : null,
    };
  });
  return { version: versionOf(rows), items };
};

// Lưu các thay đổi, mỗi thay đổi ghi một dòng nhật ký "giá trị cũ → giá trị mới".
const updateSettings = async (req, changes, reason, version) => {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw badRequest("Dữ liệu cấu hình không hợp lệ");
  }

  const keys = Object.keys(changes);
  const unknown = keys.filter((key) => !DEFINITION_BY_KEY[key]);
  if (unknown.length) throw badRequest(`Cấu hình không tồn tại: ${unknown.join(", ")}`);

  const normalized = keys.map((key) => ({
    definition: DEFINITION_BY_KEY[key],
    value: normalizeValue(DEFINITION_BY_KEY[key], changes[key]),
  }));

  return sequelize.transaction(async (transaction) => {
    const rows = await SystemSettings.findAll({ transaction, lock: transaction.LOCK.UPDATE });
    if (version !== versionOf(rows)) {
      throw conflict("Cấu hình đã được người khác thay đổi, vui lòng tải lại trang trước khi lưu");
    }
    const byKey = Object.fromEntries(rows.map((row) => [row.SettingKey, row]));
    const now = new Date();
    const applied = [];

    for (const { definition, value } of normalized) {
      const row = byKey[definition.key];
      const oldValue = row ? row.SettingValue : definition.defaultValue;
      if (oldValue === value) continue;

      if (row) {
        await row.update({ SettingValue: value, UpdatedBy: req.user.UserId, UpdatedAt: now }, { transaction });
      } else {
        await SystemSettings.create(
          { SettingKey: definition.key, SettingValue: value, UpdatedBy: req.user.UserId, UpdatedAt: now },
          { transaction }
        );
      }

      await logAdminAction(
        req,
        {
          action: "SETTING_UPDATE",
          targetType: "SETTING",
          targetId: definition.key,
          oldValue,
          newValue: value,
          note: reason,
        },
        { transaction }
      );
      applied.push({ key: definition.key, label: definition.label, oldValue, newValue: value });
    }

    if (!applied.length) throw badRequest("Không có giá trị nào thay đổi");
    return applied;
  });
};

module.exports = {
  SETTING_DEFINITIONS,
  getSetting,
  getSettingAt,
  getSettingsMap,
  listSettings,
  EMPTY_MESSAGE,
  updateSettings,
};
