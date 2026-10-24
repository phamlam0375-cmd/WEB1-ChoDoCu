'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const AppError = require('../src/errors/AppError');
const { createOrderService } = require('../src/services/order.service');

const NOW = new Date('2026-10-02T07:15:00.000Z');
const CONFIG = {
  reservationMinutes: 15,
  expirationBatchSize: 50,
  commissionRate: '5.00'
};

const pickupPayload = {
  listingId: 10,
  deliveryMethod: 'PICKUP',
  receiverName: ' Nguyễn Văn A ',
  receiverPhone: '0912 345 678',
  note: ' Đến lấy buổi chiều '
};

function activeListing(overrides = {}) {
  return {
    ListingId: 10,
    SellerId: 1,
    Title: 'Bàn học cũ',
    Description: 'Còn tốt',
    Price: '1000000.00',
    ConditionLevel: 'GOOD',
    Location: 'TP. Hồ Chí Minh',
    Status: 'ACTIVE',
    SellerName: 'Người bán',
    SellerVerified: 1,
    ImageUrl: null,
    ...overrides
  };
}

function makeRepository(options = {}) {
  let state = {
    listing: options.listing === undefined ? activeListing() : options.listing,
    orders: structuredClone(options.orders || []),
    histories: [],
    notifications: []
  };
  let nextOrderId = 100;
  let queue = Promise.resolve();

  const repository = {
    withTransaction(work) {
      const operation = queue.then(async () => {
        const snapshot = structuredClone(state);
        const snapshotId = nextOrderId;
        try {
          return await work({ LOCK: { UPDATE: 'UPDATE' } });
        } catch (error) {
          state = snapshot;
          nextOrderId = snapshotId;
          throw error;
        }
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
    async findListingPreview() {
      return state.listing;
    },
    async findListingByIdForUpdate() {
      return state.listing;
    },
    async reserveListing() {
      if (!state.listing || state.listing.Status !== 'ACTIVE') return 0;
      state.listing.Status = 'RESERVED';
      return 1;
    },
    async createOrder(data) {
      const order = { ...data, OrderId: nextOrderId++ };
      state.orders.push(order);
      return order;
    },
    async createHistory(data) {
      state.histories.push(data);
      return data;
    },
    async createNotification(data) {
      if (options.failNotification) throw new Error('notification failed');
      state.notifications.push(data);
      return data;
    },
    async findExpiredReservations(now, limit) {
      return state.orders
        .filter((order) => order.Status === 'RESERVED' && order.ReservedUntil <= now)
        .slice(0, limit);
    },
    async cancelExpiredOrder(orderId, now, reason) {
      const order = state.orders.find((item) => item.OrderId === orderId);
      if (!order || order.Status !== 'RESERVED' || order.ReservedUntil > now) return 0;
      order.Status = 'CANCELLED';
      order.CancelReason = reason;
      return 1;
    },
    async reopenListing() {
      if (state.listing?.Status !== 'RESERVED') return 0;
      state.listing.Status = 'ACTIVE';
      return 1;
    }
  };

  return { repository, getState: () => state };
}

function makeService(repository, deliveryFeeService = null) {
  return createOrderService({
    repository,
    config: CONFIG,
    clock: () => new Date(NOW),
    deliveryFeeService: deliveryFeeService || {
      getCapability: () => ({ available: false }),
      verifyQuote: async () => {
        throw new AppError(503, 'DELIVERY_SERVICE_UNAVAILABLE', 'D12 unavailable');
      }
    }
  });
}

async function expectAppError(promise, code, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    if (status) assert.equal(error.status, status);
    return true;
  });
}

describe('D01 createOrder', () => {
  test('creates a valid PICKUP reservation from database values', async () => {
    const fixture = makeRepository();
    const result = await makeService(fixture.repository).createOrder(pickupPayload, 2);
    const state = fixture.getState();

    assert.equal(result.data.status, 'RESERVED');
    assert.equal(result.data.productAmount, 1000000);
    assert.equal(result.data.deliveryFee, 0);
    assert.equal(result.data.totalAmount, 1000000);
    assert.equal(result.data.reservedUntil, '2026-10-02T07:30:00.000Z');
    assert.equal(state.listing.Status, 'RESERVED');
    assert.equal(state.orders[0].BuyerId, 2);
    assert.equal(state.orders[0].SellerId, 1);
    assert.equal(state.orders[0].ReceiverAddress, null);
    assert.equal(state.orders[0].BuyerNote, 'Đến lấy buổi chiều');
    assert.equal(state.histories[0].StatusValue, 'RESERVED');
    assert.equal(state.notifications[0].userId, 1);
  });

  test('creates DELIVERY only with a server-verified quote', async () => {
    const fixture = makeRepository();
    const deliveryFeeService = {
      getCapability: () => ({ available: true }),
      verifyQuote: async () => ({
        deliveryFeeRuleId: 7,
        amount: '30000.00',
        expiresAt: '2026-10-02T07:20:00.000Z'
      })
    };
    const result = await makeService(fixture.repository, deliveryFeeService).createOrder({
      ...pickupPayload,
      deliveryMethod: 'DELIVERY',
      receiverAddress: 'Thủ Đức, TP. Hồ Chí Minh',
      deliveryQuoteId: 'quote-1'
    }, 2);

    assert.equal(result.data.deliveryFee, 30000);
    assert.equal(result.data.totalAmount, 1030000);
    assert.equal(fixture.getState().orders[0].DeliveryFeeRuleId, 7);
  });

  test('rejects a delivery quote that has expired', async () => {
    const fixture = makeRepository();
    const deliveryFeeService = {
      getCapability: () => ({ available: true }),
      verifyQuote: async () => ({
        deliveryFeeRuleId: 7,
        amount: '30000.00',
        expiresAt: '2026-10-02T07:14:59.000Z'
      })
    };
    await expectAppError(makeService(fixture.repository, deliveryFeeService).createOrder({
      ...pickupPayload,
      deliveryMethod: 'DELIVERY',
      receiverAddress: 'Thủ Đức',
      deliveryQuoteId: 'expired'
    }, 2), 'DELIVERY_QUOTE_EXPIRED', 422);
  });

  test('does not accept client-controlled monetary fields or buyerId', async () => {
    const fixture = makeRepository();
    await expectAppError(makeService(fixture.repository).createOrder({
      ...pickupPayload,
      buyerId: 99,
      totalAmount: 1
    }, 2), 'VALIDATION_ERROR', 422);
    assert.equal(fixture.getState().orders.length, 0);
  });

  for (const [name, patch] of [
    ['missing receiver name', { receiverName: '   ' }],
    ['missing phone', { receiverPhone: '' }],
    ['invalid phone', { receiverPhone: '123' }],
    ['invalid listing id', { listingId: 0 }],
    ['invalid delivery method', { deliveryMethod: 'SHIP' }],
    ['note longer than 500 characters', { note: 'x'.repeat(501) }]
  ]) {
    test(`rejects ${name}`, async () => {
      const fixture = makeRepository();
      await expectAppError(
        makeService(fixture.repository).createOrder({ ...pickupPayload, ...patch }, 2),
        'VALIDATION_ERROR',
        422
      );
    });
  }

  test('requires address and quote for DELIVERY', async () => {
    const fixture = makeRepository();
    await expectAppError(makeService(fixture.repository).createOrder({
      ...pickupPayload,
      deliveryMethod: 'DELIVERY'
    }, 2), 'VALIDATION_ERROR', 422);
  });

  test('rejects buying own listing', async () => {
    const fixture = makeRepository();
    await expectAppError(
      makeService(fixture.repository).createOrder(pickupPayload, 1),
      'CANNOT_BUY_OWN_LISTING',
      403
    );
  });

  test('returns 404 for a missing listing', async () => {
    const fixture = makeRepository({ listing: null });
    await expectAppError(
      makeService(fixture.repository).createOrder(pickupPayload, 2),
      'LISTING_NOT_FOUND',
      404
    );
  });

  test('returns 409 for a listing that is not ACTIVE', async () => {
    const fixture = makeRepository({ listing: activeListing({ Status: 'SOLD' }) });
    await expectAppError(
      makeService(fixture.repository).createOrder(pickupPayload, 2),
      'LISTING_UNAVAILABLE',
      409
    );
  });

  test('allows only one of two concurrent buyers to reserve a listing', async () => {
    const fixture = makeRepository();
    const service = makeService(fixture.repository);
    const results = await Promise.allSettled([
      service.createOrder(pickupPayload, 2),
      service.createOrder(pickupPayload, 3)
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected');
    assert.equal(rejected.reason.code, 'LISTING_UNAVAILABLE');
    assert.equal(rejected.reason.status, 409);
    assert.equal(fixture.getState().orders.length, 1);
  });

  test('rolls the complete transaction back when notification creation fails', async () => {
    const fixture = makeRepository({ failNotification: true });
    await assert.rejects(makeService(fixture.repository).createOrder(pickupPayload, 2));

    const state = fixture.getState();
    assert.equal(state.listing.Status, 'ACTIVE');
    assert.equal(state.orders.length, 0);
    assert.equal(state.histories.length, 0);
  });
});

describe('D01 expireReservations', () => {
  test('expires only RESERVED orders and is idempotent', async () => {
    const fixture = makeRepository({
      listing: activeListing({ Status: 'RESERVED' }),
      orders: [
        {
          OrderId: 11,
          BuyerId: 2,
          SellerId: 1,
          ListingId: 10,
          Status: 'RESERVED',
          ReservedUntil: new Date('2026-10-02T07:14:00.000Z')
        },
        {
          OrderId: 12,
          BuyerId: 3,
          SellerId: 1,
          ListingId: 10,
          Status: 'WAITING_PAYMENT',
          ReservedUntil: new Date('2026-10-02T07:10:00.000Z')
        },
        {
          OrderId: 13,
          BuyerId: 4,
          SellerId: 1,
          ListingId: 10,
          Status: 'RESERVED',
          ReservedUntil: new Date('2026-10-02T07:20:00.000Z')
        }
      ]
    });
    const service = makeService(fixture.repository);

    assert.deepEqual(await service.expireReservations(), { expiredCount: 1 });
    assert.deepEqual(await service.expireReservations(), { expiredCount: 0 });

    const state = fixture.getState();
    assert.equal(state.orders[0].Status, 'CANCELLED');
    assert.equal(state.orders[1].Status, 'WAITING_PAYMENT');
    assert.equal(state.orders[2].Status, 'RESERVED');
    assert.equal(state.listing.Status, 'ACTIVE');
    assert.equal(state.histories.length, 1);
    assert.equal(state.notifications.length, 2);
  });

  test('does not reopen a listing already marked SOLD', async () => {
    const fixture = makeRepository({
      listing: activeListing({ Status: 'SOLD' }),
      orders: [{
        OrderId: 20,
        BuyerId: 2,
        SellerId: 1,
        ListingId: 10,
        Status: 'RESERVED',
        ReservedUntil: new Date('2026-10-02T07:00:00.000Z')
      }]
    });
    await makeService(fixture.repository).expireReservations();
    assert.equal(fixture.getState().listing.Status, 'SOLD');
  });
});
