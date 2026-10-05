@echo off
rem Xuat du lieu MySQL dang chay trong Docker ra backend\data\snapshot.sql de chia se qua Git.
rem May khac clone ve (database con trong) se tu nap file nay khi chay docker compose up.
cd /d "%~dp0.."
docker compose exec -T mysql mysqldump -ucho_do_cu -pcho_do_cu_password --no-tablespaces --single-transaction --default-character-set=utf8mb4 --skip-comments -r /tmp/snapshot.sql cho_do_cu || exit /b 1
docker compose cp mysql:/tmp/snapshot.sql backend/data/snapshot.sql || exit /b 1
echo Da xuat du lieu ra backend\data\snapshot.sql
