# 台積電 + 高股息 ETF 每日進場儀表板（自動更新版）

網頁部署在 GitHub Pages，市場數據由 GitHub Actions 每天自動抓取（免費、不需付費 API）。
抓資料在 GitHub 伺服器端執行，沒有瀏覽器的 CORS 限制。

## 檔案說明
- `index.html`：儀表板本體（打開就是網頁）
- `data.json`：市場數據，由排程自動更新（已附初始值，網站一上線就能顯示）
- `scripts/fetch-data.js`：抓取台積電 / 加權指數 / 美股四大指數的腳本
- `.github/workflows/update-data.yml`：排程設定（每天自動跑 fetch 並更新 data.json）

## 一次性設定步驟（約 10 分鐘）

1. **建立 GitHub 帳號**（若已有可跳過）：https://github.com

2. **建立新的 Public 儲存庫（repository）**
   - 右上「＋」→ New repository
   - 名稱例如 `tsmc-dashboard`，選 **Public**，建立

3. **上傳這四個檔案／資料夾**（保持相同結構）
   - `index.html`、`data.json`
   - `scripts/fetch-data.js`
   - `.github/workflows/update-data.yml`
   - 可用網頁 Add file → Upload files 直接拖上去（注意 `.github` 資料夾要一起上傳）

4. **開啟 GitHub Pages**
   - Settings → Pages → Source 選「Deploy from a branch」
   - Branch 選 `main`、資料夾選 `/ (root)` → Save
   - 稍等 1～2 分鐘，會給你一個網址：`https://<你的帳號>.github.io/tsmc-dashboard/`

5. **開啟 Actions 的寫入權限**（讓排程能把 data.json 存回去）
   - Settings → Actions → General → 最下面 Workflow permissions
   - 選 **Read and write permissions** → Save

6. **手動跑一次測試**
   - Actions 分頁 → 左側「Update market data」→ Run workflow → Run
   - 跑完後回儲存庫看 `data.json` 的 updated 時間有沒有更新

7. **完成**：打開你的 Pages 網址就能看到儀表板，之後每天自動更新。
   - 手機用 Safari/Chrome 打開該網址 →「加入主畫面」，就能當 App 用、跨裝置都是最新。

## 排程時間
`update-data.yml` 內為 UTC 時間，預設：
- `0 6 * * 1-6`：台北 14:00（台股收盤後）
- `30 21 * * 1-6`：台北 05:30（美股收盤後）
可自行修改 cron。GitHub 的排程有時會延遲幾分鐘至數十分鐘，屬正常。

## 重要說明與限制
- 資料來源為 **Yahoo Finance 的公開端點（非官方）**，可能改版或暫時失效；若某格抓取失敗，會**保留上次資料**，你也可在網頁上**手動覆蓋**任何一格。
- **台指期**以「加權指數」近似（免費源不易取得期貨即時價）；欄位已標示為「加權指數（台指期近似）」。
- 新聞欄仍為手動輸入（存在你自己的瀏覽器），排程不會動它。
- 若 Yahoo 端點未來失效，只需改 `scripts/fetch-data.js` 換一個資料源即可，網頁不用動。
- 本工具為個人規劃/紀律用途，數字與殖利率會變動，**非投資建議**。
