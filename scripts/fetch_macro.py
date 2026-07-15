#!/usr/bin/env python3
"""Fetch US macro indicators (Fed Funds, CPI, Core CPI) from FRED
(Federal Reserve Economic Data — official, free, server-side only: the API key
lives in a GitHub Actions secret and is never sent to the browser) and write
them to data/macro.json for the static site to read same-origin.

Requires env var FRED_API_KEY (repo secret). Run by
.github/workflows/update-quotes.yml on a schedule.
"""
import json
import os
import time
import urllib.request
from datetime import datetime, timezone

API_KEY = os.environ.get("FRED_API_KEY")
BASE_URL = "https://api.stlouisfed.org/fred/series/observations"


def fetch_series(series_id, limit=13, retries=3):
    """FRED occasionally times out or hiccups on an individual request —
    retry a couple of times with backoff before giving up on this series."""
    params = f"series_id={series_id}&api_key={API_KEY}&file_type=json&sort_order=desc&limit={limit}"
    url = f"{BASE_URL}?{params}"
    last_exc = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                payload = json.load(resp)
            obs = [o for o in payload["observations"] if o["value"] != "."]
            obs.sort(key=lambda o: o["date"], reverse=True)
            return obs
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    raise last_exc


def latest_value(series_id):
    obs = fetch_series(series_id, limit=1)
    return float(obs[0]["value"]), obs[0]["date"]


def index_mom_yoy(series_id):
    """For an index-level series (e.g. CPI), return latest value plus
    month-over-month and year-over-year % change computed from raw levels.

    Matches by calendar date instead of raw list index — robust to whatever
    number of rows FRED actually returns, as long as it covers 12 months back
    (monthly series like CPI go back decades, so a generous buffer is cheap).
    """
    obs = fetch_series(series_id, limit=24)
    if not obs:
        return {"level": None, "mom_pct": None, "yoy_pct": None, "date": None}

    by_date = {o["date"]: float(o["value"]) for o in obs}
    latest_date = obs[0]["date"]
    latest = by_date[latest_date]

    prev_date = obs[1]["date"] if len(obs) > 1 else None
    mom = (latest - by_date[prev_date]) / by_date[prev_date] * 100 if prev_date else None

    year, month, day = latest_date.split("-")
    yoy_date = f"{int(year) - 1}-{month}-{day}"
    yoy = (latest - by_date[yoy_date]) / by_date[yoy_date] * 100 if yoy_date in by_date else None

    return {"level": latest, "mom_pct": mom, "yoy_pct": yoy, "date": latest_date}


SIMPLE_SERIES = {
    "fed_funds": "DFF",        # Effective Federal Funds Rate (daily, %)
    "unemployment": "UNRATE",  # Unemployment rate (monthly, %)
    "us10y": "DGS10",          # 10-Year Treasury yield (daily, %)
    "us2y": "DGS2",            # 2-Year Treasury yield (daily, %)
}

INDEX_SERIES = {
    "cpi": "CPIAUCSL",       # CPI, all urban consumers (headline)
    "core_cpi": "CPILFESL",  # CPI less food & energy (core)
    "pce": "PCEPI",          # PCE price index — the Fed's preferred inflation gauge
}


def main():
    if not API_KEY:
        raise SystemExit("FRED_API_KEY env var not set — add it as a GitHub Actions secret")

    out = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}

    for key, series_id in SIMPLE_SERIES.items():
        try:
            value, date = latest_value(series_id)
            out[key] = {"value": value, "date": date}
        except Exception as exc:
            out[key] = {"error": str(exc)}
        time.sleep(0.3)  # spread requests out — avoid bursting FRED's rate limit

    for key, series_id in INDEX_SERIES.items():
        try:
            out[key] = index_mom_yoy(series_id)
        except Exception as exc:
            out[key] = {"error": str(exc)}
        time.sleep(0.3)

    os.makedirs("data", exist_ok=True)
    with open("data/macro.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
