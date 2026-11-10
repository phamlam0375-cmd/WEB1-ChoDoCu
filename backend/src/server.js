'use strict';

require('dotenv').config();

const { createServer } = require('node:http');
const { Server } = require('socket.io');

const app = require('./app');
const sequelize = require('./database');
const { startElasticsearchSyncJob } =
  require('./services/elasticsearchSyncJob');
const {
  startReservationExpirationJob,
  stopReservationExpirationJob
} = require('./jobs/reservationExpiration.job');

const port = Number(process.env.PORT || 3000);

// Tạo HTTP server dùng chung với Express
const httpServer = createServer(app);

// Khởi tạo Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Gắn io vào app để controller có thể gọi req.app.get('io')
app.set('io', io);

// Xử lý kết nối Socket.IO
io.on('connection', (socket) => {
  // Client tham gia vào room của conversation
  socket.on('join_conversation', (conversationId) => {
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
    }
  });

  socket.on('leave_conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
    }
  });

  socket.on('disconnect', () => {
    // Tự động rời rooms khi disconnect
  });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Đã kết nối cơ sở dữ liệu.');
  } catch (error) {
    console.error('Không thể kết nối cơ sở dữ liệu:', error.message);
    process.exitCode = 1;
    return;
  }

 httpServer.listen(port, () => {
  console.log(`Chợ Đồ Cũ API đang chạy tại http://localhost:${port}`);

  startReservationExpirationJob();

  // Tự động đồng bộ MySQL sang Elasticsearch
  startElasticsearchSyncJob();
});

  const shutdown = () => {
    stopReservationExpirationJob();

    // Đóng kết nối Socket.IO trước
    io.close(async () => {
      httpServer.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  start();
}

module.exports = { start, io, httpServer };
