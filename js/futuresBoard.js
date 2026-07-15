// Custom Finviz-style quote board. Real numbers (price, day range, % change),
// no TradingView widget involved. Data comes from data/quotes.json, which
// .github/workflows/update-quotes.yml refreshes every ~10 min by calling Yahoo
// Finance server-side (GitHub Actions has no browser CORS restriction) and
// committing the result — the page just reads it same-origin, no proxy needed.

const QUOTES_URL = "data/quotes.json";
const REFRESH_CYCLE_SEC = 600; // matches the */10 cron in .github/workflows/update-quotes.yml

const CATEGORY_LABELS = {
  Indices: "Índices",
  Energia: "Energia",
  Metais: "Metais",
  Graos: "Grãos",
  Softs: "Softs",
  Moedas: "Moedas"
};

let lastGeneratedAtMs = null;

function formatPrice(item) {
  if (item.price == null) return "—";
  const decimals = item.symbol.includes("=X") || item.symbol.includes("NYB") ? 4 : 2;
  return item.price.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatRange(item) {
  if (item.high == null || item.low == null) return "";
  const decimals = item.symbol.includes("=X") || item.symbol.includes("NYB") ? 4 : 2;
  const fmt = v => v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `H ${fmt(item.high)} · L ${fmt(item.low)}`;
}

function renderBox(item) {
  if (item.error || item.price == null) {
    return `
      <div class="fbox">
        <div class="fbox-label">${escapeHtml(item.label)}</div>
        <div class="fbox-price fbox-na">indisp.</div>
      </div>`;
  }
  const pct = item.change_pct;
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  const pctText = pct != null ? `${arrow} ${Math.abs(pct).toFixed(2)}%` : "";
  return `
    <div class="fbox ${dir}">
      <div class="fbox-label">${escapeHtml(item.label)}</div>
      <div class="fbox-price">${formatPrice(item)}</div>
      <div class="fbox-change">${pctText}</div>
      <div class="fbox-range">${formatRange(item)}</div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function refreshFuturesBoard() {
  const container = document.getElementById("chartIbov");
  if (!container) return;
  try {
    const res = await fetch(`${QUOTES_URL}?t=${Math.floor(Date.now() / 120000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    container.innerHTML = data.categories.map(cat => `
      <div class="futures-category">
        <div class="futures-cat-label">${escapeHtml(CATEGORY_LABELS[cat.name] || cat.name)}</div>
        <div class="futures-grid">
          ${cat.items.map(renderBox).join("")}
        </div>
      </div>
    `).join("");

    if (data.generated_at) {
      lastGeneratedAtMs = new Date(data.generated_at).getTime();
      updateFuturesMeta();
    }
  } catch (err) {
    console.error("Falha ao carregar board de futuros:", err);
    container.innerHTML = `<div class="news-error">Não foi possível carregar as cotações agora.</div>`;
  }
}

function updateFuturesMeta() {
  const meta = document.getElementById("futuresMeta");
  if (!meta || lastGeneratedAtMs == null) return;

  const updated = new Date(lastGeneratedAtMs);
  const elapsedSec = (Date.now() - lastGeneratedAtMs) / 1000;
  const remainingSec = Math.max(0, Math.round(REFRESH_CYCLE_SEC - elapsedSec));

  const updatedText = updated.toLocaleTimeString("pt-BR", { hour12: false });
  const countdownText = remainingSec > 0
    ? `próxima em ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`
    : "atualizando…";

  meta.textContent = `atualizado ${updatedText} · ${countdownText}`;
}
