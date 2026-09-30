#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "📂 資料夾：$(pwd)"

echo "⏳ (1/3) 先同步雲端最新資料..."
git pull --no-edit || echo "（pull 略過）"

echo "⏳ (2/3) 上傳本機變更..."
git add -A
git commit -m "update $(date '+%Y/%m/%d %H:%M')" || echo "（沒有檔案變更，略過 commit）"
git push || echo "⚠ push 略過（可能沒變更）"

echo ""
echo "⏳ (3/3) 觸發雲端抓取最新資料..."
TOKEN=$(cat ~/.tsmc_token 2>/dev/null | tr -d '[:space:]')
if [ -z "$TOKEN" ]; then
  echo "❌ 找不到 token（~/.tsmc_token）"
else
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/mastalk1024/tsmc-dashboard/actions/workflows/update-data.yml/dispatches" \
    -d '{"ref":"main"}')
  if [ "$HTTP" = "204" ]; then
    echo "✅ 已觸發雲端抓取（約 1 分鐘後完成）"
  else
    echo "⚠ 觸發回應碼：$HTTP"
  fi
fi

echo ""
echo "🎉 全部完成！約 1 分鐘後重整網頁即為最新："
echo "   https://mastalk1024.github.io/tsmc-dashboard/"
echo "（可關閉此視窗）"
