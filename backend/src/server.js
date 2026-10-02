require('dotenv').config();

const app = require('./app');
const sequelize = require('./database');
const {
  startReservationExpirationJob,
  stopReservationExpirationJob
} = require('./jobs/reservationExpiration.job');

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    await sequelize.authenticate();
    const server = app.listen(port, () => {
      console.log(`Chợ Đồ Cũ API đang chạy tại http://localhost:${port}`);
      startReservationExpirationJob();
    });

    const shutdown = () => {
      stopReservationExpirationJob();
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error('Không thể kết nối cơ sở dữ liệu:', error.message);
    process.exit(1);
  }
}

start();
