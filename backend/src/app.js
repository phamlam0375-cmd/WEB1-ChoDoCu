const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');

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



//PARTNER APPLICATION
app.use("/api/partner-applications", partnerApplicationRoutes);

// PHÂN HỆ B: QUẢN TRỊ VÀ DOANH THU
app.use('/api/v1/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d' }));
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', memberBRoutes);



app.use((_request, response) => {
  response.status(404).json({ message: '404 NOT FOUND' });
});

app.use(errorHandler);

module.exports = app;
