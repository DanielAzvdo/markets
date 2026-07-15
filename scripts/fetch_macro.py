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
import urllib.request
from datetime import datetime, timezone

API_KEY = os.environ.get("FRED_API_KEY")
BASE_URL = "https://api.stlouisfed.org/fred/series/observations"


def fetch_series(series_id, limit=13):
    params = f"series_id={series_id}&api_key={API_KEY}&file_type=json&sort_order=desc&limit={limit}"
    with urllib.request.urlopen(f"{BASE_URL}?{params}", timeout=15) as resp:
        payload = json.load(resp)
    obs = [o for o in payload["observations"] if o["value"] != "."]
    obs.sort(key=lambda o: o["date"], reverse=True)
    return obs


def latest_value(series_id):
    obs = fetch_series(series_id, limit=1)
    return float(obs[0]["value"]), obs[0]["date"]


def index_mom_yoy(series_id):
    """For an index-level series (e.g. CPI), return latest value plus
    month-over-month and year-over-year % change computed from raw levels."""
    obs = fetch_series(series_id, limit=13)
    values = [float(o["value"]) for o in obs]  # index 0 = most recent
    latest = values[0]
    mom = (latest - values[1]) / values[1] * 100 if len(values) > 1 else None
    yoy = (latest - values[12]) / values[12] * 100 if len(values) > 12 else None
    return {"level": latest, "mom_pct": mom, "yoy_pct": yoy, "date": obs[0]["date"]}


def main():
    if not API_KEY:
        raise SystemExit("FRED_API_KEY env var not set — add it as a GitHub Actions secret")

    out = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}

    try:
        fed_funds, fed_date = latest_value("DFF")
        out["fed_funds"] = {"value": fed_funds, "date": fed_date}
    except Exception as exc:
        out["fed_funds"] = {"error": str(exc)}

    try:
        out["cpi"] = index_mom_yoy("CPIAUCSL")
    except Exception as exc:
        out["cpi"] = {"error": str(exc)}

    try:
        out["core_cpi"] = index_mom_yoy("CPILFESL")
    except Exception as exc:
        out["core_cpi"] = {"error": str(exc)}

    os.makedirs("data", exist_ok=True)
    with open("data/macro.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
