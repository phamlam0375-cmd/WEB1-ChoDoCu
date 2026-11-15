'use strict';

const { confirmPickupHandover } = require('../../services/C07_XacNhanBanGiao/pickupHandover.service');

const confirm = async (req, res) => res.status(200).json({
  success: true,
  ...(await confirmPickupHandover(req.params.id, req.user)),
});

module.exports = { confirm };
