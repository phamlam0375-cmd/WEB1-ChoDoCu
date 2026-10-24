'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createOrderService, EXPIRED_REASON } = require('../src/services/order.service');
const { HttpError } = require('../src/utils/httpError');

const NOW = new Date('2026-10-02T03:00:00.000Z');
const DEFAULT_PAYLOAD = {
  listingId: 10,
  deliveryMethod: 'PICKUP',
  receiverName: 'Nguyen Van B',
  receiverPhone: '0901234567',
  receiverAddress: '',
  note: 'Goi truoc khi den'
};

function clone(value) {
  return structuredClone(value);
}

function fakeRepository(overrides = {}) {
  const state = {
    listing: {
      ListingId: 10,
      SellerId: 2,
      Title: 'Ban hoc go',
      Description: 'Con tot',
      Price: '790000.00',
      ConditionLevel: 'USED',
      Location: 'Can Tho',
      Status: 'ACTIVE',
      ImageUrl: '/image.jpg',
      SellerName: 'Nguoi ban',
      SellerVerified: 1
    },
    orders: [],
    histories: [],
    notifications: [],
    nextOrderId: 1,
    ...clone(overrides.state || {})
  };

  let queue = Promise.resolve();
  const repository = {
    state,
    async withTransaction(work) {
      let unlock;
      const turn = queue;
      queue = new Promise((resolve) => { unlock = resolve; });
      await turn;
      const before = clone(state);
      try {
        return await work({ LOCK: { UPDATE: 'UPDATE' } });
      } catch (error) {
        Object.keys(state).forEach((key) => delete state[key]);
        Object.assign(state, before);
        throw error;
      } finally {
        unlock();
      }
    },
    async findListingPreview() {
      return state.listing ? clone(state.listing) : null;
    },
    async findListingByIdForUpdate() {
      return state.listing ? clone(state.listing) : null;
    },
    async reserveListing() {
      if (!state.listing || state.listing.Status !== 'ACTIVE') return 0;
      state.listing.Status = 'RESERVED';
      return 1;
    },
    async createOrder(data) {
      const order = { ...clone(data), OrderId: state.nextOrderId++ };
      state.orders.push(order);
      return clone(order);
    },
    async createHistory(data) {
      state.histories.push(clone(data));
    },
    async createNotification(data) {
      state.notifications.push(clone(data));
    },
    async findExpiredReservations(now, limit) {
      return state.orders
        .filter((order) => order.Status === 'RESERVED' && new Date(order.ReservedUntil) <= now)
        .slice(0, limit)
        .map(clone);
    },
    async cancelExpiredOrder(orderId, now, reason) {
      const order = state.orders.find((item) => (
        item.OrderId === orderId
        && item.Status === 'RESERVED'
        && new Date(item.ReservedUntil) <= now
      ));
      if (!order) return 0;
      order.Status = 'CANCELLED';
      order.CancelReason = reason;
      return 1;
    },
    async reopenListing() {
      if (!state.listing || state.listing.Status !== 'RESERVED') return 0;
      state.listing.Status = 'ACTIVE';
      return 1;
    }
  };
  return Object.assign(repository, overrides.methods || {});
}

function fakeDeliveryService(overrides = {}) {
  return {
    getCapability: () => ({ available: true }),
    verifyQuote: async () => ({
      amount: '35000.00',
      deliveryFeeRuleId: 7,
      expiresAt: new Date(NOW.getTime() + 60000).toISOString()
    }),
    ...overrides
  };
}

function serviceFor(repository, deliveryFeeService = fakeDeliveryService()) {
  return createOrderService({
    repository,
    deliveryFeeService,
    clock: () => new Date(NOW),
    config: {
      reservationMinutes: 15,
      expirationBatchSize: 50,
      commissionRate: '0.00'
    }
  });
}

