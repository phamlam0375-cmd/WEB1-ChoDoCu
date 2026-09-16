# Đưa dự án lên GitHub và mời thành viên

Phần này cần trưởng nhóm thực hiện bằng tài khoản GitHub của mình. Không đưa token hoặc mật khẩu GitHub vào mã nguồn.

## 1. Tạo repository và đẩy toàn bộ branch

Cách dùng GitHub CLI:

```bash
gh auth login
gh repo create cho-do-cu-nhom-4 --private --source=. --remote=origin
git push -u origin main
git push -u origin develop
git push --all origin
```

Nếu đã tạo repository trên website GitHub:

```bash
git remote add origin https://github.com/TEN-TAI-KHOAN/cho-do-cu-nhom-4.git
git push -u origin main
git push -u origin develop
git push --all origin
```

Kiểm tra:

```bash
git remote -v
git branch -r
```

Repository phải có `main`, `develop` và đủ 40 branch bắt đầu bằng `feature/`.

## 2. Mời ba thành viên còn lại

Trên GitHub mở repository, chọn:

`Settings` → `Collaborators` → `Add people`

Nhập đúng username GitHub của từng thành viên và gửi lời mời. Mỗi người phải mở email hoặc GitHub để chấp nhận lời mời.

Có thể mời bằng GitHub CLI sau khi thay đúng chủ repository và username:

```bash
gh api --method PUT repos/CHU-REPO/cho-do-cu-nhom-4/collaborators/USERNAME_2 -f permission=push
gh api --method PUT repos/CHU-REPO/cho-do-cu-nhom-4/collaborators/USERNAME_3 -f permission=push
gh api --method PUT repos/CHU-REPO/cho-do-cu-nhom-4/collaborators/USERNAME_4 -f permission=push
```

## 3. Bảo vệ branch

Trong `Settings` → `Branches`, tạo rule cho `main` và `develop`:

- Bắt buộc Pull Request trước khi merge.
- Bắt buộc ít nhất một người duyệt.
- Không cho force push.
- Không xóa branch được bảo vệ.

## 4. Quy trình nhóm

1. Mỗi người clone repository và chuyển đến branch đúng mã chức năng.
2. Mỗi chức năng chỉ code trên branch tương ứng.
3. Tạo Pull Request từ `feature/...` vào `develop`.
4. Kiểm thử tích hợp trên `develop`.
5. Chỉ trưởng nhóm merge `develop` vào `main` khi bản chạy ổn định.
