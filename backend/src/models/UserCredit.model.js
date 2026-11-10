'use strict';

module.exports = (sequelize, DataTypes) => {
    const UserCredit = sequelize.define('UserCredit', {
        UserCreditId: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        UserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
        Balance: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }
    }, {
        tableName: 'UserCredits',
        timestamps: true,
        createdAt: false,
        updatedAt: 'UpdatedAt'
    });

    UserCredit.associate = (models) => {
        UserCredit.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });
    };

    return UserCredit;
};