async function rejectsWithCode(promise, status, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test('tao don PICKUP bang gia tren server va giu mon 15 phut', async () => {
  const repository = fakeRepository();
  const result = await serviceFor(repository).createOrder(DEFAULT_PAYLOAD, 1);

  assert.equal(result.data.status, 'RESERVED');
  assert.equal(result.data.productAmount, 790000);
  assert.equal(result.data.deliveryFee, 0);
  assert.equal(result.data.totalAmount, 790000);
  assert.equal(result.data.reservedUntil, '2026-10-02T03:15:00.000Z');
  assert.equal(repository.state.listing.Status, 'RESERVED');
  assert.equal(repository.state.orders[0].SellerId, 2);
  assert.equal(repository.state.orders[0].BuyerId, 1);
  assert.equal(repository.state.orders[0].ReceiverAddress, null);
  assert.equal(repository.state.histories.length, 1);
  assert.equal(repository.state.notifications.length, 1);
});

test('tao don DELIVERY bang bao gia da duoc backend xac thuc', async () => {
  const repository = fakeRepository();
  const payload = {
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DELIVERY',
    receiverAddress: '12 Nguyen Hue, Quan 1',
    deliveryQuoteId: 'quote-1'
  };
  const result = await serviceFor(repository).createOrder(payload, 1);

  assert.equal(result.data.deliveryFee, 35000);
  assert.equal(result.data.totalAmount, 825000);
  assert.equal(repository.state.orders[0].DeliveryFeeRuleId, 7);
});

test('tu choi bao gia DELIVERY het han', async () => {
  const repository = fakeRepository();
  const delivery = fakeDeliveryService({
    verifyQuote: async () => ({ amount: '1.00', deliveryFeeRuleId: 1, expiresAt: NOW.toISOString() })
  });
  await rejectsWithCode(serviceFor(repository, delivery).createOrder({
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DELIVERY',
    receiverAddress: 'Da Nang',
    deliveryQuoteId: 'expired'
  }, 1), 422, 'DELIVERY_QUOTE_EXPIRED');
});

test('bao loi khi tuyen DELIVERY chua duoc ho tro', async () => {
  const repository = fakeRepository();
  const delivery = fakeDeliveryService({
    verifyQuote: async () => {
      throw new HttpError(422, 'Chua ho tro tuyen giao nay', null, 'DELIVERY_ROUTE_UNSUPPORTED');
    }
  });
  await rejectsWithCode(serviceFor(repository, delivery).createOrder({
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DELIVERY',
    receiverAddress: 'Huyen dao xa',
    deliveryQuoteId: 'unsupported'
  }, 1), 422, 'DELIVERY_ROUTE_UNSUPPORTED');
});

test('tu choi cac truong tien va trang thai do client gui', async () => {
  const repository = fakeRepository();
  await rejectsWithCode(serviceFor(repository).createOrder({
    ...DEFAULT_PAYLOAD,
    productAmount: 1,
    sellerId: 99,
    status: 'COMPLETED'
  }, 1), 422, 'VALIDATION_ERROR');
  assert.equal(repository.state.orders.length, 0);
});

test('bat buoc ho ten nguoi nhan', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    receiverName: ' '
  }, 1), 422, 'VALIDATION_ERROR');
});

test('tu choi so dien thoai khong hop le', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    receiverPhone: '123'
  }, 1), 422, 'VALIDATION_ERROR');
});

test('bat buoc so dien thoai nguoi nhan', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    receiverPhone: ' '
  }, 1), 422, 'VALIDATION_ERROR');
});

test('tu choi ma tin dang khong hop le', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    listingId: 0
  }, 1), 422, 'VALIDATION_ERROR');
});

test('tu choi phuong thuc nhan hang khong hop le', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DRONE'
  }, 1), 422, 'VALIDATION_ERROR');
});

test('gioi han ghi chu 500 ky tu', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    note: 'x'.repeat(501)
  }, 1), 422, 'VALIDATION_ERROR');
});

test('DELIVERY bat buoc dia chi', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DELIVERY',
    deliveryQuoteId: 'quote-1'
  }, 1), 422, 'VALIDATION_ERROR');
});

test('DELIVERY bat buoc ma bao gia', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder({
    ...DEFAULT_PAYLOAD,
    deliveryMethod: 'DELIVERY',
    receiverAddress: 'Ha Noi'
  }, 1), 422, 'VALIDATION_ERROR');
});

test('khong cho mua tin cua chinh minh', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder(DEFAULT_PAYLOAD, 2), 403, 'CANNOT_BUY_OWN_LISTING');
});

