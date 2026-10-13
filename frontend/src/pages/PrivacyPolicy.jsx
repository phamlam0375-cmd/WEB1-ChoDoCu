import { Link } from 'react-router-dom'
import './PrivacyPolicy.scss'

function PrivacyPolicy() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <Link className="privacy-home-link" to="/">ChoĐồCũ</Link>
        <h1>Chính sách quyền riêng tư</h1>
        <p className="privacy-updated">Cập nhật lần cuối: 13/10/2026</p>

        <p>
          Chính sách này giải thích cách ChoĐồCũ thu thập, sử dụng, lưu trữ và
          bảo vệ thông tin khi bạn sử dụng website mua bán đồ cũ và các chức
          năng liên quan.
        </p>

        <h2>1. Thông tin chúng tôi thu thập</h2>
        <ul>
          <li>
            Thông tin bạn cung cấp khi tạo và sử dụng tài khoản, như họ tên,
            email, số điện thoại, địa chỉ và thông tin hồ sơ (nếu có).
          </li>
          <li>
            Nội dung bạn đăng hoặc gửi qua dịch vụ, như tin đăng, hình ảnh sản
            phẩm, yêu cầu hỗ trợ và thông tin liên quan đến đơn hàng.
          </li>
          <li>
            Khi đăng nhập bằng Google, chúng tôi nhận mã định danh tài khoản,
            email đã xác minh, tên và ảnh hồ sơ mà Google cung cấp. Chúng tôi
            không nhận mật khẩu Google và không truy cập dữ liệu Google khác
            như Gmail, Drive hoặc danh bạ.
          </li>
          <li>
            Thông tin kỹ thuật và nhật ký hoạt động cần thiết để vận hành,
            bảo mật và xử lý lỗi của dịch vụ.
          </li>
        </ul>

        <h2>2. Cách chúng tôi sử dụng thông tin</h2>
        <p>Thông tin được sử dụng để:</p>
        <ul>
          <li>Tạo, xác minh, bảo vệ và quản lý tài khoản của bạn.</li>
          <li>Hiển thị tin đăng và hỗ trợ hoạt động mua bán, đơn hàng.</li>
          <li>Gửi mã xác minh, thông báo dịch vụ và phản hồi yêu cầu hỗ trợ.</li>
          <li>Phát hiện hành vi gian lận, duy trì an toàn và cải thiện website.</li>
          <li>Thực hiện nghĩa vụ pháp lý khi được yêu cầu hợp lệ.</li>
        </ul>

        <h2>3. Đăng nhập bằng Google</h2>
        <p>
          Nếu bạn chọn đăng nhập bằng Google, Google xác thực danh tính và gửi
          thông tin hồ sơ cơ bản đã nêu ở trên cho ChoĐồCũ. Việc sử dụng thông
          tin nhận từ Google tuân thủ{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Chính sách dữ liệu người dùng của Google API Services
          </a>
          . Bạn có thể thu hồi quyền kết nối trong phần bảo mật tài khoản
          Google.
        </p>

        <h2>4. Lưu trữ và chia sẻ thông tin</h2>
        <p>
          Thông tin tài khoản và hoạt động được lưu trong cơ sở dữ liệu của
          dịch vụ. Chúng tôi không bán dữ liệu cá nhân. Thông tin chỉ được chia
          sẻ khi cần để cung cấp chức năng bạn yêu cầu, bảo vệ dịch vụ hoặc
          tuân thủ pháp luật. Nội dung trong tin đăng có thể được hiển thị cho
          người dùng khác theo chức năng của website; không đăng thông tin nhạy
          cảm vào nội dung công khai.
        </p>

        <h2>5. Thời hạn lưu trữ và yêu cầu xóa dữ liệu</h2>
        <p>
          Chúng tôi lưu thông tin khi tài khoản còn hoạt động hoặc khi cần thiết
          cho các mục đích nêu trong chính sách này. Bạn có thể yêu cầu truy
          cập, sửa hoặc xóa dữ liệu cá nhân bằng cách liên hệ{' '}
          <a href="mailto:chiloc07102002@gmail.com">chiloc07102002@gmail.com</a>
          . Chúng tôi sẽ xác minh yêu cầu và có thể giữ lại một số thông tin
          nếu pháp luật yêu cầu hoặc cần thiết để giải quyết tranh chấp, bảo vệ
          an toàn dịch vụ.
        </p>

        <h2>6. Bảo mật</h2>
        <p>
          Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để hạn
          chế truy cập, sử dụng hoặc tiết lộ thông tin trái phép. Không có
          phương thức truyền tải hay lưu trữ điện tử nào bảo đảm an toàn tuyệt
          đối.
        </p>

        <h2>7. Trẻ em và thay đổi chính sách</h2>
        <p>
          Dịch vụ không hướng đến trẻ em dưới 13 tuổi. Khi chính sách thay đổi,
          phiên bản mới sẽ được đăng tại trang này cùng ngày cập nhật.
        </p>

        <h2>8. Liên hệ</h2>
        <p>
          Nếu có câu hỏi hoặc yêu cầu liên quan đến quyền riêng tư, vui lòng
          liên hệ{' '}
          <a href="mailto:chiloc07102002@gmail.com">chiloc07102002@gmail.com</a>.
        </p>

        <p className="privacy-back-link">
          <Link to="/login">Quay lại đăng nhập</Link>
        </p>
      </article>
    </main>
  )
}

export default PrivacyPolicy
