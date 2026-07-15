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
      { proName: "CBOT:ZN1!", title: "US 10Y" },
      { proName: "TVC:DXY", title: "DXY" },
      { proName: "TVC:GOLD", title: "Ouro" },
      { proName: "NYMEX:CL1!", title: "WTI" },
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

// Single widget with tabs covering Indices/Juros/Cambio/Commodities/Cripto —
// keeps the page to a handful of TradingView iframes instead of one per category.
function mountMarketOverview() {
  mountTVWidget("marketOverview", "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js", {
    colorTheme: "dark",
    dateRange: "1D",
    showChart: true,
    locale: "br",
    isTransparent: true,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    width: "100%",
    height: "100%",
    plotLineColorGrowing: "rgba(46, 204, 113, 1)",
    plotLineColorFalling: "rgba(255, 77, 77, 1)",
    tabs: [
      {
        title: "Índices",
        symbols: [
          { s: "BMFBOVESPA:IBOV", d: "Ibovespa" },
          { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
          { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
          { s: "FOREXCOM:DJI", d: "Dow Jones" },
          { s: "TVC:UKX", d: "FTSE 100" },
          { s: "TVC:DAX", d: "DAX" }
        ]
      },
      {
        title: "Juros",
        symbols: [
          { s: "CBOT:ZT1!", d: "US 2Y (Fut.)" },
          { s: "CBOT:ZN1!", d: "US 10Y (Fut.)" },
          { s: "CBOT:ZB1!", d: "US 30Y (Fut.)" },
          { s: "CBOT:ZQ1!", d: "Fed Funds (Fut.)" }
        ]
      },
      {
        title: "Câmbio",
        symbols: [
          { s: "FX_IDC:USDBRL", d: "USD/BRL" },
          { s: "FX:EURUSD", d: "EUR/USD" },
          { s: "FX_IDC:EURBRL", d: "EUR/BRL" },
          { s: "ICEUS:DX1!", d: "DXY (Fut.)" },
          { s: "FX:USDJPY", d: "USD/JPY" },
          { s: "FX:USDCNH", d: "USD/CNH" }
        ]
      },
      {
        title: "Commodities",
        symbols: [
          { s: "NYMEX:CL1!", d: "WTI" },
          { s: "TVC:UKOIL", d: "Brent" },
          { s: "TVC:GOLD", d: "Ouro" },
          { s: "TVC:SILVER", d: "Prata" },
          { s: "CBOT:ZC1!", d: "Milho" },
          { s: "ICEUS:KC1!", d: "Café" }
        ]
      },
      {
        title: "Cripto",
        symbols: [
          { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
          { s: "BITSTAMP:ETHUSD", d: "Ethereum" },
          { s: "BINANCE:SOLUSDT", d: "Solana" },
          { s: "BINANCE:BNBUSDT", d: "BNB" }
        ]
      }
    ]
  });
}

function mountEconCalendar() {
  mountTVWidget("econCalendar", "https://s3.tradingview.com/external-embedding/embed-widget-events.js", {
    colorTheme: "dark",
    isTransparent: true,
    width: "100%",
    height: "100%",
    locale: "br",
    importanceFilter: "-1,0,1",
    countryFilter: "us,br"
  });
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
  mountMarketOverview();
  mountEconCalendar();
  mountTVNews();
}
