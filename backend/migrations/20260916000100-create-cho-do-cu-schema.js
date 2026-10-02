'use strict';

const TABLE_OPTIONS = {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB'
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const id = () => ({
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    });
    const integer = (allowNull = false) => ({
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull
    });
    const foreignKey = (table, key, allowNull = false, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull,
      references: { model: table, key },
      onUpdate: 'CASCADE',
      onDelete
    });
    const createdAt = () => ({
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.createTable('Users', {
      UserId: id(),
      Username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      PasswordHash: { type: Sequelize.STRING(255), allowNull: true },
      FullName: { type: Sequelize.STRING(100), allowNull: false },
      Email: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      Phone: { type: Sequelize.STRING(15), allowNull: true, unique: true },
      GoogleId: { type: Sequelize.STRING(150), allowNull: true, unique: true },
      AvatarUrl: { type: Sequelize.STRING(255), allowNull: true },
      Address: { type: Sequelize.STRING(255), allowNull: true },
      EmailVerified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      PhoneVerified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      CreatedAt: createdAt(),
      UpdatedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Roles', {
      RoleId: id(),
      RoleName: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      Description: { type: Sequelize.STRING(200), allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('UserRoles', {
      UserId: { ...foreignKey('Users', 'UserId', false, 'CASCADE'), primaryKey: true },
      RoleId: { ...foreignKey('Roles', 'RoleId', false, 'CASCADE'), primaryKey: true },
      AssignedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('VerificationCodes', {
      VerificationId: id(),
      UserId: foreignKey('Users', 'UserId', true, 'CASCADE'),
      Recipient: { type: Sequelize.STRING(120), allowNull: false },
      Channel: { type: Sequelize.STRING(10), allowNull: false },
      Purpose: { type: Sequelize.STRING(30), allowNull: false },
      CodeHash: { type: Sequelize.STRING(255), allowNull: false },
      ExpiresAt: { type: Sequelize.DATE, allowNull: false },
      UsedAt: { type: Sequelize.DATE, allowNull: true },
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('PartnerApplications', {
      ApplicationId: id(),
      UserId: foreignKey('Users', 'UserId'),
      PartnerType: { type: Sequelize.STRING(20), allowNull: false },
      IdentityImageUrl: { type: Sequelize.STRING(255), allowNull: true },
      IdentityNumberMasked: { type: Sequelize.STRING(30), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      ReviewNote: { type: Sequelize.STRING(500), allowNull: true },
      ReviewedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      SubmittedAt: createdAt(),
      ReviewedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Stores', {
      StoreId: id(),
      OwnerId: { ...foreignKey('Users', 'UserId'), unique: true },
      StoreName: { type: Sequelize.STRING(120), allowNull: false },
      Description: { type: Sequelize.STRING(500), allowNull: true },
      Address: { type: Sequelize.STRING(255), allowNull: true },
      Latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      Longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      IsDemoLocation: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      BankName: { type: Sequelize.STRING(80), allowNull: true },
      BankAccountNumber: { type: Sequelize.STRING(30), allowNull: true },
      BankAccountHolder: { type: Sequelize.STRING(100), allowNull: true },
      QrImageUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Categories', {
      CategoryId: id(),
      CategoryName: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      Description: { type: Sequelize.STRING(300), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Listings', {
      ListingId: id(),
      SellerId: foreignKey('Users', 'UserId'),
      StoreId: foreignKey('Stores', 'StoreId', true, 'SET NULL'),
      CategoryId: foreignKey('Categories', 'CategoryId'),
      Title: { type: Sequelize.STRING(180), allowNull: false },
      Description: { type: Sequelize.TEXT, allowNull: false },
      Price: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      ConditionLevel: { type: Sequelize.STRING(30), allowNull: false },
      KnownDefects: { type: Sequelize.TEXT, allowNull: true },
      Location: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      ModerationNote: { type: Sequelize.STRING(500), allowNull: true },
      CreatedAt: createdAt(),
      UpdatedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('ListingMedia', {
      MediaId: id(),
      ListingId: foreignKey('Listings', 'ListingId', false, 'CASCADE'),
      MediaType: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'IMAGE' },
      MediaUrl: { type: Sequelize.STRING(255), allowNull: false },
      SortOrder: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Favorites', {
      UserId: { ...foreignKey('Users', 'UserId', false, 'CASCADE'), primaryKey: true },
      ListingId: { ...foreignKey('Listings', 'ListingId', false, 'CASCADE'), primaryKey: true },
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('ListingPromotions', {
      PromotionId: id(),
      ListingId: foreignKey('Listings', 'ListingId', false, 'CASCADE'),
      SellerId: foreignKey('Users', 'UserId'),
      PlanName: { type: Sequelize.STRING(50), allowNull: false },
      FeeAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      PaymentReference: { type: Sequelize.STRING(50), allowNull: true },
      PaymentProofUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      StartsAt: { type: Sequelize.DATE, allowNull: true },
      EndsAt: { type: Sequelize.DATE, allowNull: true },
      ConfirmedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      ConfirmedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Orders', {
      OrderId: id(),
      BuyerId: foreignKey('Users', 'UserId'),
      ListingId: foreignKey('Listings', 'ListingId'),
      SellerId: foreignKey('Users', 'UserId'),
      DeliveryMethod: { type: Sequelize.STRING(20), allowNull: false },
      ReceiverName: { type: Sequelize.STRING(100), allowNull: false },
      ReceiverPhone: { type: Sequelize.STRING(15), allowNull: false },
      ReceiverAddress: { type: Sequelize.STRING(255), allowNull: true },
      ProductAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      DeliveryFee: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      CommissionRate: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      TotalAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      Status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'RESERVED' },
      ReservedUntil: { type: Sequelize.DATE, allowNull: false },
      CancelReason: { type: Sequelize.STRING(500), allowNull: true },
      CreatedAt: createdAt(),
      CompletedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Payments', {
      PaymentId: id(),
      OrderId: { ...foreignKey('Orders', 'OrderId'), unique: true },
      PayerId: foreignKey('Users', 'UserId'),
      PayeeId: foreignKey('Users', 'UserId'),
      Amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      BankName: { type: Sequelize.STRING(80), allowNull: true },
      BankAccountSnapshot: { type: Sequelize.STRING(30), allowNull: true },
      TransferContent: { type: Sequelize.STRING(100), allowNull: false },
      ProofUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'WAITING' },
      ReportedAt: { type: Sequelize.DATE, allowNull: true },
      ConfirmedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      ConfirmedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('RefundRequests', {
      RefundRequestId: id(),
      OrderId: foreignKey('Orders', 'OrderId'),
      RequestedBy: foreignKey('Users', 'UserId'),
      Reason: { type: Sequelize.STRING(500), allowNull: false },
      EvidenceUrl: { type: Sequelize.STRING(255), allowNull: true },
      Amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      RefundProofUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'PENDING' },
      AdminNote: { type: Sequelize.STRING(500), allowNull: true },
      ReviewedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      RequestedAt: createdAt(),
      ReviewedAt: { type: Sequelize.DATE, allowNull: true },
      CompletedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Commissions', {
      CommissionId: id(),
      OrderId: { ...foreignKey('Orders', 'OrderId'), unique: true },
      SellerId: foreignKey('Users', 'UserId'),
      Rate: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      OriginalAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      AdjustmentAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      AmountDue: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      PaymentReference: { type: Sequelize.STRING(50), allowNull: true },
      PaymentProofUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'UNPAID' },
      DueAt: { type: Sequelize.DATE, allowNull: true },
      ConfirmedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      ConfirmedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Deliveries', {
      DeliveryId: id(),
      OrderId: { ...foreignKey('Orders', 'OrderId'), unique: true },
      DriverId: foreignKey('Users', 'UserId', true, 'SET NULL'),
      PickupAddress: { type: Sequelize.STRING(255), allowNull: false },
      DeliveryAddress: { type: Sequelize.STRING(255), allowNull: false },
      DriverFee: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      PickupCodeHash: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
      RetryCount: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      FailureReason: { type: Sequelize.STRING(500), allowNull: true },
      ProofUrl: { type: Sequelize.STRING(255), allowNull: true },
      AcceptedAt: { type: Sequelize.DATE, allowNull: true },
      PickedUpAt: { type: Sequelize.DATE, allowNull: true },
      DeliveredAt: { type: Sequelize.DATE, allowNull: true },
      ReturnedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('StatusHistories', {
      HistoryId: id(),
      OrderId: foreignKey('Orders', 'OrderId', false, 'CASCADE'),
      DeliveryId: foreignKey('Deliveries', 'DeliveryId', true, 'SET NULL'),
      StatusType: { type: Sequelize.STRING(20), allowNull: false },
      StatusValue: { type: Sequelize.STRING(30), allowNull: false },
      Note: { type: Sequelize.STRING(500), allowNull: true },
      ChangedBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Conversations', {
      ConversationId: id(),
      ListingId: foreignKey('Listings', 'ListingId', true, 'SET NULL'),
      OrderId: foreignKey('Orders', 'OrderId', true, 'SET NULL'),
      CreatedBy: foreignKey('Users', 'UserId'),
      ConversationType: { type: Sequelize.STRING(20), allowNull: false },
      CreatedAt: createdAt(),
      LastMessageAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Messages', {
      MessageId: id(),
      ConversationId: foreignKey('Conversations', 'ConversationId', false, 'CASCADE'),
      SenderId: foreignKey('Users', 'UserId', true, 'SET NULL'),
      SenderType: { type: Sequelize.STRING(15), allowNull: false },
      Content: { type: Sequelize.TEXT, allowNull: false },
      IsRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      SentAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Reviews', {
      ReviewId: id(),
      OrderId: foreignKey('Orders', 'OrderId'),
      ReviewerId: foreignKey('Users', 'UserId'),
      TargetUserId: foreignKey('Users', 'UserId'),
      TargetType: { type: Sequelize.STRING(15), allowNull: false },
      Rating: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
      Comment: { type: Sequelize.STRING(1000), allowNull: true },
      Reply: { type: Sequelize.STRING(1000), allowNull: true },
      CreatedAt: createdAt(),
      ReplyAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Reports', {
      ReportId: id(),
      ReporterId: foreignKey('Users', 'UserId'),
      ListingId: foreignKey('Listings', 'ListingId', true, 'SET NULL'),
      ReportedUserId: foreignKey('Users', 'UserId', true, 'SET NULL'),
      OrderId: foreignKey('Orders', 'OrderId', true, 'SET NULL'),
      Reason: { type: Sequelize.STRING(200), allowNull: false },
      Description: { type: Sequelize.STRING(1000), allowNull: true },
      EvidenceUrl: { type: Sequelize.STRING(255), allowNull: true },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      HandledBy: foreignKey('Users', 'UserId', true, 'SET NULL'),
      Resolution: { type: Sequelize.STRING(1000), allowNull: true },
      CreatedAt: createdAt(),
      HandledAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.createTable('Notifications', {
      NotificationId: id(),
      UserId: foreignKey('Users', 'UserId', false, 'CASCADE'),
      Type: { type: Sequelize.STRING(30), allowNull: false },
      Title: { type: Sequelize.STRING(150), allowNull: false },
      Message: { type: Sequelize.STRING(500), allowNull: false },
      ReferenceType: { type: Sequelize.STRING(30), allowNull: true },
      ReferenceId: integer(true),
      IsRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      CreatedAt: createdAt()
    }, TABLE_OPTIONS);

    await queryInterface.addIndex('VerificationCodes', ['Recipient', 'Purpose']);
    await queryInterface.addIndex('Listings', ['CategoryId', 'Status', 'Price']);
    await queryInterface.addIndex('Listings', ['SellerId', 'Status']);
    await queryInterface.addIndex('Orders', ['BuyerId', 'Status']);
    await queryInterface.addIndex('Orders', ['SellerId', 'Status']);
    await queryInterface.addIndex('Deliveries', ['DriverId', 'Status']);
    await queryInterface.addIndex('Messages', ['ConversationId', 'SentAt']);
    await queryInterface.addIndex('Notifications', ['UserId', 'IsRead', 'CreatedAt']);
  },

  async down(queryInterface) {
    const tables = [
      'Notifications',
      'Reports',
      'Reviews',
      'Messages',
      'Conversations',
      'StatusHistories',
      'Deliveries',
      'Commissions',
      'RefundRequests',
      'Payments',
      'Orders',
      'ListingPromotions',
      'Favorites',
      'ListingMedia',
      'Listings',
      'Categories',
      'Stores',
      'PartnerApplications',
      'VerificationCodes',
      'UserRoles',
      'Roles',
      'Users'
    ];

    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  }
};
