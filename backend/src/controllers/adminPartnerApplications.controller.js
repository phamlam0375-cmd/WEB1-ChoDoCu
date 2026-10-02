"use strict";

// Duyệt đăng ký đối tác (hồ sơ do người dùng gửi ở trang đăng ký đối tác). Xét duyệt thủ công, không OCR/eKYC.
const { Op, fn, col } = require("sequelize");
const { sequelize, PartnerApplications, Users, Roles, UserRoles } = require("../models");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, text, oneOf } = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");

const STATUSES = ["PENDING", "NEED_INFO", "APPROVED", "REJECTED"];
const PARTNER_TYPES = ["SELLER", "DRIVER"];
const REVIEWABLE = ["PENDING", "NEED_INFO"];
const PARTNER_LABEL = { SELLER: "người bán", DRIVER: "tài xế" };

const DECISIONS = {
  APPROVED: { audit: "PARTNER_APPROVE", title: "Hồ sơ đối tác đã được duyệt" },
  REJECTED: { audit: "PARTNER_REJECT", title: "Hồ sơ đối tác bị từ chối" },
  NEED_INFO: { audit: "PARTNER_NEED_INFO", title: "Hồ sơ đối tác cần bổ sung" },
};

const applicantInclude = {
  model: Users,
  as: "Applicant",
  attributes: ["UserId", "FullName", "Email", "Phone", "EmailVerified", "PhoneVerified", "Status"],
};
const reviewerInclude = { model: Users, as: "Reviewer", attributes: ["UserId", "FullName"] };

const listApplications = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = {};
  if (req.query.status) where.Status = oneOf(req.query.status, STATUSES, "Trạng thái");
  if (req.query.type) where.PartnerType = oneOf(req.query.type, PARTNER_TYPES, "Loại đối tác");

  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [
      { "$Applicant.FullName$": like },
      { "$Applicant.Email$": like },
      { "$Applicant.Phone$": like },
      ...(/^\d+$/.test(q) ? [{ ApplicationId: Number(q) }] : []),
    ];
  }

  const [result, counts] = await Promise.all([
    PartnerApplications.findAndCountAll({
      where,
      include: [applicantInclude, reviewerInclude],
      order: [["SubmittedAt", "DESC"], ["ApplicationId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
    }),
    PartnerApplications.findAll({
      attributes: ["Status", [fn("COUNT", col("ApplicationId")), "count"]],
      group: ["Status"],
      raw: true,
    }),
  ]);

  return pagedResponse(res, result, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
  });
};

const getApplication = async (req, res) => {
  const id = parseId(req.params.id, "Mã hồ sơ");
  const application = await PartnerApplications.findByPk(id, { include: [applicantInclude, reviewerInclude] });
  if (!application) throw notFound("Không tìm thấy hồ sơ đối tác");

  const [history, currentRoles] = await Promise.all([
    PartnerApplications.findAll({
      where: { UserId: application.UserId, ApplicationId: { [Op.ne]: id } },
      attributes: ["ApplicationId", "PartnerType", "Status", "ReviewNote", "SubmittedAt", "ReviewedAt"],
      order: [["SubmittedAt", "DESC"]],
    }),
    Roles.findAll({
      include: [{ model: Users, as: "Users", where: { UserId: application.UserId }, attributes: [], through: { attributes: [] } }],
      attributes: ["RoleName"],
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: { ...application.get({ plain: true }), history, currentRoles: currentRoles.map((role) => role.RoleName) },
  });
};

// PATCH { status: APPROVED | REJECTED | NEED_INFO, note }
const reviewApplication = async (req, res) => {
  const id = parseId(req.params.id, "Mã hồ sơ");
  const status = oneOf(req.body.status, Object.keys(DECISIONS), "Kết quả xét duyệt");
  const note = text(req.body.note, "ghi chú", { max: 500 });
  if (!note && status === "REJECTED") throw badRequest("Vui lòng nhập lý do từ chối");
  if (!note && status === "NEED_INFO") throw badRequest("Vui lòng nhập nội dung cần bổ sung");

  const application = await sequelize.transaction(async (transaction) => {
    const item = await PartnerApplications.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy hồ sơ đối tác");
    // expectedStatus: trạng thái giao diện đang hiển thị; khác nghĩa là quản trị khác đã xử lý.
    const expectedStatus = req.body.expectedStatus;
    if (!REVIEWABLE.includes(item.Status) || (expectedStatus && expectedStatus !== item.Status) || status === item.Status) {
      throw conflict("Hồ sơ đã được xử lý, vui lòng tải lại trang");
    }
    if (status === "APPROVED") {
      const applicant = await Users.findByPk(item.UserId, { attributes: ["EmailVerified", "PhoneVerified"], transaction });
      if (!applicant || !applicant.EmailVerified || !applicant.PhoneVerified) {
        throw badRequest("Hồ sơ chưa xác thực email hoặc số điện thoại, không thể duyệt");
      }
    }

    const oldStatus = item.Status;
    await item.update(
      { Status: status, ReviewNote: note, ReviewedBy: req.user.UserId, ReviewedAt: new Date() },
      { transaction }
    );

    // Duyệt thì cấp vai trò SELLER/DRIVER tương ứng (bỏ qua nếu đã có).
    if (status === "APPROVED") {
      const role = await Roles.findOne({ where: { RoleName: item.PartnerType }, transaction });
      if (!role) throw badRequest(`Vai trò ${item.PartnerType} chưa được khởi tạo`);
      await UserRoles.findOrCreate({
        where: { UserId: item.UserId, RoleId: role.RoleId },
        defaults: { UserId: item.UserId, RoleId: role.RoleId },
        transaction,
      });
    }

    await logAdminAction(
      req,
      {
        action: DECISIONS[status].audit,
        targetType: "PARTNER_APPLICATION",
        targetId: id,
        oldValue: { Status: oldStatus },
        newValue: { Status: status, PartnerType: item.PartnerType, UserId: item.UserId },
        note,
      },
      { transaction }
    );

    const label = PARTNER_LABEL[item.PartnerType];
    const messages = {
      APPROVED: `Bạn đã trở thành ${label} của Chợ Đồ Cũ.`,
      REJECTED: `Hồ sơ ${label} bị từ chối. Lý do: ${note}`,
      NEED_INFO: `Vui lòng bổ sung hồ sơ ${label}: ${note}`,
    };
    await notify(
      item.UserId,
      {
        type: "PARTNER",
        title: DECISIONS[status].title,
        message: messages[status],
        referenceType: "PARTNER_APPLICATION",
        referenceId: id,
      },
      { transaction }
    );
    return item;
  });

  const resultMessages = {
    APPROVED: "Duyệt thành công",
    REJECTED: "Hồ sơ đã chuyển sang \"Từ chối\"",
    NEED_INFO: "Hồ sơ đã chuyển sang \"Cần bổ sung\"",
  };
  return res.status(200).json({ success: true, message: resultMessages[status], data: application });
};

module.exports = { listApplications, getApplication, reviewApplication };
