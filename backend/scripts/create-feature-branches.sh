#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BRANCH_FILE="$ROOT_DIR/scripts/feature-branches.txt"

cd "$ROOT_DIR"

if [ ! -d .git ]; then
  echo "Chưa có Git repository. Hãy chạy git init -b main và tạo commit đầu tiên trước."
  exit 1
fi

if ! git show-ref --verify --quiet refs/heads/develop; then
  git branch develop main
fi

while IFS='|' read -r code owner branch feature; do
  case "$code" in
    ''|'#'*) continue ;;
  esac

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "Đã tồn tại: $branch"
    continue
  fi

  git switch --quiet --create "$branch" develop
  git commit --allow-empty --quiet -m "chore($code): initialize $feature"
  echo "Đã tạo: $branch (thành viên $owner)"
done < "$BRANCH_FILE"

git switch --quiet develop
echo "Hoàn tất. Branch hiện tại: $(git branch --show-current)"
