// Data fetched directly by the browser from public, CORS-enabled APIs — no backend needed.
//   - Banco Central do Brasil SGS API (api.bcb.gov.br) — public, CORS: *
//   - rss2json.com — free RSS-to-JSON proxy, used only to read public headlines + links
//     (InfoMoney's own feed, and Google News search-by-site for FT/Reuters/Investing.com —
//     headline + link only, never full article content, respecting paywalled sources).

const BCB_SERIES = {
  selic: 432,   // Meta Selic definida pelo Copom (% a.a.)
  cdi: 4389,    // CDI anualizada base 252 (% a.a.)
  ipcaMes: 433, // IPCA variação mensal (%)
  ipca12m: 13522, // IPCA acumulado 12 meses (%)
  usdBrl: 1     // Dólar comercial venda (PTAX)
};

async function fetchBcbSeries(code, n = 2) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${n}?formato=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB série ${code}: HTTP ${res.status}`);
  const rows = await res.json();
  // BCB does not guarantee row order across series, so sort by date defensively.
  rows.sort((a, b) => parseBcbDate(a.data) - parseBcbDate(b.data));
  return rows;
}

function parseBcbDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(`${y}-${m}-${d}`).getTime();
}

function setStat(elId, text, direction) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.classList.remove("up", "down");
  if (direction === "up") el.classList.add("up");
  if (direction === "down") el.classList.add("down");
}

async function refreshBrazilStats() {
  try {
    const [selic, cdi, ipcaMes, ipca12m, usdBrl] = await Promise.all([
      fetchBcbSeries(BCB_SERIES.selic, 2),
      fetchBcbSeries(BCB_SERIES.cdi, 2),
      fetchBcbSeries(BCB_SERIES.ipcaMes, 2),
      fetchBcbSeries(BCB_SERIES.ipca12m, 2),
      fetchBcbSeries(BCB_SERIES.usdBrl, 2)
    ]);

    setStat("statSelic", `${last(selic).valor}% a.a.`);
    setStat("statCdi", `${last(cdi).valor}% a.a.`);

    const ipcaMesVal = parseFloat(last(ipcaMes).valor);
    const ipca12mVal = parseFloat(last(ipca12m).valor);
    const arrow = v => v > 0 ? "▲" : v < 0 ? "▼" : "•";
    const dirOf = v => v > 0 ? "up" : v < 0 ? "down" : null;
    setStat("statIpca", `${arrow(ipcaMesVal)} ${Math.abs(ipcaMesVal).toFixed(2)}%`, dirOf(ipcaMesVal));
    setStat("statIpca12", `${arrow(ipca12mVal)} ${Math.abs(ipca12mVal).toFixed(2)}%`, dirOf(ipca12mVal));

    const usdNow = parseFloat(last(usdBrl).valor);
    const usdPrev = parseFloat(usdBrl[usdBrl.length - 2]?.valor ?? usdNow);
    const dir = usdNow > usdPrev ? "up" : usdNow < usdPrev ? "down" : null;
    setStat("statUsdBrl", `R$ ${usdNow.toFixed(4)}`, dir);

    return true;
  } catch (err) {
    console.error("Falha ao buscar dados do BCB:", err);
    ["statSelic", "statCdi", "statIpca", "statIpca12", "statUsdBrl"].forEach(id => setStat(id, "indisp."));
    return false;
  }
}

function last(arr) {
  return arr[arr.length - 1];
}

// --- US macro (FRED, fetched server-side by scripts/fetch_macro.py) ---------

async function refreshUsMacro() {
  const ids = [
    "statFedFunds", "statUs10y", "statUs2y", "statUnemployment",
    "statCpiMom", "statCpiYoy", "statCoreCpiMom", "statCoreCpiYoy",
    "statPceMom", "statPceYoy"
  ];
  try {
    const res = await fetch(`data/macro.json?t=${Math.floor(Date.now() / 120000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const pct = (obj, field) => obj?.[field] != null ? `${obj[field].toFixed(2)}%` : "indisp.";

    // These are levels, not deltas — no up/down direction to show.
    setStat("statFedFunds", pct(data.fed_funds, "value"));
    setStat("statUs10y", pct(data.us10y, "value"));
    setStat("statUs2y", pct(data.us2y, "value"));
    setStat("statUnemployment", pct(data.unemployment, "value"));

    // These are genuine period-over-period changes — show direction, same
    // arrow/color convention as the Futuros Globais board.
    const pctWithArrow = (elId, obj, field) => {
      const value = obj?.[field];
      if (value == null) { setStat(elId, "indisp."); return; }
      const dir = value > 0 ? "up" : value < 0 ? "down" : null;
      const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "•";
      setStat(elId, `${arrow} ${Math.abs(value).toFixed(2)}%`, dir);
    };

    pctWithArrow("statCpiMom", data.cpi, "mom_pct");
    pctWithArrow("statCpiYoy", data.cpi, "yoy_pct");
    pctWithArrow("statCoreCpiMom", data.core_cpi, "mom_pct");
    pctWithArrow("statCoreCpiYoy", data.core_cpi, "yoy_pct");
    pctWithArrow("statPceMom", data.pce, "mom_pct");
    pctWithArrow("statPceYoy", data.pce, "yoy_pct");
  } catch (err) {
    console.error("Falha ao buscar dados macro (FRED):", err);
    ids.forEach(id => setStat(id, "indisp."));
  }
}

// --- News ------------------------------------------------------------

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

const NEWS_FEEDS = [
  { source: "InfoMoney", url: "https://www.infomoney.com.br/feed/" },
  { source: "Reuters", url: googleNewsRss("site:reuters.com markets", "pt-BR", "BR") },
  { source: "Financial Times", url: googleNewsRss("site:ft.com markets", "en-US", "US") },
  { source: "Investing.com", url: googleNewsRss("site:investing.com mercados", "pt-BR", "BR") }
];

function googleNewsRss(query, hl, gl) {
  const ceid = `${gl}:${hl.split("-")[0]}`;
  const params = new URLSearchParams({ q: query, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

async function fetchFeed(feed) {
  const url = RSS2JSON + encodeURIComponent(feed.url);
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "ok") throw new Error(`Feed ${feed.source}: ${json.message || "erro"}`);
  return json.items.slice(0, 6).map(item => ({
    source: feed.source,
    title: decodeHtmlEntities(item.title),
    link: item.link,
    date: new Date(item.pubDate.replace(" ", "T") + "Z")
  }));
}

function decodeHtmlEntities(str) {
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

async function refreshNews() {
  const container = document.getElementById("rssNews");
  const results = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));
  const items = [];
  results.forEach(r => {
    if (r.status === "fulfilled") items.push(...r.value);
  });

  if (!items.length) {
    container.innerHTML = `<div class="news-error">Não foi possível carregar as manchetes agora. Tente novamente em instantes.</div>`;
    return;
  }

  items.sort((a, b) => b.date - a.date);

  container.innerHTML = items.slice(0, 24).map(item => `
    <div class="news-item">
      <a href="${item.link}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
      <div class="news-meta"><span class="news-source">${escapeHtml(item.source)}</span> · ${formatRelativeTime(item.date)}</div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatRelativeTime(date) {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h atrás`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} d atrás`;
}
