'use strict';

// Đổi dữ liệu mẫu từ tên giả ("Người dùng 000005", "Danh mục 000001", "Sản phẩm cũ minh họa 000003")
// sang tên, danh mục, tin đăng và gian hàng giống thật để demo.
// - Chỉ cập nhật dòng còn giữ tên mẫu, không đụng dữ liệu người dùng tự tạo.
// - Giữ nguyên giá tin đăng vì giá gắn với đơn hàng, thanh toán và hoa hồng đã có.

const USERS = [
  ['Nguyễn Văn An', '45 Lê Lợi, Phường Bến Nghé, Quận 1'],
  ['Lê Hoàng Minh', '120 Nguyễn Thị Minh Khai, Quận 3'],
  ['Trần Thị Thu Hà', '18 Hoàng Diệu, Quận 4'],
  ['Phạm Quốc Bảo', '72 Trần Hưng Đạo, Quận 5'],
  ['Võ Thị Mỹ Linh', '9 Hậu Giang, Quận 6'],
  ['Đặng Minh Khoa', '210 Nguyễn Thị Thập, Quận 7'],
  ['Huỳnh Ngọc Trâm', '35 Phạm Thế Hiển, Quận 8'],
  ['Bùi Thanh Tùng', '88 Lê Văn Việt, TP. Thủ Đức'],
  ['Ngô Thị Kim Anh', '14 Ba Tháng Hai, Quận 10'],
  ['Đỗ Văn Hùng', '56 Lạc Long Quân, Quận 11'],
  ['Hồ Thị Lan Anh', '301 Nguyễn Ảnh Thủ, Quận 12'],
  ['Dương Quang Huy', '27 Phan Đăng Lưu, Quận Bình Thạnh'],
  ['Lý Thị Hồng Nhung', '64 Quang Trung, Quận Gò Vấp'],
  ['Phan Đức Thịnh', '19 Phan Xích Long, Quận Phú Nhuận'],
  ['Mai Thị Thanh Thảo', '150 Cộng Hòa, Quận Tân Bình'],
  ['Trương Gia Bảo', '42 Lũy Bán Bích, Quận Tân Phú'],
  ['Lâm Thị Ngọc Ánh', '8 Tên Lửa, Quận Bình Tân'],
  ['Vũ Hoàng Nam', '230 Võ Văn Ngân, TP. Thủ Đức'],
  ['Cao Thị Diễm My', '11 Nguyễn Văn Linh, Quận 7'],
  ['Tạ Minh Quân', '97 Trường Chinh, Quận Tân Bình'],
];

const CATEGORIES = [
  ['Sách & giáo trình', 'Sách, giáo trình, truyện đã qua sử dụng'],
  ['Điện thoại & phụ kiện', 'Điện thoại cũ, ốp lưng, cáp sạc, cường lực'],
  ['Máy tính & linh kiện', 'Chuột, bàn phím, ổ cứng, linh kiện máy tính'],
  ['Âm thanh', 'Tai nghe, loa, micro đã qua sử dụng'],
  ['Đồ gia dụng', 'Ấm đun, quạt, nồi cơm và thiết bị gia đình'],
  ['Đồ dùng nhà bếp', 'Hộp đựng thực phẩm, chén bát, dụng cụ nấu ăn'],
  ['Nội thất nhỏ', 'Kệ, bàn gấp, ghế và đồ nội thất cỡ nhỏ'],
  ['Thời trang nam', 'Áo, quần, áo khoác nam còn tốt'],
  ['Thời trang nữ', 'Áo, váy, áo khoác nữ còn tốt'],
  ['Giày dép', 'Giày, dép, sandal đã qua sử dụng'],
  ['Túi xách & ví', 'Balo, túi xách, ví da'],
  ['Đồng hồ & trang sức', 'Đồng hồ, vòng tay, phụ kiện cá nhân'],
  ['Thể thao & dã ngoại', 'Dụng cụ thể thao, đồ cắm trại'],
  ['Xe đạp & phụ tùng', 'Xe đạp, đèn, khóa và phụ tùng xe đạp'],
  ['Đồ chơi trẻ em', 'Đồ chơi, xếp hình, đồ chơi giáo dục'],
  ['Mẹ và bé', 'Bình sữa, xe đẩy, đồ dùng cho bé'],
  ['Văn phòng phẩm', 'Bút, sổ, máy tính cầm tay, dụng cụ học tập'],
  ['Nhạc cụ', 'Đàn, kèn, phụ kiện nhạc cụ'],
  ['Máy ảnh & phụ kiện', 'Chân máy, ống kính, phụ kiện chụp ảnh'],
  ['Đồ trang trí', 'Đèn ngủ, khung ảnh, đồ trang trí nhà cửa'],
];

