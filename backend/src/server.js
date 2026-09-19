require('dotenv').config();

const app = require('./app');
const sequelize = require('./database');

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    await sequelize.authenticate();
    app.listen(port, () => {
      console.log(`Chợ Đồ Cũ API đang chạy tại http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Không thể kết nối cơ sở dữ liệu:', error.message);
    process.exit(1);
  }
}

start();
