'use strict';

require('dotenv').config();

const { createServer } = require('node:http');
const { Server } = require('socket.io');

const app = require('./app');
const sequelize = require('./database');
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

// Xử lý kết nối Socket.IO
io.on('connection', (socket) => {
  console.log('Socket kết nối:', socket.id);

  socket.on('send_message', (message) => {
    // Demo: phát tin nhắn đến mọi client đang kết nối
    io.emit('new_message', message);
  });

  socket.on('disconnect', () => {
    console.log('Socket ngắt kết nối:', socket.id);
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