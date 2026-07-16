#!/usr/bin/env python3
"""Fetch real futures/index/fx quotes from Yahoo Finance's public chart endpoint
(server-side, so no browser CORS restriction applies) and write them to
data/quotes.json for the static site to read same-origin.

Run by .github/workflows/update-quotes.yml on a schedule.
"""
import json
import os
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta

CATEGORIES = [
    ("Indices", [
        ("^GSPC", "S&P 500"),
        ("^DJI", "Dow Jones"),
        ("^IXIC", "Nasdaq"),
        ("^BVSP", "Ibovespa"),
        ("IFIX.SA", "IFIX"),
        ("^VIX", "VIX"),
    ]),
    ("Energia", [
        ("CL=F", "WTI | Petróleo"),
        ("BZ=F", "Brent | Petróleo"),
        ("NG=F", "Nat Gas | Gás Natural"),
    ]),
    ("Metais", [
        ("GC=F", "Gold | Ouro"),
        ("SI=F", "Silver | Prata"),
        ("PL=F", "Platinum | Platina"),
        ("HG=F", "Copper | Cobre"),
    ]),
    ("Graos", [
        ("ZC=F", "Corn | Milho"),
        ("ZW=F", "Wheat | Trigo"),
        ("ZS=F", "Soybean | Soja"),
    ]),
    ("Softs", [
        ("KC=F", "Coffee | Café"),
        ("OJ=F", "Orange Juice | Suco de Laranja"),
        ("CT=F", "Cotton | Algodão"),
        ("SB=F", "Sugar | Açúcar"),
    ]),
    ("Moedas", [
        ("DX-Y.NYB", "DXY"),
        ("BRL=X", "USD/BRL"),
        ("EURUSD=X", "EUR/USD"),
        ("GBP=X", "USD/GBP"),
        ("JPY=X", "USD/JPY"),
        ("BTC-USD", "Bitcoin | BTC/USD"),
        ("ETH-USD", "Ethereum | ETH/USD"),
    ]),
]

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; amb-markets-bot/1.0)"}


def fetch_symbol(symbol, retries=3):
    """Yahoo occasionally times out or hiccups on an individual request —
    retry a couple of times with backoff before giving up on this symbol."""
    url = BASE_URL.format(urllib.parse.quote(symbol, safe=""))
    # 5d buffer (not 2d) so the previous trading day's close is always in the
    # series even across weekends/holidays.
    req = urllib.request.Request(url + "?interval=1d&range=5d", headers=HEADERS)
    last_exc = None
    payload = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.load(resp)
            break
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    if payload is None:
        raise last_exc

    result = payload.get("chart", {}).get("result")
    if not result:
        raise ValueError(f"no data for {symbol}: {payload.get('chart', {}).get('error')}")
    r = result[0]
    meta = r["meta"]
    price = meta.get("regularMarketPrice")

    # Yahoo's meta.chartPreviousClose is unreliable for several index/future
    # symbols (observed off by one extra trading day) — derive the previous
    # close ourselves from the daily bar series instead.
    prev_close = _previous_close_from_bars(r, meta)
    if prev_close is None:
        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")

    change_pct = None
    if price is not None and prev_close:
        change_pct = (price - prev_close) / prev_close * 100
    return {
        "price": price,
        "change_pct": change_pct,
        # Yahoo sometimes reports 0.0 for day high/low on thinly-tracked
        # symbols (seen on ^BVSP, IFIX.SA) — no real quote has a 0 high/low,
        # so treat that as "not available" rather than showing a fake value.
        "high": meta.get("regularMarketDayHigh") or None,
        "low": meta.get("regularMarketDayLow") or None,
    }


def _previous_close_from_bars(chart_result, meta):
    quotes = chart_result.get("indicators", {}).get("quote", [{}])[0]
    closes = quotes.get("close") or []
    timestamps = chart_result.get("timestamp") or []
    bars = [(t, c) for t, c in zip(timestamps, closes) if c is not None]
    if not bars:
        return None

    gmtoffset = meta.get("gmtoffset", 0)
    market_time = meta.get("regularMarketTime", bars[-1][0])
    today_date = datetime.fromtimestamp(market_time + gmtoffset, tz=timezone.utc).date()
    last_bar_date = datetime.fromtimestamp(bars[-1][0] + gmtoffset, tz=timezone.utc).date()

    if last_bar_date == today_date and len(bars) > 1:
        return bars[-2][1]
    if last_bar_date != today_date:
        return bars[-1][1]
    # Only one bar and it's today's — no real previous close in this series
    # (seen for thinly-tracked symbols like IFIX.SA). Let the caller fall
    # back to meta.chartPreviousClose instead of faking a flat 0% change.
    return None


def main():
    categories_out = []
    for cat_name, symbols in CATEGORIES:
        items = []
        for symbol, label in symbols:
            try:
                data = fetch_symbol(symbol)
                items.append({"symbol": symbol, "label": label, **data})
            except Exception as exc:  # keep going; one bad symbol shouldn't kill the whole board
                items.append({"symbol": symbol, "label": label, "error": str(exc)})
            time.sleep(0.2)  # spread requests out — avoid bursting Yahoo's rate limit
        categories_out.append({"name": cat_name, "items": items})

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "categories": categories_out,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/quotes.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
