'use strict';

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');
const orderRoutes = require('./routes/order.route');
const cancellationRoutes = require('./routes/D02_HuyDonHang/cancellation.route');
const paymentRoutes = require('./routes/D03_ThanhToan/payment.route');
const confirmationRoutes = require('./routes/D04_XacNhanNhanTien/confirmation.route');
const trackingRoutes = require('./routes/D05_TheoDoiDonHang/tracking.route');
const driverAssignmentRoutes = require('./routes/D07_TaiXeNhanChuyen/assignment.route');
const pickupRoutes = require('./routes/D08_XacNhanLayHang/pickup.route');
const progressRoutes = require('./routes/D09_CapNhatTienDoGiaoHang/progress.route');
const { requireAuth } = require('./middlewares/auth.middleware');
const AppError = require('./errors/AppError');
const partnerApplicationRoutes = require('./routes/partnerApplication.route');
const adminRoutes = require('./routes/admin.route');
const memberBRoutes = require('./routes/memberB.route');
const errorHandler = require('./middlewares/errorHandler');
const { UPLOAD_DIR } = require('./controllers/uploads.controller');
const storeRoutes = require('./routes/store.route');
const listingRoutes = require('./routes/listing.route');
const authRoutes = require('./routes/register.route');
const passwordResetRoutes = require('./routes/passwordReset.route');
const sellerOrder = require('./routes/sellerOrder.route');
const preparation = require('./routes/preparation.route');

const app = express();

// Website gọi API cùng origin qua Nginx (/api), nên mặc định không mở CORS.
// Cần gọi từ domain khác thì khai báo CORS_ORIGINS, ngăn cách bằng dấu phẩy.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/', (_request, response) => {
  response.json({
    name: 'Chợ Đồ Cũ API',
    version: '1.0.0',
    health: '/api/health'
  });
});

app.get('/api/test', (_request, response) => {
  response.json({
    message: 'API hoạt động'
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/v1/orders', orderRoutes.createOrderRouter(requireAuth));
app.use('/api/v1/orders', cancellationRoutes);
app.use('/api/orders', require('./routes/C06_TuChoiDonHang/rejection.route'));
app.use('/api/v1/orders', paymentRoutes);
app.use('/api/v1/orders', trackingRoutes);
app.use('/api/v1/seller/orders', confirmationRoutes);
app.use('/api/v1/driver', driverAssignmentRoutes);
app.use('/api/v1', pickupRoutes);
app.use('/api/v1/driver', progressRoutes);


//PARTNER APPLICATION
app.use("/api/partner-applications", partnerApplicationRoutes);
//Store
app.use("/api/stores", storeRoutes);
//listing
app.use("/api/seller/listing", listingRoutes);
//seller order
app.use('/api/seller/store/order', sellerOrder)
//preparation
app.use('/api/seller/orders', preparation)

// PHÂN HỆ B: QUẢN TRỊ VÀ DOANH THU
app.use('/api/v1/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d', dotfiles: 'ignore' }));
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', memberBRoutes);

app.use((_request, _response, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Không tìm thấy đường dẫn API.'));
});

app.use(errorHandler);

module.exports = app;
