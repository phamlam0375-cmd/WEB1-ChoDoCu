const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRouter = require('./routes/health');

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

app.use('/api/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({ message: 'Không tìm thấy tài nguyên.' });
});

module.exports = app;
