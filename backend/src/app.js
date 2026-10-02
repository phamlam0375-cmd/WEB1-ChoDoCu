const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');
const orderRoutes = require('./routes/order.route');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./errors/AppError');

const partnerApplicationRoutes = require('./routes/partnerApplication.route');

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



app.use((_request, _response, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Không tìm thấy đường dẫn API.'));
});

app.use(errorHandler);

module.exports = app;
