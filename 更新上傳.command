#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "📂 資料夾：$(pwd)"

# ── 1. 上傳資料夾變更到 GitHub ──
echo "⏳ (1/2) 上傳變更到 GitHub..."
git add -A
git commit -m "update $(date '+%Y/%m/%d %H:%M')" || echo "（沒有檔案變更，略過 commit）"
git push || echo "⚠ push 失敗（可能沒變更或需登入）"

# ── 2. 觸發雲端抓最新股價 + 產生解讀 ──
echo ""
echo "⏳ (2/2) 觸發雲端抓取最新資料..."
TOKEN=$(cat ~/.tsmc_token 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "❌ 找不到 token（~/.tsmc_token），略過抓取觸發。"
else
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/mastalk1024/tsmc-dashboard/actions/workflows/update-data.yml/dispatches" \
    -d '{"ref":"main"}')
  if [ "$HTTP" = "204" ]; then
    echo "✅ 已觸發雲端抓取（約 1 分鐘後完成）"
  else
    echo "⚠ 觸發回應碼：$HTTP（若非 204 請截圖給我）"
  fi
fi

echo ""
echo "🎉 全部完成！約 1 分鐘後重整網頁即為最新："
echo "   https://mastalk1024.github.io/tsmc-dashboard/"
echo "（可關閉此視窗）"
