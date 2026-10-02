#!/usr/bin/env sh
# Xuất dữ liệu MySQL đang chạy trong Docker ra backend/data/snapshot.sql để chia sẻ qua Git.
# Máy khác clone về (database còn trống) sẽ tự nạp file này khi chạy docker compose up.
set -e
cd "$(dirname "$0")/.."
docker compose exec -T mysql mysqldump -ucho_do_cu -pcho_do_cu_password --no-tablespaces --single-transaction --default-character-set=utf8mb4 --skip-comments -r /tmp/snapshot.sql cho_do_cu
docker compose cp mysql:/tmp/snapshot.sql backend/data/snapshot.sql
echo "Đã xuất dữ liệu ra backend/data/snapshot.sql"
