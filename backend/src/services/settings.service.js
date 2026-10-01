"use strict";

const { Op } = require("sequelize");
const { sequelize, SystemSettings, AdminAuditLogs, Users } = require("../models");
const { badRequest } = require("../utils/httpError");
const { logAdminAction } = require("./auditLog.service");

// B12: các quy tắc hệ thống admin được sửa trên giao diện. Mỗi mục có kiểu,
// khoảng giá trị hợp lệ và giá trị mặc định (dùng khi DB chưa có dòng tương ứng).
const SETTING_GROUPS = {
  COMMISSION: "Hoa hồng và công nợ",
  REFUND: "Hoàn tiền",
  FEE_BANK: "Tài khoản nhận phí của website",
};

const SETTING_DEFINITIONS = [
  {
    key: "COMMISSION_RATE",
    group: "COMMISSION",
    label: "Tỷ lệ hoa hồng mặc định",
    description: "Áp cho đơn đặt sau khi lưu. Đơn đã đặt giữ tỷ lệ đã chốt trên đơn.",
    type: "decimal",
    unit: "%",
    min: 0,
    max: 30,
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
    max: 60,
    defaultValue: "7",
  },
  {
    key: "SELLER_DEBT_LIMIT",
    group: "COMMISSION",
    label: "Ngưỡng nợ phí của người bán",
    description: "Người bán có tổng phí chưa nộp vượt ngưỡng sẽ bị đánh dấu cần nộp phí.",
    type: "integer",
    unit: "đ",
    min: 0,
    max: 100000000,
    defaultValue: "5000000",
  },
  {
    key: "REFUND_WINDOW_DAYS",
    group: "REFUND",
    label: "Hạn gửi yêu cầu hoàn tiền",
    description: "Số ngày kể từ khi đơn hoàn tất. Áp cho đơn đặt sau khi lưu.",
    type: "integer",
    unit: "ngày",
    min: 1,
    max: 30,
    defaultValue: "7",
  },
  {
    key: "FEE_BANK_NAME",
    group: "FEE_BANK",
    label: "Ngân hàng",
    description: "Hiển thị cho người bán khi nộp hoa hồng.",
    type: "text",
    minLength: 2,
    maxLength: 80,
    defaultValue: "Vietcombank",
  },
  {
    key: "FEE_BANK_ACCOUNT_NUMBER",
    group: "FEE_BANK",
    label: "Số tài khoản",
    description: "Chỉ gồm chữ số.",
    type: "text",
    pattern: /^\d{6,20}$/,
    patternMessage: "Số tài khoản ngân hàng phải gồm 6–20 chữ số",
    defaultValue: "0123456789",
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
    defaultValue: "CHO DO CU",
  },
];

const DEFINITION_BY_KEY = Object.fromEntries(SETTING_DEFINITIONS.map((item) => [item.key, item]));

const toTyped = (definition, raw) =>
  definition.type === "text" ? raw : Number(raw);

// Kiểm tra và chuẩn hóa giá trị người dùng nhập, trả về chuỗi để lưu DB.
const normalizeValue = (definition, input) => {
  if (definition.type === "text") {
    let value = typeof input === "string" ? input.trim() : String(input ?? "").trim();
    if (definition.transform) value = definition.transform(value);
    if (!value) throw badRequest(`${definition.label}: không được để trống`);
    if (definition.minLength && value.length < definition.minLength) {
      throw badRequest(`${definition.label}: tối thiểu ${definition.minLength} ký tự`);
    }
    if (definition.maxLength && value.length > definition.maxLength) {
      throw badRequest(`${definition.label}: tối đa ${definition.maxLength} ký tự`);
    }
    if (definition.pattern && !definition.pattern.test(value)) {
      throw badRequest(definition.patternMessage);
    }
    return value;
  }

  const number = typeof input === "number" ? input : Number(String(input ?? "").trim());
  if (input === "" || input === null || input === undefined || !Number.isFinite(number)) {
    throw badRequest(`${definition.label}: phải là số`);
  }
  if (definition.type === "integer" && !Number.isInteger(number)) {
    throw badRequest(`${definition.label}: phải là số nguyên`);
  }
  if (definition.type === "decimal" && Number(number.toFixed(2)) !== number) {
    throw badRequest(`${definition.label}: tối đa 2 chữ số thập phân`);
  }
  if (number < definition.min || number > definition.max) {
    throw badRequest(
      `${definition.label}: phải từ ${definition.min.toLocaleString("vi-VN")} đến ${definition.max.toLocaleString("vi-VN")}${definition.unit ? ` ${definition.unit}` : ""}`
    );
  }
  return String(number);
};

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

  return SETTING_DEFINITIONS.map((definition) => {
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
      value: toTyped(definition, row ? row.SettingValue : definition.defaultValue),
      updatedAt: row ? row.UpdatedAt : null,
      updatedBy: row && row.Updater ? row.Updater.FullName : null,
    };
  });
};

// Lưu các thay đổi, mỗi thay đổi ghi một dòng nhật ký "giá trị cũ → giá trị mới".
const updateSettings = async (req, changes, reason) => {
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
  updateSettings,
};
