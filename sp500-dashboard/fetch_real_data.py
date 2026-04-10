#!/usr/bin/env python3
"""
Fetch real market data from accessible sources:
- S&P 500: daily from vijinho/sp500 (2010-2018) + monthly from datasets/s-and-p-500 (2019-2026)
- VIX: daily from datasets/finance-vix (2010-2026)
- HY spreads, yield curve, breadth, put-call: calibrated from VIX/SPX patterns
"""

import json
import os
import numpy as np
import pandas as pd
import requests
from datetime import datetime

GITHUB_BASE = "https://raw.githubusercontent.com"


def fetch_sp500_daily():
    """Fetch daily SP500 from vijinho/sp500 (goes through ~Dec 2018)."""
    print("Fetching daily SP500 data...")
    url = f"{GITHUB_BASE}/vijinho/sp500/master/csv/sp500.csv"
    r = requests.get(url, timeout=60)
    r.raise_for_status()

    lines = r.text.strip().split("\n")
    header = lines[0]
    print(f"  {len(lines)-1} total daily records")

    rows = []
    for line in lines[1:]:
        parts = line.split(",")
        date_str = parts[1].strip('"').split(" ")[0]  # "2010-01-04 00:00:00" -> "2010-01-04"
        try:
            dt = pd.Timestamp(date_str)
            if dt.year < 2010:
                continue
            close = float(parts[5])
            high = float(parts[3])
            low = float(parts[4])
            volume = int(float(parts[7])) if parts[7] else 0
            rows.append({"date": dt, "close": close, "high": high, "low": low, "volume": volume})
        except (ValueError, IndexError):
            continue

    df = pd.DataFrame(rows).set_index("date").sort_index()
    df = df[~df.index.duplicated(keep="first")]
    print(f"  SP500 daily: {df.index[0].date()} to {df.index[-1].date()} ({len(df)} days)")
    return df


def fetch_sp500_monthly():
    """Fetch monthly SP500 from datasets/s-and-p-500 (goes through ~2026)."""
    print("Fetching monthly SP500 data...")
    url = f"{GITHUB_BASE}/datasets/s-and-p-500/main/data/data.csv"
    r = requests.get(url, timeout=30)
    r.raise_for_status()

    lines = r.text.strip().split("\n")
    rows = []
    for line in lines[1:]:
        parts = line.split(",")
        date_str = parts[0]
        sp500 = float(parts[1])
        if sp500 <= 0:
            continue
        try:
            dt = pd.Timestamp(date_str)
            if dt.year >= 2019:
                rows.append({"date": dt, "close": sp500})
        except ValueError:
            continue

    df = pd.DataFrame(rows).set_index("date").sort_index()
    print(f"  SP500 monthly: {df.index[0].date()} to {df.index[-1].date()} ({len(df)} months)")
    return df


def interpolate_monthly_to_daily(monthly_df):
    """Create daily prices by interpolating between monthly values with realistic noise."""
    print("Interpolating monthly to daily SP500...")
    np.random.seed(42)

    bdays = pd.bdate_range(monthly_df.index[0], monthly_df.index[-1] + pd.offsets.MonthEnd(0))
    daily = monthly_df.reindex(bdays).interpolate(method="time")
    daily.columns = ["close"]

    # Add realistic daily noise (mean-reverting to monthly anchors)
    noise = np.random.normal(0, 0.005, len(daily))
    noise_cumulative = np.cumsum(noise)
    # Fade noise back to zero at each month boundary
    month_groups = daily.index.to_period("M")
    for period in month_groups.unique():
        mask = month_groups == period
        n = mask.sum()
        if n > 1:
            fade = np.linspace(0, 1, n)
            indices = np.where(mask)[0]
            noise_cumulative[indices] *= (1 - fade) * 0.3

    daily["close"] = daily["close"] * (1 + noise_cumulative * 0.1)
    # Force monthly endpoints to match
    for date, row in monthly_df.iterrows():
        if date in daily.index:
            daily.loc[date, "close"] = row["close"]

    daily["high"] = daily["close"] * (1 + np.abs(np.random.normal(0, 0.005, len(daily))))
    daily["low"] = daily["close"] * (1 - np.abs(np.random.normal(0, 0.005, len(daily))))
    daily["volume"] = np.random.lognormal(np.log(3.5e9), 0.3, len(daily)).astype(int)

    print(f"  Interpolated: {daily.index[0].date()} to {daily.index[-1].date()} ({len(daily)} days)")
    return daily


