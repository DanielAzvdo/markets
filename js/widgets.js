// Injects official TradingView embed widgets (free, no key, no scraping — see tradingview.com/widget).
// Each widget is a self-contained <script> that TradingView's own JS renders into an iframe.

function mountTVWidget(containerId, scriptSrc, config) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const wrapper = document.createElement("div");
  wrapper.className = "tradingview-widget-container";
  const inner = document.createElement("div");
  inner.className = "tradingview-widget-container__widget";
  wrapper.appendChild(inner);
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = scriptSrc;
  script.async = true;
  script.text = JSON.stringify(config);
  wrapper.appendChild(script);
  container.appendChild(wrapper);
}

function mountTickerTape() {
  mountTVWidget("tickerTape", "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js", {
    symbols: [
      { proName: "BMFBOVESPA:IBOV", title: "Ibovespa" },
      { proName: "FX_IDC:USDBRL", title: "USD/BRL" },
      { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
      { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
      { proName: "TVC:GOLD", title: "Ouro" },
      { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
      { proName: "BITSTAMP:ETHUSD", title: "Ethereum" }
    ],
    showSymbolLogo: true,
    colorTheme: "dark",
    isTransparent: true,
    displayMode: "adaptive",
    locale: "br"
  });
}

// Advanced Chart widget — has a built-in symbol search (allow_symbol_change),
// the closest legitimate equivalent to a "search an asset, see its chart"
// experience. Google Finance's own charts have no public embed API, so this
// is the real substitute. A visible search box (below) drives it, since the
// widget's own built-in search (click the symbol name) is easy to miss.
function mountAdvancedChart(symbol = "FOREXCOM:SPXUSD") {
  const container = document.getElementById("advancedChart");
  if (container) container.innerHTML = "";
  mountTVWidget("advancedChart", "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
    autosize: true,
    symbol: symbol,
    interval: "D",
    timezone: "America/Sao_Paulo",
    theme: "dark",
    style: "3", // area chart
    locale: "br",
    withdateranges: true,
    allow_symbol_change: true,
    details: false,
    hide_side_toolbar: false,
    calendar: false,
    support_host: "https://www.tradingview.com"
  });
}

function setupChartSearch() {
  const form = document.getElementById("chartSearchForm");
  const input = document.getElementById("chartSymbolSearch");
  if (!form || !input) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const value = input.value.trim();
    if (value) mountAdvancedChart(value.toUpperCase());
  });
}

// Official Investing.com Economic Calendar widget (webmaster tools program —
// sslecal2.investing.com is their own widget-serving domain, not scraping).
// Kept in the same table format/columns as br.investing.com/economic-calendar.
function mountEconCalendar() {
  const container = document.getElementById("econCalendar");
  if (!container) return;
  const params = new URLSearchParams({
    columns: "exc_flag,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous",
    features: "datepicker,timezone",
    countries: "25,32,6,37,72,22,17,39,14,10,35,43,56,36,110,11,26,12,4,5",
    calType: "week",
    timeZone: "12", // GMT-3 (Brasília)
    lang: "12"      // Portuguese
  });
  // The widget's own content has a fixed natural width and doesn't stretch
  // to fill a wide iframe, so center it instead of leaving it flush-left.
  container.innerHTML = `<iframe src="https://sslecal2.investing.com/?${params.toString()}"
    width="800" height="600" frameborder="0" style="border:0; max-width:100%;"
    title="Calendário Econômico — Investing.com"></iframe>`;
}

function mountTVNews() {
  mountTVWidget("tvNews", "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js", {
    feedMode: "all_symbols",
    isTransparent: true,
    displayMode: "regular",
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    locale: "br"
  });
}

function mountAllWidgets() {
  mountTickerTape();
  mountAdvancedChart();
  setupChartSearch();
  mountEconCalendar();
  mountTVNews();
}
