// 抓取台積電 / 加權指數 / 美股四大指數，寫入 data.json
// 在 GitHub Actions 伺服器端執行，無 CORS 限制。資料來源：Yahoo Finance（非官方，可能變動）
const fs = require("fs");

async function chart(symbol, range = "10d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tsmc-dashboard/1.0)" } });
  if (!r.ok) throw new Error(`${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const res = j.chart.result[0];
  const meta = res.meta;
  const closes = (res.indicators.quote[0].close || []).filter((x) => x != null);
  return { closes, price: meta.regularMarketPrice, prevClose: meta.chartPreviousClose ?? meta.previousClose };
}

// 取最近 n 個交易日的日漲跌 %
function pctSeries(closes, n = 3) {
  const out = [];
  const start = Math.max(1, closes.length - n);
  for (let i = start; i < closes.length; i++) {
    out.push(Number((((closes[i] - closes[i - 1]) / closes[i - 1]) * 100).toFixed(2)));
  }
  while (out.length < n) out.unshift(0);
  return out.slice(-n);
}

(async () => {
  const data = { updated: new Date().toISOString(), source: "Yahoo Finance" };

  try {
    const t = await chart("2330.TW");
    data.tsmc = { price: Math.round(t.price), prevClose: Math.round(t.prevClose) };
  } catch (e) { data.tsmcError = String(e); }

  try {
    const w = await chart("^TWII");
    data.twii = Math.round(w.price);
  } catch (e) { data.twiiError = String(e); }

  for (const [k, sym] of [["dow", "^DJI"], ["sp", "^GSPC"], ["nas", "^IXIC"], ["sox", "^SOX"]]) {
    try {
      const c = await chart(sym);
      data[k] = pctSeries(c.closes, 3);
    } catch (e) { data[k + "Error"] = String(e); }
  }

  // 若這次全部抓取失敗，保留舊檔，避免把有效資料洗掉
  const gotSomething = data.tsmc || data.twii || data.dow || data.sp || data.nas || data.sox;
  if (!gotSomething && fs.existsSync("data.json")) {
    console.log("全部抓取失敗，保留現有 data.json");
    process.exit(0);
  }

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
})();
