'use strict';

module.exports = (sequelize, DataTypes) => {
    const CreditPackage = sequelize.define('CreditPackage', {
        PackageId: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        PackageName: { type: DataTypes.STRING(100), allowNull: false },
        Description: { type: DataTypes.STRING(300), allowNull: true },
        // DECIMAL trả về dạng string trong Sequelize, dùng Number() khi tính toán
        Price: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
        BaseCredit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        BonusCredit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        TotalCredit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
        IsFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        SortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }
    }, {
        tableName: 'CreditPackages',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: 'UpdatedAt',
        hooks: {
            // TotalCredit luôn do Backend tính, không tin dữ liệu gửi lên
            beforeValidate(pkg) {
                pkg.TotalCredit = Number(pkg.BaseCredit || 0) + Number(pkg.BonusCredit || 0);
            }
        }
    });

    CreditPackage.STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

    CreditPackage.associate = (models) => {
        CreditPackage.hasMany(models.CreditTransaction, { foreignKey: 'PackageId', as: 'transactions' });
    };

    return CreditPackage;
};