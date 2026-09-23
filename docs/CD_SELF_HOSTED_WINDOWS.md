# CD tren laptop Windows bang GitHub Actions

Tai lieu nay cau hinh laptop lam may chu trien khai cho do an. CI van chay tren may chu GitHub. CD chi chay tren laptop sau khi CI cua nhanh `master` thanh cong.

## 1. Mo Docker Desktop

1. Mo Docker Desktop.
2. Cho den khi hien `Engine running`.
3. Dam bao Docker dang dung Linux containers.
4. Mo PowerShell va kiem tra:

```powershell
docker version
docker compose version
```

## 2. Dung he thong Docker dang chay thu cong

Chi lam mot lan truoc lan deploy dau tien de tranh trung cong 3000, 3306 va 8080.

Tai thu muc du an dang chay thu cong:

```powershell
docker compose down
```

Lenh nay khong xoa volume MySQL vi khong co tuy chon `-v`.

## 3. Tao Self-hosted Runner tren GitHub

1. Mo repository `WEB1-ChoDoCu`.
2. Vao `Settings` -> `Actions` -> `Runners`.
3. Chon `New self-hosted runner`.
4. Chon:
   - Runner image: Windows
   - Architecture: x64
5. GitHub se hien cac lenh cai dat rieng kem token tam thoi.
6. Mo PowerShell va chay dung cac lenh GitHub cung cap trong thu muc rieng, vi du:

```powershell
mkdir C:\actions-runner
cd C:\actions-runner
```

7. Khi `config.cmd` hoi thong tin, co the chon:
   - Runner group: nhan Enter de dung Default
   - Runner name: `laptop-lam`
   - Additional labels: nhan Enter
   - Work folder: nhan Enter de dung `_work`

Khong gui token runner vao chat, khong commit token vao repository.

## 4. Chay Runner

Trong PowerShell tai `C:\actions-runner`:

```powershell
.\run.cmd
```

Giu cua so nay mo. Khi thay thong bao sau thi laptop da san sang nhan lenh CD:

```text
Listening for Jobs
```

Trong giai doan lam do an, nen chay runner theo cach nay thay vi cai thanh Windows Service, vi runner can dung Docker Desktop trong tai khoan Windows hien tai.

## 5. Kich hoat CD

Sau khi Pull Request CD duoc merge vao `master`:

1. GitHub chay workflow `CI - Cho do cu`.
2. Neu Frontend, Backend va Docker deu thanh cong, workflow `CD - Deploy laptop` moi bat dau.
3. Laptop tu checkout dung commit da qua CI.
4. Laptop build va chay:

```powershell
docker compose -p cho-do-cu-cd up -d --build --remove-orphans
```

5. Workflow kiem tra API va Nginx. Neu mot buoc loi, CD hien log container va bao mau do.

Co the chay lai thu cong tai `Actions` -> `CD - Deploy laptop` -> `Run workflow`.

## 6. Kiem tra sau khi deploy

Tren laptop:

- API health: http://localhost:3000/api/health
- Nginx: http://localhost:8080

Kiem tra container:

```powershell
docker compose -p cho-do-cu-cd ps
```

Xem log:

```powershell
docker compose -p cho-do-cu-cd logs -f
```

## 7. Du lieu Seeder

CD khong tu chay Seeder, vi hon 2,2 trieu ban ghi rat nang va khong nen tao lai sau moi lan merge.

Chi chay mot lan khi can:

```powershell
docker compose -p cho-do-cu-cd exec api npm run db:seed
docker compose -p cho-do-cu-cd exec api npm run db:verify
```

## 8. Cau hinh bi mat tuy chon

Neu chua tao GitHub Secret, CD dung `backend/.env.example` cho moi truong demo local.

Khi can mat khau rieng, tao file `backend/.env`, chuyen noi dung sang Base64 va luu vao GitHub Secret ten `BACKEND_ENV_B64`. Khong commit file `.env`.

## 9. Dieu kien de CD hoat dong

- Laptop dang bat.
- Khong de laptop Sleep.
- Docker Desktop dang chay.
- Cua so `run.cmd` dang mo va hien `Listening for Jobs`.
- Ket noi Internet on dinh.
- Cac cong 3000, 3306 va 8080 khong bi ung dung khac chiem.

Neu laptop tat, CI van chay binh thuong nhung job CD se cho runner online.
