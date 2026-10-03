#!/usr/bin/env sh
# Xuất dữ liệu MySQL đang chạy trong Docker ra backend/data/snapshot.sql để chia sẻ qua Git.
# Máy khác clone về (database còn trống) sẽ tự nạp file này khi chạy docker compose up.
set -e
# Git Bash trên Windows tự đổi đường dẫn /tmp/... thành đường dẫn Windows; tắt việc này.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
docker compose exec -T mysql mysqldump -ucho_do_cu -pcho_do_cu_password --no-tablespaces --single-transaction --default-character-set=utf8mb4 --skip-comments -r /tmp/snapshot.sql cho_do_cu
docker compose cp mysql:/tmp/snapshot.sql backend/data/snapshot.sql
echo "Đã xuất dữ liệu ra backend/data/snapshot.sql"
