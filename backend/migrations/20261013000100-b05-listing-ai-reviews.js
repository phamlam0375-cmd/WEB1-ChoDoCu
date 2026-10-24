'use strict';

// B05 — Kết quả AI sàng lọc tin đăng trước khi quản trị duyệt (mỗi tin giữ lần phân tích gần nhất).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'ListingAiReviews',
      {
        ListingId: {
          type: Sequelize.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
          references: { model: 'Listings', key: 'ListingId' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        Recommendation: { type: Sequelize.STRING(10), allowNull: false },
        RiskLevel: { type: Sequelize.STRING(10), allowNull: false },
        Summary: { type: Sequelize.STRING(500), allowNull: false },
        Reasons: { type: Sequelize.TEXT, allowNull: false },
        Flags: { type: Sequelize.TEXT, allowNull: false },
        Model: { type: Sequelize.STRING(60), allowNull: false },
        ReviewedAt: { type: Sequelize.DATE, allowNull: false },
      },
      { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ListingAiReviews');
  },
};
