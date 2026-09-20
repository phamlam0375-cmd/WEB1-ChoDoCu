const { DataTypes } = require("sequelize");
const sequelize = require('../database');

const PartnerApplications = sequelize.define(
    "PartnerApplications",
    {
        ApplicationId: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },

        UserId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            references: {
                model: "Users",
                key: "UserId",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        },

        PartnerType: {
            type: DataTypes.STRING(20),
            allowNull: false,

            validate: {
                isIn: [["DRIVER", "SELLER"]],
            },
        },

        IdentityImageUrl: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },

        IdentityNumberMasked: {
            type: DataTypes.STRING(30),
            allowNull: true,
        },

        Status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "PENDING",
        },

        ReviewNote: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },

        ReviewedBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: {
                model: "Users",
                key: "UserId",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },

        SubmittedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },

        ReviewedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "PartnerApplications",
        timestamps: false,
    }
);

module.exports = PartnerApplications;