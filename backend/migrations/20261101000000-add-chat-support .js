'use strict';

const TABLE_OPTIONS = {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    engine: 'InnoDB'
};

module.exports = {
    async up(queryInterface, Sequelize) {
        const foreignKey = (table, key, allowNull = false, onDelete = 'RESTRICT') => ({
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull,
            references: { model: table, key },
            onUpdate: 'CASCADE',
            onDelete
        });

        // 1. Nguoi tham gia hoi thoai + moc da doc
        await queryInterface.createTable('ConversationParticipants', {
            ConversationId: { ...foreignKey('Conversations', 'ConversationId', false, 'CASCADE'), primaryKey: true },
            UserId: { ...foreignKey('Users', 'UserId', false, 'CASCADE'), primaryKey: true },
            JoinedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            LastReadMessageId: foreignKey('Messages', 'MessageId', true, 'SET NULL'),
            IsMuted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
        }, TABLE_OPTIONS);

        await queryInterface.addIndex('ConversationParticipants', ['UserId'], {
            name: 'idx_conversation_participants_user'
        });

        // 2. Tin nhan co anh/file
        await queryInterface.addColumn('Messages', 'MessageType', {
            type: Sequelize.STRING(10),
            allowNull: false,
            defaultValue: 'TEXT'
        });
        await queryInterface.addColumn('Messages', 'AttachmentUrl', {
            type: Sequelize.STRING(255),
            allowNull: true
        });
        // Tin nhan chi co anh thi khong can noi dung
        await queryInterface.changeColumn('Messages', 'Content', {
            type: Sequelize.TEXT,
            allowNull: true
        });

        // 3. Chong trung hoi thoai: 1 buyer - 1 listing chi 1 conversation
        await queryInterface.addColumn('Conversations', 'BuyerId', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true
        });
        await queryInterface.addConstraint('Conversations', {
            fields: ['BuyerId'],
            type: 'foreign key',
            name: 'fk_conversations_buyer',
            references: { table: 'Users', field: 'UserId' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        // 4. Index cho inbox
        await queryInterface.addIndex('Conversations', ['LastMessageAt'], {
            name: 'idx_conversations_last_message'
        });
        await queryInterface.addIndex('Conversations', ['ListingId'], {
            name: 'idx_conversations_listing'
        });
        await queryInterface.addIndex('Conversations', ['OrderId'], {
            name: 'idx_conversations_order'
        });
        await queryInterface.addIndex('Conversations', ['ListingId', 'BuyerId'], {
            name: 'uq_conversations_listing_buyer',
            unique: true
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('Conversations', 'uq_conversations_listing_buyer');
        await queryInterface.removeIndex('Conversations', 'idx_conversations_order');
        await queryInterface.removeIndex('Conversations', 'idx_conversations_listing');
        await queryInterface.removeIndex('Conversations', 'idx_conversations_last_message');

        await queryInterface.removeConstraint('Conversations', 'fk_conversations_buyer');
        await queryInterface.removeColumn('Conversations', 'BuyerId');

        await queryInterface.removeColumn('Messages', 'AttachmentUrl');
        await queryInterface.removeColumn('Messages', 'MessageType');

        await queryInterface.dropTable('ConversationParticipants');
    }
};