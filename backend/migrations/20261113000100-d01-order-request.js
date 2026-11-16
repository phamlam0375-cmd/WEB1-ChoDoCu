'use strict';
module.exports = {
  async up(q, S) {
    const fields = await q.describeTable('Orders');
    if (!fields.D01RequestId) await q.addColumn('Orders', 'D01RequestId', { type: S.CHAR(36), allowNull: true });
    if (!fields.D01RequestHash) await q.addColumn('Orders', 'D01RequestHash', { type: S.CHAR(64), allowNull: true });
    if (!(await q.showIndex('Orders')).some(i => i.name === 'orders_d01_buyer_request')) await q.addIndex('Orders', ['BuyerId', 'D01RequestId'], { unique: true, name: 'orders_d01_buyer_request' });
  },
  async down() { throw new Error('Không xóa khóa nhận diện yêu cầu của các đơn đã lưu; dùng migration thu hồi riêng nếu cần.'); },
};
