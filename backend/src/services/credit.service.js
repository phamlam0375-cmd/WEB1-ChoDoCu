'use strict';
const {
    sequelize,
    CreditPackages,
    UserCredits,
    CreditTransactions,
    Users,
} = require('../models');
const { badRequest, conflict, notFound } = require('../utils/httpError');

async function getPackaged() {
    const packages = await CreditPackages.findAll({
        where: { Status: "ACTIVE" }
    });

    return packages;
}

async function ensureWallet(userId) {
    try {
        await UserCredits.findOrCreate({
            where: { UserId: userId },
            defaults: { Balance: 0 }
        })
    }
    catch (err) {
        console.log(err)
    }
}

async function getBalance(userId) {
    await ensureWallet(userId);
    const wallet = await UserCredits.findOne({
        where: { UserId: userId }
    })
    return {
        balance: wallet.Balance,
        updatedAt: wallet.UpdatedAt
    }
}

async function createDeposit(userId, packageId, referenceCode) {
    if (!Number.isSafeInteger(packageId) || packageId <= 0) {
        throw badRequest('Mã gói credit không hợp lệ');
    }
    if (typeof referenceCode !== 'string' || !referenceCode.trim()) {
        throw badRequest('Vui lòng nhập mã giao dịch');
    }

    const creditPackage = await CreditPackages.findOne({
        where: { PackageId: packageId, Status: 'ACTIVE' }
    });
    if (!creditPackage) throw notFound('Không tìm thấy gói credit đang hoạt động');

    const normalizedReference = referenceCode.trim();
    const existing = await CreditTransactions.findOne({
        where: { ReferenceCode: normalizedReference }
    });
    if (existing) throw conflict('Mã giao dịch đã được sử dụng');

    return CreditTransactions.create({
        UserId: userId,
        PackageId: creditPackage.PackageId,
        Type: 'DEPOSIT',
        Amount: creditPackage.TotalCredit,
        MoneyAmount: creditPackage.Price,
        Status: 'PENDING',
        ReferenceCode: normalizedReference
    });
}

async function listPendingDeposits() {
    return CreditTransactions.findAll({
        where: { Type: 'DEPOSIT', Status: 'PENDING' },
        include: [
            { model: Users, as: 'user', attributes: ['UserId', 'Username', 'FullName', 'Email'] },
            { model: CreditPackages, as: 'package', attributes: ['PackageId', 'PackageName', 'Price', 'TotalCredit'] }
        ],
        order: [['CreatedAt', 'ASC']]
    });
}

async function reviewDeposit(adminId, transactionId, action, note) {
    return sequelize.transaction(async (transaction) => {
        const deposit = await CreditTransactions.findOne({
            where: { TransactionId: transactionId, Type: 'DEPOSIT' },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!deposit) throw notFound('Không tìm thấy yêu cầu nạp credit');
        if (deposit.Status !== 'PENDING') {
            throw conflict(`Yêu cầu đang ở trạng thái ${deposit.Status}`);
        }

        if (action === 'REJECT') {
            await deposit.update({
                Status: 'FAILED',
                Note: note || null,
                CompletedAt: new Date()
            }, { transaction });
            return deposit;
        }

        if (action !== 'CONFIRM') throw badRequest('Hành động không hợp lệ');

        const [wallet] = await UserCredits.findOrCreate({
            where: { UserId: deposit.UserId },
            defaults: { Balance: 0 },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        const balance = Number(wallet.Balance) + Number(deposit.Amount);
        await wallet.update({ Balance: balance }, { transaction });
        await deposit.update({
            Status: 'SUCCESS',
            BalanceAfter: balance,
            Note: note || `Được duyệt bởi admin ${adminId}`,
            CompletedAt: new Date()
        }, { transaction });
        return deposit;
    });
}

module.exports = {
    getPackaged,
    getBalance,
    createDeposit,
    listPendingDeposits,
    reviewDeposit
};