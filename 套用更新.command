#!/bin/bash
REPO="/Users/issaccheng/Dropbox/AI排程作業/Issac/tsmc-dashboard"
cd "$REPO" || exit 1
echo "📂 $REPO"

# 1) 找「下載」資料夾裡最新的 tsmc-update.zip
ZIP=$(ls -t ~/Downloads/tsmc-update*.zip 2>/dev/null | head -1)
if [ -z "$ZIP" ]; then
  echo "❌ 下載資料夾找不到 tsmc-update.zip，請先下載更新檔。"
  echo "（可關閉此視窗）"; exit 1
fi
echo "📦 使用更新檔：$ZIP"

# 2) 解壓覆蓋到 repo（原位覆蓋 index.html 與 scripts/）
unzip -o "$ZIP" -d "$REPO" >/dev/null && echo "✅ (1/3) 已套用新檔"

# 3) 上傳到 GitHub（先同步再推）
echo "⏳ (2/3) 上傳到 GitHub..."
git pull --no-edit >/dev/null 2>&1
git add -A
git commit -m "apply update $(date '+%Y/%m/%d %H:%M')" >/dev/null 2>&1 || echo "（沒有變更）"
git push >/dev/null 2>&1 && echo "✅ 已上傳"

# 4) 觸發雲端抓最新資料
echo "⏳ (3/3) 觸發雲端抓取..."
TOKEN=$(cat ~/.tsmc_token 2>/dev/null | tr -d '[:space:]')
if [ -n "$TOKEN" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/mastalk1024/tsmc-dashboard/actions/workflows/update-data.yml/dispatches" \
    -d '{"ref":"main"}')
  [ "$HTTP" = "204" ] && echo "✅ 已觸發抓取" || echo "⚠ 觸發回應碼：$HTTP"
fi

echo ""
echo "🎉 完成！約 1 分鐘後重整網頁即為最新："
echo "   https://mastalk1024.github.io/tsmc-dashboard/"
echo "（可關閉此視窗）"
