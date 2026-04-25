#!/usr/bin/env bash
# Hermes Desktop — Git 自动化脚本
# 用法: ./gitpush.sh "feat: 功能描述"
set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "用法: ./gitpush.sh \"commit message\""
  exit 1
fi

cd "$(dirname "$0")"

echo "📦 Staging changes..."
git add -A

echo "✏️  Committing: $MESSAGE"
git commit -m "$MESSAGE"

echo "🚀 Pushing to origin/main..."
git push origin main

echo "✅ Done!"
