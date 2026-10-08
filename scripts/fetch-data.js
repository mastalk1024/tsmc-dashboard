// 抓取台積電 / 加權指數 / 美股四大指數，並自動產生「數據解讀」，寫入 data.json
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

// 抓某檔近兩個月每日成交量（張），回傳 [{d,v}]
async function volHist(symbol, range = "2mo") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tsmc-dashboard/1.0)" } });
  if (!r.ok) throw new Error(`${symbol} vol HTTP ${r.status}`);
  const j = await r.json();
  const res = j.chart.result[0];
  const ts = res.timestamp || [];
  const vol = (res.indicators.quote[0].volume) || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (vol[i] == null) continue;
    const d = new Date(ts[i] * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    out.push({ d, v: Math.round(vol[i] / 1000) });
  }
  return out;
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
// 取最新一日漲跌 %
function lastChange(closes) {
  if (!closes || closes.length < 2) return null;
  const a = closes[closes.length - 2], b = closes[closes.length - 1];
  return Number((((b - a) / a) * 100).toFixed(2));
}

// 依收盤數據自動產生一段中文解讀
function buildNote(d) {
  const parts = [];
  const us = [["道瓊", d.dow], ["S&P", d.sp], ["納斯達克", d.nas], ["費半", d.sox]]
    .map(([n, a]) => [n, Array.isArray(a) ? a[a.length - 1] : null])
    .filter((x) => x[1] != null);
  if (us.length) {
    const ups = us.filter((x) => x[1] > 0).length, downs = us.filter((x) => x[1] < 0).length;
    const tone = ups === us.length ? "同步收紅" : downs === us.length ? "同步收黑" : "漲跌互現";
    const sox = d.sox ? d.sox[d.sox.length - 1] : null;
    let line = `美股${tone}`;
    if (sox != null) {
      line += `，費半${sox >= 0 ? "+" : ""}${sox}%`;
      if (sox <= -1) line += "（半導體轉弱，留意台積電/AI 供應鏈壓力）";
      else if (sox >= 1) line += "（半導體走強，有利台積電/AI 供應鏈）";
    }
    parts.push(line + "。");
  }
  if (d.tsmc && d.tsmc.price) {
    let s = `台積電收 ${d.tsmc.price}`;
    if (d.tsmc.prevClose) {
      const c = ((d.tsmc.price - d.tsmc.prevClose) / d.tsmc.prevClose) * 100;
      s += `（${c >= 0 ? "+" : ""}${c.toFixed(2)}%）`;
    }
    parts.push(s + "。");
  }
  if (d.twii) {
    let s = `加權指數 ${d.twii}`;
    if (d.twiiChg != null) s += `（${d.twiiChg >= 0 ? "+" : ""}${d.twiiChg}%）`;
    parts.push(s + "。");
  }
  if (us.length) {
    const avg = us.reduce((a, x) => a + x[1], 0) / us.length;
    const mood = avg >= 0.5 ? "外部氛圍偏強" : avg <= -0.5 ? "外部氛圍偏弱" : "外部氛圍中性";
    parts.push(mood + "，仍以個人設定的價位區間為主要進出依據。");
  }
  return parts.join("");
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
    data.twiiChg = lastChange(w.closes);
  } catch (e) { data.twiiError = String(e); }

  for (const [k, sym] of [["dow", "^DJI"], ["sp", "^GSPC"], ["nas", "^IXIC"], ["sox", "^SOX"]]) {
    try {
      const c = await chart(sym);
      data[k] = pctSeries(c.closes, 3);
    } catch (e) { data[k + "Error"] = String(e); }
  }

  // 兩檔高股息 ETF 收盤價（供「持股成本」頁基準價自動更新）
  for (const [k, sym] of [["etf18", "00918.TW"], ["etf19", "00919.TW"]]) {
    try { const c = await chart(sym); data[k] = { price: Number(c.price.toFixed(2)) }; }
    catch (e) { data[k + "Error"] = String(e); }
  }

  // 自動解讀（依數據，非新聞/非投資建議）
  try { data.note = buildNote(data); } catch (e) { data.noteError = String(e); }

  // 台積電每日收盤自動記錄（存進 data.json，不需手動按鈕）。只在台股收盤後（台北 >=13 時）記錄當日，避免美股盤後那班誤記。
  try {
    let hist = [];
    if (fs.existsSync("data.json")) {
      const prev = JSON.parse(fs.readFileSync("data.json", "utf8"));
      if (Array.isArray(prev.tsmcHistory)) hist = prev.tsmcHistory;
    }
    const tpHour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }); // YYYY-MM-DD
    if (data.tsmc && data.tsmc.price && tpHour >= 13) {
      if (!hist.length || hist[hist.length - 1].d !== today) hist.push({ d: today, p: data.tsmc.price });
      else hist[hist.length - 1].p = data.tsmc.price;
      hist = hist.slice(-60);
    }
    data.tsmcHistory = hist;
  } catch (e) { data.tsmcHistoryError = String(e); }

  // 三檔每日成交量（張）累積紀錄（之後每天自動累加）
  try {
    let vh = {};
    if (fs.existsSync("data.json")) {
      const prev = JSON.parse(fs.readFileSync("data.json", "utf8"));
      if (prev.volHistory) vh = prev.volHistory;
    }
    for (const [k, sym] of [["tsmc", "2330.TW"], ["e18", "00918.TW"], ["e19", "00919.TW"]]) {
      try {
        const fresh = await volHist(sym);
        const map = {};
        (vh[k] || []).forEach((x) => (map[x.d] = x.v));
        fresh.forEach((x) => (map[x.d] = x.v));
        vh[k] = Object.keys(map).sort().map((d) => ({ d, v: map[d] })).slice(-40);
      } catch (e) {}
    }
    data.volHistory = vh;
  } catch (e) { data.volHistoryError = String(e); }

  // 大盤每日成交（金額 億元 + 張數 萬張），來源：證交所 TWSE FMTQIK，每日累積
  try {
    let mkt = {};
    if (fs.existsSync("data.json")) {
      const prev = JSON.parse(fs.readFileSync("data.json", "utf8"));
      if (prev.mktTurnover) mkt = prev.mktTurnover;   // { iso: {amt, lot} }
    }
    const now = new Date();
    const params = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      params.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`);
    }
    for (const ymd of params) {
      try {
        const url = `https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date=${ymd}`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tsmc-dashboard/1.0)" } });
        if (!r.ok) continue;
        const j = await r.json();
        (j.data || []).forEach((row) => {
          const m = String(row[0]).split("/");  // 民國 115/10/07
          if (m.length === 3) {
            const iso = `${Number(m[0]) + 1911}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
            const shares = Number(String(row[1]).replace(/,/g, ""));  // 成交股數
            const amtY = Math.round(Number(String(row[2]).replace(/,/g, "")) / 1e8);  // 元→億
            const lotW = Math.round(shares / 1000 / 1e4 * 10) / 10;  // 股→張→萬張(1位小數)
            if (amtY > 0) mkt[iso] = { amt: amtY, lot: lotW };
          }
        });
      } catch (e) {}
    }
    const keys = Object.keys(mkt).sort().slice(-40);
    const trimmed = {}; keys.forEach((k) => (trimmed[k] = mkt[k]));
    data.mktTurnover = trimmed;
    data.mktSeries = keys.map((d) => ({ d, amt: mkt[d].amt, lot: mkt[d].lot }));
  } catch (e) { data.mktTurnoverError = String(e); }

  const gotSomething = data.tsmc || data.twii || data.dow || data.sp || data.nas || data.sox;
  if (!gotSomething && fs.existsSync("data.json")) {
    console.log("全部抓取失敗，保留現有 data.json");
    process.exit(0);
  }

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
})();
