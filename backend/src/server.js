require('dotenv').config();

const app = express();

// Cấu hình CORS và Body Parser
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Bộ nhớ tạm trong RAM
const otpStore = {};       // Lưu OTP chờ xác thực
const registeredUsers = [  // Danh sách tài khoản đã xác thực thành công
  { email: 'admin@gmail.com', password: '123456' }
];

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER || 'chiloc07102002@gmail.com',
    pass: process.env.MAIL_PASS || 'pxznrlvtjfebcpqv',
  },
  tls: { rejectUnauthorized: false }
});

// 1. ROUTE ĐĂNG KÝ VÀ GỬI OTP
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email và Mật khẩu!' });
  }

  // Kiểm tra nếu email đã tồn tại
  const existingUser = registeredUsers.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email này đã được đăng ký tài khoản!' });
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Lưu thông tin kèm mật khẩu tạm vào RAM (5 phút)
  otpStore[email] = { 
    otp: generatedOtp, 
    password: password, 
    expiresAt: Date.now() + 5 * 60 * 1000 
  };

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
