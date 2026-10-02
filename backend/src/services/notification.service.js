"use strict";

const { Notifications } = require("../models");

// Tạo thông báo trong website cho người liên quan (bảng Notifications).
const notify = (userId, { type, title, message, referenceType = null, referenceId = null }, { transaction } = {}) => {
  if (!userId) return null;
  return Notifications.create(
    {
      UserId: userId,
      Type: type,
      Title: title.slice(0, 150),
      Message: message.slice(0, 500),
      ReferenceType: referenceType,
      ReferenceId: referenceId,
    },
    { transaction }
  );
};

module.exports = { notify };
