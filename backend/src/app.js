const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');
const orderRoutes = require('./routes/order.route');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./errors/AppError');

const partnerApplicationRoutes = require('./routes/partnerApplication.route');
const adminRoutes = require('./routes/admin.route');
const memberBRoutes = require('./routes/memberB.route');
const errorHandler = require('./middlewares/errorHandler');
const { UPLOAD_DIR } = require('./controllers/uploads.controller');

const app = express();

app.use(helmet());
app.use(cors());
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
app.use('/api/orders', orderRoutes);



//PARTNER APPLICATION
app.use("/api/partner-applications", partnerApplicationRoutes);

// PHÂN HỆ B: QUẢN TRỊ VÀ DOANH THU
app.use('/api/v1/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d' }));
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', memberBRoutes);



app.use((_request, _response, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Không tìm thấy đường dẫn API.'));
});

app.use(errorHandler);

module.exports = app;
