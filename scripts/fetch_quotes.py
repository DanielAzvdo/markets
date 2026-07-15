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
from datetime import datetime, timezone

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
        ("EURUSD=X", "EUR/USD"),
        ("GBP=X", "USD/GBP"),
        ("JPY=X", "USD/JPY"),
        ("BRL=X", "USD/BRL"),
        ("BTC-USD", "Bitcoin | BTC/USD"),
    ]),
]

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; amb-markets-bot/1.0)"}


def fetch_symbol(symbol, retries=3):
    """Yahoo occasionally times out or hiccups on an individual request —
    retry a couple of times with backoff before giving up on this symbol."""
    url = BASE_URL.format(urllib.parse.quote(symbol, safe=""))
    req = urllib.request.Request(url + "?interval=1d&range=2d", headers=HEADERS)
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
    meta = result[0]["meta"]
    price = meta.get("regularMarketPrice")
    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    change_pct = None
    if price is not None and prev_close:
        change_pct = (price - prev_close) / prev_close * 100
    return {
        "price": price,
        "change_pct": change_pct,
        "high": meta.get("regularMarketDayHigh"),
        "low": meta.get("regularMarketDayLow"),
    }


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