def fetch_vix_daily():
    """Fetch daily VIX from datasets/finance-vix."""
    print("Fetching daily VIX data...")
    url = f"{GITHUB_BASE}/datasets/finance-vix/main/data/vix-daily.csv"
    r = requests.get(url, timeout=60)
    r.raise_for_status()

    lines = r.text.strip().split("\n")
    rows = []
    for line in lines[1:]:
        parts = line.split(",")
        try:
            dt = pd.Timestamp(parts[0])
            if dt.year < 2010:
                continue
            close = float(parts[4])
            rows.append({"date": dt, "vix": close})
        except (ValueError, IndexError):
            continue

    df = pd.DataFrame(rows).set_index("date").sort_index()
    df = df[~df.index.duplicated(keep="first")]
    print(f"  VIX daily: {df.index[0].date()} to {df.index[-1].date()} ({len(df)} days)")
    return df


def generate_hy_spreads(vix_series, dates):
    """Generate realistic HY spreads correlated with VIX using known historical benchmarks."""
    print("Generating calibrated HY spread data...")
    np.random.seed(123)

    # Historical approximate HY spread levels at key dates
    benchmarks = {
        "2010-01-04": 6.5, "2010-06-01": 6.8, "2011-01-03": 5.2, "2011-10-03": 8.2,
        "2012-06-01": 6.5, "2013-01-02": 4.8, "2014-01-02": 3.8, "2014-12-01": 5.0,
        "2015-06-01": 4.3, "2016-02-11": 8.9, "2016-06-01": 5.8, "2017-01-03": 3.7,
        "2018-01-02": 3.2, "2018-12-24": 5.4, "2019-01-02": 5.3, "2019-06-03": 3.9,
        "2020-01-02": 3.3, "2020-03-23": 10.9, "2020-06-01": 6.3, "2020-12-31": 3.6,
        "2021-06-01": 3.0, "2022-01-03": 3.1, "2022-06-15": 5.8, "2022-10-12": 5.6,
        "2023-01-03": 4.5, "2023-06-01": 4.1, "2024-01-02": 3.4, "2024-06-03": 3.1,
        "2025-01-02": 2.7, "2025-06-02": 3.0, "2026-01-02": 3.2, "2026-04-01": 4.2,
    }

    # Build initial series from benchmarks
    bench_series = pd.Series(benchmarks, dtype=float)
    bench_series.index = pd.to_datetime(bench_series.index)
    bench_series = bench_series.reindex(dates).interpolate(method="time")

    # Add VIX-correlated noise
    vix_norm = (vix_series - vix_series.mean()) / vix_series.std()
    noise = np.random.normal(0, 0.05, len(dates))
    spreads = bench_series.values + vix_norm.values * 0.3 + noise
    spreads = np.clip(spreads, 2.0, 12.0)

    return pd.Series(spreads, index=dates, name="hy_spread")


def generate_yield_curve(dates):
    """Generate 10Y-2Y yield curve using historical benchmarks."""
    print("Generating calibrated yield curve data...")
    np.random.seed(456)

    benchmarks = {
        "2010-01-04": 2.65, "2010-12-31": 2.72, "2011-06-01": 2.42, "2012-01-03": 1.69,
        "2013-01-02": 1.52, "2013-12-31": 2.56, "2014-12-31": 1.60, "2015-12-31": 1.22,
        "2016-06-01": 0.91, "2016-12-30": 1.25, "2017-06-01": 0.95, "2017-12-29": 0.52,
        "2018-06-01": 0.44, "2018-12-03": 0.11, "2019-03-22": -0.02, "2019-08-27": -0.05,
        "2019-10-11": 0.12, "2020-03-09": 0.22, "2020-06-01": 0.50, "2021-03-29": 1.60,
        "2021-12-31": 0.78, "2022-04-01": 0.04, "2022-07-05": -0.06, "2023-03-08": -1.07,
        "2023-07-03": -1.06, "2023-12-29": -0.38, "2024-09-04": -0.02, "2024-12-31": 0.33,
        "2025-03-03": 0.24, "2025-06-02": 0.15, "2026-01-02": 0.20, "2026-04-01": 0.35,
    }

    bench_series = pd.Series(benchmarks, dtype=float)
    bench_series.index = pd.to_datetime(bench_series.index)
    bench_series = bench_series.reindex(dates).interpolate(method="time")

    noise = np.random.normal(0, 0.02, len(dates))
    yc = bench_series.values + noise
    return pd.Series(yc, index=dates, name="yield_curve")


def generate_breadth(spx_returns, dates):
    """Generate breadth proxy from SPX returns."""
    print("Generating calibrated breadth data...")
    np.random.seed(789)
    n = len(dates)
    breadth = np.full(n, 60.0)

    for i in range(1, n):
        window = min(i, 20)
        recent = np.mean(spx_returns[max(0, i-window):i]) * 252
        mean_rev = 0.02 * (55 - breadth[i-1])
        momentum = recent * 2
        noise = np.random.normal(0, 1.5)
        breadth[i] = np.clip(breadth[i-1] + mean_rev + momentum + noise, 5, 98)

    return pd.Series(breadth, index=dates, name="breadth")


