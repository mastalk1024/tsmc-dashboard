#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "📂 資料夾：$(pwd)"
echo "⏳ 開始上傳到 GitHub..."
git add -A
git commit -m "update $(date '+%Y/%m/%d %H:%M')" || echo "（沒有變更，略過 commit）"
git push
echo ""
echo "✅ 完成！可關閉此視窗"
