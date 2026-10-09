"use strict";

// Duyệt đăng ký đối tác (hồ sơ do người dùng gửi ở trang đăng ký đối tác). Xét duyệt thủ công, không OCR/eKYC.
const { Op, fn, col } = require("sequelize");
const { sequelize, PartnerApplications, Users, Roles, UserRoles, Store, Notifications } = require("../models");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, text, oneOf } = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { sendPartnerDecisionEmail } = require("../services/partnerMail.service");
const { verificationOf, withVerification, identityImageFile } = require("../services/partnerVerification.service");

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

  return pagedResponse(res, { ...result, rows: await withVerification(result.rows) }, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
  });
};

const getApplication = async (req, res) => {
  const id = parseId(req.params.id, "Mã hồ sơ");
  const application = await PartnerApplications.findByPk(id, { include: [applicantInclude, reviewerInclude] });
  if (!application) throw notFound("Không tìm thấy hồ sơ đối tác");

  const [history, currentRoles, notifications] = await Promise.all([
    PartnerApplications.findAll({
      where: { UserId: application.UserId, ApplicationId: { [Op.ne]: id } },
      attributes: ["ApplicationId", "PartnerType", "Status", "ReviewNote", "SubmittedAt", "ReviewedAt"],
      order: [["SubmittedAt", "DESC"]],
    }),
    Roles.findAll({
      include: [{ model: Users, as: "Users", where: { UserId: application.UserId }, attributes: [], through: { attributes: [] } }],
      attributes: ["RoleName"],
    }),
    // Thông báo đã gửi cho người đăng ký về hồ sơ này (duyệt, từ chối, yêu cầu bổ sung).
    Notifications.findAll({
      where: { ReferenceType: "PARTNER_APPLICATION", ReferenceId: id },
      attributes: ["NotificationId", "UserId", "Title", "Message", "IsRead", "CreatedAt"],
      order: [["CreatedAt", "DESC"], ["NotificationId", "DESC"]],
    }),
  ]);

  const [plain] = await withVerification([application]);
  return res.status(200).json({
    success: true,
    data: {
      ...plain,
      // Ảnh tải lên từ trang đăng ký đối tác chỉ xem được qua đường dẫn quản trị (có kiểm tra quyền).
      identityImagePath: identityImageFile(application.IdentityImageUrl) ? `/admin/partner-applications/${id}/identity-image` : null,
      history,
      notifications,
      currentRoles: currentRoles.map((role) => role.RoleName),
    },
  });
};

// GET /admin/partner-applications/:id/identity-image — trả tệp ảnh giấy tờ cho quản trị.
const getIdentityImage = async (req, res) => {
  const id = parseId(req.params.id, "Mã hồ sơ");
  const application = await PartnerApplications.findByPk(id, { attributes: ["IdentityImageUrl"] });
  const file = application && identityImageFile(application.IdentityImageUrl);
  if (!file) throw notFound("Không tìm thấy ảnh giấy tờ");
  res.set("Cache-Control", "private, no-store");
  return res.sendFile(file);
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
    let applicant = null;
    if (status === "APPROVED") {
      applicant = await Users.findByPk(item.UserId, {
        attributes: ["UserId", "FullName", "Email", "Phone", "EmailVerified", "PhoneVerified"],
        transaction,
      });
      const verified = applicant && (await verificationOf([applicant], { transaction })).get(applicant.UserId);
      if (!verified || !verified.email || !verified.phone) {
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
      // Người bán cần có gian hàng để dùng trang cửa hàng (C02) và đăng tin (C03).
      // Tạo gian hàng mặc định, vị trí minh họa; người bán tự sửa lại thông tin sau.
      if (item.PartnerType === "SELLER") {
        await Store.findOrCreate({
          where: { OwnerId: item.UserId },
          defaults: { OwnerId: item.UserId, StoreName: `Cửa hàng ${applicant.FullName}`.slice(0, 120) },
          transaction,
        });
      }
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

  // Sau khi lưu xong mới gửi email cho người đăng ký; gửi lỗi không làm hỏng kết quả xét duyệt.
  const applicant = await Users.findByPk(application.UserId, { attributes: ["FullName", "Email"] });
  const label = PARTNER_LABEL[application.PartnerType];
  const emailMessages = {
    APPROVED: `Bạn đã trở thành ${label} của Chợ Đồ Cũ.`,
    REJECTED: `hồ sơ chưa được duyệt.`,
    NEED_INFO: `vui lòng bổ sung hồ sơ theo ghi chú bên dưới và gửi lại.`,
  };
  const email = await sendPartnerDecisionEmail({
    to: applicant?.Email,
    fullName: applicant?.FullName || "bạn",
    partnerLabel: label,
    status,
    message: emailMessages[status],
    note,
  });
  return res.status(200).json({ success: true, message: resultMessages[status], data: application, email });
};

module.exports = { listApplications, getApplication, getIdentityImage, reviewApplication };
