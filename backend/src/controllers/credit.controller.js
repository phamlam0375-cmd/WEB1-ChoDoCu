'use strict';

const creditService = require('../services/credit.service');
const getUserId = (req) => req.user.UserId;

const getPackaged = async (req, res) => {
    try {
        const data = await creditService.getPackaged();
        res.json({
            success: true,
            data
        })
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống, vui lòng thử lại sau'
        })
    }
}

const getBalance = async (req, res) => {
    try {
        const data = await creditService.getBalance(getUserId(req));
        res.json({
            success: true,
            data
        })
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống, vui lòng thử lại sau'
        })
    }
}

const createDeposit = async (req, res) => {
    const data = await creditService.createDeposit(
        getUserId(req),
        Number(req.body.packageId),
        req.body.referenceCode
    );
    return res.status(201).json({ success: true, data });
};

const listPendingDeposits = async (_req, res) => {
    const data = await creditService.listPendingDeposits();
    return res.json({ success: true, data });
};

const reviewDeposit = async (req, res) => {
    const data = await creditService.reviewDeposit(
        req.user.UserId,
        Number(req.params.id),
        req.body.action,
        req.body.note
    );
    return res.json({ success: true, data });
};

module.exports = {
    getPackaged,
    getBalance,
    createDeposit,
    listPendingDeposits,
    reviewDeposit
};