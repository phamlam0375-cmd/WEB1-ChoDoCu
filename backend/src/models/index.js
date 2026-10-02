"use strict";

// Nạp các model và khai báo quan hệ ở một chỗ để include giữa các bảng dùng được ở mọi controller.
const sequelize = require("../database");
const Users = require("./Users.model");
const Roles = require("./Roles.model");
const UserRoles = require("./UserRoles.model");
const PartnerApplications = require("./PartnerApplications.model");
const Categories = require("./Categories.model");
const ConditionOptions = require("./ConditionOptions.model");
const Listings = require("./Listings.model");
const ListingMedia = require("./ListingMedia.model");
const ListingPromotions = require("./ListingPromotions.model");
const Orders = require("./Orders.model");
const Payments = require("./Payments.model");
const RefundRequests = require("./RefundRequests.model");
const Commissions = require("./Commissions.model");
const Reports = require("./Reports.model");
const Notifications = require("./Notifications.model");
const StatusHistories = require("./StatusHistories.model");
const AdminAuditLogs = require("./AdminAuditLogs.model");
const SystemSettings = require("./SystemSettings.model");

Users.belongsToMany(Roles, { through: UserRoles, foreignKey: "UserId", otherKey: "RoleId", as: "Roles" });
Roles.belongsToMany(Users, { through: UserRoles, foreignKey: "RoleId", otherKey: "UserId", as: "Users" });
UserRoles.belongsTo(Roles, { foreignKey: "RoleId" });
UserRoles.belongsTo(Users, { foreignKey: "UserId" });

PartnerApplications.belongsTo(Users, { foreignKey: "UserId", as: "Applicant" });
PartnerApplications.belongsTo(Users, { foreignKey: "ReviewedBy", as: "Reviewer" });

Listings.belongsTo(Users, { foreignKey: "SellerId", as: "Seller" });
Listings.belongsTo(Categories, { foreignKey: "CategoryId", as: "Category" });
Categories.hasMany(Listings, { foreignKey: "CategoryId", as: "Listings" });
Listings.hasMany(ListingMedia, { foreignKey: "ListingId", as: "Media" });

ListingPromotions.belongsTo(Listings, { foreignKey: "ListingId", as: "Listing" });
ListingPromotions.belongsTo(Users, { foreignKey: "SellerId", as: "Seller" });

Orders.belongsTo(Users, { foreignKey: "BuyerId", as: "Buyer" });
Orders.belongsTo(Users, { foreignKey: "SellerId", as: "Seller" });
Orders.belongsTo(Listings, { foreignKey: "ListingId", as: "Listing" });
Orders.hasOne(Payments, { foreignKey: "OrderId", as: "Payment" });
Orders.hasOne(Commissions, { foreignKey: "OrderId", as: "Commission" });
Orders.hasMany(RefundRequests, { foreignKey: "OrderId", as: "RefundRequests" });

RefundRequests.belongsTo(Orders, { foreignKey: "OrderId", as: "Order" });
RefundRequests.belongsTo(Users, { foreignKey: "RequestedBy", as: "Requester" });
RefundRequests.belongsTo(Users, { foreignKey: "ReviewedBy", as: "Reviewer" });

Commissions.belongsTo(Orders, { foreignKey: "OrderId", as: "Order" });
Commissions.belongsTo(Users, { foreignKey: "SellerId", as: "Seller" });
Commissions.belongsTo(Users, { foreignKey: "ConfirmedBy", as: "Confirmer" });

Reports.belongsTo(Users, { foreignKey: "ReporterId", as: "Reporter" });
Reports.belongsTo(Users, { foreignKey: "ReportedUserId", as: "ReportedUser" });
Reports.belongsTo(Users, { foreignKey: "HandledBy", as: "Handler" });
Reports.belongsTo(Listings, { foreignKey: "ListingId", as: "Listing" });
Reports.belongsTo(Orders, { foreignKey: "OrderId", as: "Order" });

AdminAuditLogs.belongsTo(Users, { foreignKey: "AdminId", as: "Admin" });
SystemSettings.belongsTo(Users, { foreignKey: "UpdatedBy", as: "Updater" });

module.exports = {
  sequelize,
  Users,
  Roles,
  UserRoles,
  PartnerApplications,
  Categories,
  ConditionOptions,
  Listings,
  ListingMedia,
  ListingPromotions,
  Orders,
  Payments,
  RefundRequests,
  Commissions,
  Reports,
  Notifications,
  StatusHistories,
  AdminAuditLogs,
  SystemSettings,
};