test('khong tao don khi chua dang nhap', async () => {
  await rejectsWithCode(serviceFor(fakeRepository()).createOrder(DEFAULT_PAYLOAD, null), 401, 'UNAUTHORIZED');
});

test('bao 404 khi tin dang khong ton tai', async () => {
  const repository = fakeRepository({ state: { listing: null } });
  await rejectsWithCode(serviceFor(repository).createOrder(DEFAULT_PAYLOAD, 1), 404, 'LISTING_NOT_FOUND');
});

test('chi cho dat tin ACTIVE', async () => {
  const repository = fakeRepository();
  repository.state.listing.Status = 'RESERVED';
  await rejectsWithCode(serviceFor(repository).createOrder(DEFAULT_PAYLOAD, 1), 409, 'LISTING_UNAVAILABLE');
});

test('hai nguoi dat dong thoi chi mot nguoi thanh cong', async () => {
  const repository = fakeRepository();
  const service = serviceFor(repository);
  const results = await Promise.allSettled([
    service.createOrder(DEFAULT_PAYLOAD, 1),
    service.createOrder(DEFAULT_PAYLOAD, 3)
  ]);

  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  const failure = results.find((item) => item.status === 'rejected').reason;
  assert.equal(failure.status, 409);
  assert.equal(repository.state.orders.length, 1);
  assert.equal(repository.state.histories.length, 1);
  assert.equal(repository.state.notifications.length, 1);
});

test('loi thong bao rollback toan bo giao dich', async () => {
  const repository = fakeRepository({
    methods: { createNotification: async () => { throw new Error('notification failed'); } }
  });
  await assert.rejects(serviceFor(repository).createOrder(DEFAULT_PAYLOAD, 1), /notification failed/);
  assert.equal(repository.state.listing.Status, 'ACTIVE');
  assert.equal(repository.state.orders.length, 0);
  assert.equal(repository.state.histories.length, 0);
});

test('job het han la idempotent va gui thong bao cho hai ben', async () => {
  const repository = fakeRepository();
  repository.state.listing.Status = 'RESERVED';
  repository.state.orders.push({
    OrderId: 5,
    BuyerId: 1,
    SellerId: 2,
    ListingId: 10,
    Status: 'RESERVED',
    ReservedUntil: new Date(NOW.getTime() - 1000)
  });
  const service = serviceFor(repository);

  assert.deepEqual(await service.expireReservations(), { expiredCount: 1 });
  assert.deepEqual(await service.expireReservations(), { expiredCount: 0 });
  assert.equal(repository.state.orders[0].Status, 'CANCELLED');
  assert.equal(repository.state.orders[0].CancelReason, EXPIRED_REASON);
  assert.equal(repository.state.listing.Status, 'ACTIVE');
  assert.equal(repository.state.histories.length, 1);
  assert.deepEqual(repository.state.notifications.map((item) => item.userId), [1, 2]);
});

test('job khong huy don chua het han hoac khac RESERVED', async () => {
  const repository = fakeRepository();
  repository.state.orders.push(
    { OrderId: 1, BuyerId: 1, SellerId: 2, ListingId: 10, Status: 'RESERVED', ReservedUntil: new Date(NOW.getTime() + 1000) },
    { OrderId: 2, BuyerId: 1, SellerId: 2, ListingId: 10, Status: 'WAITING_PAYMENT', ReservedUntil: new Date(NOW.getTime() - 1000) }
  );
  assert.deepEqual(await serviceFor(repository).expireReservations(), { expiredCount: 0 });
  assert.equal(repository.state.histories.length, 0);
});

test('job khong mo lai tin da duoc chuyen sang SOLD', async () => {
  const repository = fakeRepository();
  repository.state.listing.Status = 'SOLD';
  repository.state.orders.push({
    OrderId: 8,
    BuyerId: 1,
    SellerId: 2,
    ListingId: 10,
    Status: 'RESERVED',
    ReservedUntil: new Date(NOW.getTime() - 1000)
  });
  assert.deepEqual(await serviceFor(repository).expireReservations(), { expiredCount: 1 });
  assert.equal(repository.state.listing.Status, 'SOLD');
});