// Tin đăng số i thuộc danh mục số i; mô tả khớp với tình trạng đã có của tin.
const LISTINGS = [
  ['Giáo trình Kinh tế vi mô (tái bản 2022)', 'Sách còn tốt, vài trang có ghi chú bút chì, không rách.'],
  ['Ốp lưng iPhone 13 trong suốt kèm kính cường lực', 'Ốp hơi ố vàng ở viền, kính cường lực chưa dán.'],
  ['Chuột không dây Logitech M185', 'Chuột vẫn dùng được nhưng nút cuộn hơi lỏng, đầu thu USB còn đủ.'],
  ['Tai nghe có dây Sony MDR-EX15', 'Mới dùng vài lần, còn hộp và nút tai dự phòng.'],
  ['Ấm siêu tốc Sunhouse 1.8L', 'Đun nhanh, đã vệ sinh sạch, vỏ có vài vết xước nhỏ.'],
  ['Bộ 3 hộp thủy tinh Lock&Lock', 'Nắp hơi ố nhưng không nứt, đậy kín bình thường.'],
  ['Kệ sách gỗ mini 3 tầng', 'Kệ hơi lung lay, cần siết lại ốc, mặt gỗ có trầy.'],
  ['Áo sơ mi nam Uniqlo size M', 'Mặc 1–2 lần, màu xanh nhạt, không phai không xù.'],
  ['Áo khoác cardigan len nữ màu be', 'Len mềm, còn đẹp, freesize.'],
  ['Dép Biti\'s Hunter size 40', 'Đế mòn nhẹ, quai còn chắc, đã giặt sạch.'],
  ['Ví da nam màu nâu', 'Da sờn ở góc, khóa kéo bên trong bị kẹt nhẹ.'],
  ['Đồng hồ Casio F-91W', 'Gần như mới, vừa thay pin, dây còn nguyên.'],
  ['Vợt cầu lông Yonex kèm bao', 'Khung chắc, đã đan lại cước, bao vợt còn tốt.'],
  ['Đèn xe đạp sạc USB', 'Sáng tốt, pin giữ khoảng 2 giờ, kẹp gắn hơi lỏng.'],
  ['Bộ xếp hình Lego Classic 300 chi tiết', 'Thiếu vài miếng nhỏ, còn hộp đựng.'],
  ['Bình sữa Pigeon 240ml', 'Dùng ít, đã tiệt trùng, núm mới thay.'],
  ['Bộ bút highlight Stabilo 6 màu', 'Mực còn khoảng 70%, đủ 6 màu.'],
  ['Kèn harmonica Suzuki 10 lỗ', 'Thổi được đủ nốt, vỏ có vài vết xước.'],
  ['Chân máy mini tripod cho điện thoại', 'Một chân bị lỏng khớp, kẹp điện thoại vẫn dùng tốt.'],
  ['Đèn ngủ LED hình mặt trăng', 'Mới dùng vài lần, đủ 3 chế độ sáng, còn dây sạc.'],
];

const shortName = (fullName) => fullName.split(' ').slice(-1)[0];

module.exports = {
  async up(queryInterface) {
    const run = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });

    for (const [index, [fullName, address]] of USERS.entries()) {
      const id = index + 1;
      await run(
        "UPDATE Users SET FullName = :fullName, Address = :address WHERE UserId = :id AND FullName LIKE 'Người dùng 0%'",
        { id, fullName, address: `${address}, TP. Hồ Chí Minh` }
      );
      await run(
        "UPDATE Stores SET StoreName = :name, Description = :description, Address = :address WHERE OwnerId = :id AND StoreName LIKE 'Gian hàng đồ cũ 0%'",
        {
          id,
          name: `Góc đồ cũ của ${shortName(fullName)}`,
          description: 'Đồ cũ còn tốt, giá sinh viên, có thể xem hàng trực tiếp trước khi mua.',
          address: `${address}, TP. Hồ Chí Minh`,
        }
      );
    }

    for (const [index, [name, description]] of CATEGORIES.entries()) {
      await run(
        "UPDATE Categories SET CategoryName = :name, Description = :description WHERE CategoryId = :id AND CategoryName LIKE 'Danh mục 0%'",
        { id: index + 1, name, description }
      );
    }

    for (const [index, [title, description]] of LISTINGS.entries()) {
      const id = index + 1;
      const district = USERS[index][1].split(', ').slice(-1)[0];
      await run(
        "UPDATE Listings SET Title = :title, Description = :description, Location = :location WHERE ListingId = :id AND Title LIKE 'Sản phẩm cũ minh họa%'",
        { id, title, description, location: `${district}, TP. Hồ Chí Minh` }
      );
    }
  },

  async down(queryInterface) {
    const run = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const pad = (n) => String(n).padStart(6, '0');

    for (let id = 1; id <= USERS.length; id += 1) {
      await run('UPDATE Users SET FullName = :fullName, Address = :address WHERE UserId = :id AND FullName = :current', {
        id, fullName: `Người dùng ${pad(id)}`, address: `Địa chỉ minh họa số ${id}, Việt Nam`, current: USERS[id - 1][0],
      });
      await run('UPDATE Stores SET StoreName = :name, Description = :description, Address = :address WHERE OwnerId = :id AND StoreName = :current', {
        id, name: `Gian hàng đồ cũ ${pad(id)}`, description: `Gian hàng minh họa số ${id}`,
        address: `${id} Đường Minh Họa, TP. Hồ Chí Minh`, current: `Góc đồ cũ của ${shortName(USERS[id - 1][0])}`,
      });
      await run('UPDATE Categories SET CategoryName = :name, Description = :description WHERE CategoryId = :id AND CategoryName = :current', {
        id, name: `Danh mục ${pad(id)}`, description: `Danh mục dữ liệu minh họa số ${id}`, current: CATEGORIES[id - 1][0],
      });
      await run('UPDATE Listings SET Title = :title, Description = :description, Location = :location WHERE ListingId = :id AND Title = :current', {
        id, title: `Sản phẩm cũ minh họa ${pad(id)}`, description: `Mô tả sản phẩm cũ số ${id}, dùng cho dữ liệu minh họa.`,
        location: `Khu vực ${id}, TP. Hồ Chí Minh`, current: LISTINGS[id - 1][0],
      });
    }
  },
};