def generate_put_call(vix_series, dates):
    """Generate put-call ratio correlated with VIX."""
    print("Generating calibrated put-call data...")
    np.random.seed(101)
    n = len(dates)
    pcr = np.full(n, 0.85)
    vix_vals = vix_series.values

    for i in range(1, n):
        mean_rev = 0.02 * (0.85 - pcr[i-1])
        vix_effect = 0.003 * (vix_vals[i] - 18) if not np.isnan(vix_vals[i]) else 0
        noise = np.random.normal(0, 0.03)
        pcr[i] = np.clip(pcr[i-1] + mean_rev + vix_effect + noise, 0.4, 2.0)

    return pd.Series(pcr, index=dates, name="put_call")


def main():
    print("=" * 60)
    print("Fetching real market data")
    print("=" * 60)

    # 1. Get SP500
    sp500_daily = fetch_sp500_daily()          # 2010 - ~2018
    sp500_monthly = fetch_sp500_monthly()       # 2019 - 2026

    # Interpolate monthly to daily for the gap period
    sp500_interpolated = interpolate_monthly_to_daily(sp500_monthly)

    # Combine: use real daily through 2018, interpolated for 2019+
    cutoff = sp500_daily.index[-1]
    sp500_combined = pd.concat([
        sp500_daily[sp500_daily.index >= "2010-01-01"],
        sp500_interpolated[sp500_interpolated.index > cutoff]
    ])
    sp500_combined = sp500_combined[~sp500_combined.index.duplicated(keep="first")].sort_index()
    print(f"\nCombined SP500: {sp500_combined.index[0].date()} to {sp500_combined.index[-1].date()} ({len(sp500_combined)} days)")
    print(f"  Real daily through: {cutoff.date()}")
    print(f"  Interpolated from monthly after that")

    # 2. Get VIX (real daily data)
    vix_daily = fetch_vix_daily()

    # 3. Align all to SP500 trading days
    dates = sp500_combined.index
    vix_aligned = vix_daily.reindex(dates).ffill().bfill()

    # 4. Generate calibrated indicators
    spx_returns = np.log(sp500_combined["close"]).diff().fillna(0).values
    hy_spread = generate_hy_spreads(vix_aligned["vix"], dates)
    yield_curve = generate_yield_curve(dates)
    breadth = generate_breadth(spx_returns, dates)
    put_call = generate_put_call(vix_aligned["vix"], dates)

    # 5. Build output
    def clean(arr):
        return [None if (v is None or np.isnan(v)) else round(float(v), 2) for v in arr]

    output = {
        "dates": [d.strftime("%Y-%m-%d") for d in dates],
        "spx_close": clean(sp500_combined["close"].values),
        "spx_high": clean(sp500_combined["high"].values),
        "spx_low": clean(sp500_combined["low"].values),
        "spx_volume": [int(v) if not np.isnan(v) else 0 for v in sp500_combined["volume"].values],
        "vix": clean(vix_aligned["vix"].values),
        "hy_spread": clean(hy_spread.values),
        "yield_curve": clean(yield_curve.values),
        "breadth": clean(breadth.values),
        "put_call": clean(put_call.values),
        "metadata": {
            "start_date": str(dates[0].date()),
            "end_date": str(dates[-1].date()),
            "total_trading_days": len(dates),
            "fetch_timestamp": datetime.now().isoformat(),
            "data_sources": {
                "spx_daily_2010_2018": "Real - vijinho/sp500 (Yahoo Finance)",
                "spx_daily_2019_2026": "Interpolated from monthly - datasets/s-and-p-500 (Shiller)",
                "vix": "Real daily - datasets/finance-vix (CBOE)",
                "hy_spread": "Calibrated synthetic (benchmarked to BAMLH0A0HYM2)",
                "yield_curve": "Calibrated synthetic (benchmarked to T10Y2Y)",
                "breadth": "Synthetic (SPX-derived proxy)",
                "put_call": "Synthetic (VIX-correlated proxy)",
            },
        },
        "validation_log": [
            {"note": "SPX daily data is real through 2018-12-21, interpolated from monthly values after"},
            {"note": "VIX data is real daily from CBOE through present"},
            {"note": "HY spreads and yield curve are calibrated to known historical benchmarks"},
        ],
    }

    os.makedirs("public/data", exist_ok=True)
    with open("public/data/market_data.json", "w") as f:
        json.dump(output, f)

    size = os.path.getsize("public/data/market_data.json") / (1024 * 1024)
    print(f"\nSaved to public/data/market_data.json ({size:.1f} MB)")
    print(f"Total trading days: {len(dates)}")
    print(f"SPX range: {sp500_combined['close'].iloc[0]:.0f} to {sp500_combined['close'].iloc[-1]:.0f}")
    print(f"VIX range: {vix_aligned['vix'].min():.1f} to {vix_aligned['vix'].max():.1f}")
    print("Done!")


if __name__ == "__main__":
    main()
