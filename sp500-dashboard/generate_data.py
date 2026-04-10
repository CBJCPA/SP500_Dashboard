#!/usr/bin/env python3
"""
S&P 500 Backtesting Dashboard - Synthetic Data Generator
Generates realistic market data when API access is unavailable.
Data patterns are modeled on actual 2010-2025 market behavior.
Replace with fetch_data.py when running with network access.
"""

import json
import os
import numpy as np
import pandas as pd
from datetime import datetime

np.random.seed(42)

START = "2010-01-04"
END = "2025-12-31"


def generate_trading_days(start, end):
    """Generate business days (Mon-Fri, excluding major US holidays)."""
    dates = pd.bdate_range(start, end, freq="B")
    return dates


def generate_spx(dates):
    """
    Generate realistic S&P 500 price path.
    Starts ~1130 (Jan 2010), ends ~5800-6000 range.
    Includes realistic drawdowns: 2011 (-19%), 2015-16 (-14%), 2018 (-20%),
    2020 (-34%), 2022 (-25%).
    """
    n = len(dates)
    # Base drift: ~10% annualized return
    daily_drift = 0.10 / 252
    daily_vol = 0.012  # ~19% annualized

    # Generate returns with regime changes
    returns = np.random.normal(daily_drift, daily_vol, n)

    # Inject realistic drawdown periods
    date_strs = dates.strftime("%Y-%m-%d")

    # 2011 European debt crisis: Aug-Oct 2011 (-19%)
    mask_2011 = (dates >= "2011-07-22") & (dates <= "2011-10-03")
    returns[mask_2011] = np.random.normal(-0.003, 0.018, mask_2011.sum())

    # 2015-2016 China slowdown: Aug 2015 - Feb 2016 (-14%)
    mask_2015 = (dates >= "2015-08-10") & (dates <= "2016-02-11")
    returns[mask_2015] = np.random.normal(-0.0015, 0.016, mask_2015.sum())

    # 2018 Q4 selloff: Oct-Dec 2018 (-20%)
    mask_2018 = (dates >= "2018-09-21") & (dates <= "2018-12-24")
    returns[mask_2018] = np.random.normal(-0.004, 0.018, mask_2018.sum())

    # 2020 COVID crash: Feb-Mar 2020 (-34%)
    mask_2020_down = (dates >= "2020-02-19") & (dates <= "2020-03-23")
    returns[mask_2020_down] = np.random.normal(-0.012, 0.035, mask_2020_down.sum())
    # V-shaped recovery
    mask_2020_up = (dates >= "2020-03-24") & (dates <= "2020-06-08")
    returns[mask_2020_up] = np.random.normal(0.005, 0.022, mask_2020_up.sum())

    # 2022 bear market: Jan-Oct 2022 (-25%)
    mask_2022 = (dates >= "2022-01-03") & (dates <= "2022-10-12")
    returns[mask_2022] = np.random.normal(-0.0012, 0.014, mask_2022.sum())

    # Recovery 2023-2024
    mask_2023 = (dates >= "2023-01-03") & (dates <= "2024-12-31")
    returns[mask_2023] = np.random.normal(0.0006, 0.010, mask_2023.sum())

    # Build price path from returns
    prices = np.zeros(n)
    prices[0] = 1132.99  # SPX close Jan 4, 2010
    for i in range(1, n):
        prices[i] = prices[i - 1] * (1 + returns[i])

    # Scale to realistic endpoint (~5880 by end 2025)
    actual_end = prices[-1]
    target_end = 5880.0
    scale_factor = target_end / actual_end
    # Apply uniform scaling to preserve shape of drawdowns
    prices = prices * (scale_factor ** (np.arange(n) / (n - 1)))

    # Generate OHLV from close
    highs = prices * (1 + np.abs(np.random.normal(0, 0.005, n)))
    lows = prices * (1 - np.abs(np.random.normal(0, 0.005, n)))
    volumes = np.random.lognormal(np.log(3.5e9), 0.3, n)

    return prices, highs, lows, volumes


def generate_vix(dates, spx_returns):
    """Generate VIX that inversely correlates with SPX returns."""
    n = len(dates)
    vix = np.full(n, 16.0)

    # VIX responds to rolling realized vol and spikes during drawdowns
    for i in range(1, n):
        window = min(i, 20)
        recent_vol = np.std(spx_returns[max(0, i - window):i]) * np.sqrt(252) * 100
        mean_revert = 0.03 * (18.0 - vix[i - 1])
        shock = -spx_returns[i] * 200  # Negative correlation
        noise = np.random.normal(0, 0.8)
        vix[i] = max(9, vix[i - 1] + mean_revert + shock + noise)

    # Boost VIX during crisis periods
    mask_2011 = (dates >= "2011-08-01") & (dates <= "2011-11-01")
    vix[mask_2011] = np.clip(vix[mask_2011] * 1.8, 25, 48)

    mask_2020 = (dates >= "2020-02-24") & (dates <= "2020-04-15")
    vix[mask_2020] = np.clip(vix[mask_2020] * 2.5, 40, 82)

    mask_2022 = (dates >= "2022-01-15") & (dates <= "2022-10-30")
    vix[mask_2022] = np.clip(vix[mask_2022] * 1.3, 20, 36)

    return np.clip(vix, 9, 85)


def generate_hy_spreads(dates, vix):
    """Generate high yield credit spreads correlated with VIX."""
    n = len(dates)
    spreads = np.full(n, 4.0)

    for i in range(1, n):
        mean_revert = 0.01 * (4.5 - spreads[i - 1])
        vix_influence = 0.005 * (vix[i] - 18)
        noise = np.random.normal(0, 0.03)
        spreads[i] = max(2.5, spreads[i - 1] + mean_revert + vix_influence + noise)

    # Widen during crises
    mask_2011 = (dates >= "2011-08-01") & (dates <= "2012-01-01")
    spreads[mask_2011] = np.clip(spreads[mask_2011] * 1.5, 6, 9)

    mask_2016 = (dates >= "2015-12-01") & (dates <= "2016-03-01")
    spreads[mask_2016] = np.clip(spreads[mask_2016] * 1.8, 7, 10)

    mask_2020 = (dates >= "2020-03-01") & (dates <= "2020-05-01")
    spreads[mask_2020] = np.clip(spreads[mask_2020] * 2.5, 8, 11)

    mask_2022 = (dates >= "2022-06-01") & (dates <= "2022-11-01")
    spreads[mask_2022] = np.clip(spreads[mask_2022] * 1.3, 5, 6.5)

    return np.clip(spreads, 2.5, 12)


def generate_yield_curve(dates):
    """Generate 10Y-2Y yield curve spread."""
    n = len(dates)
    yc = np.full(n, 2.5)

    for i in range(1, n):
        # Slow mean reversion
        target = 1.0
        mean_revert = 0.002 * (target - yc[i - 1])
        noise = np.random.normal(0, 0.015)
        yc[i] = yc[i - 1] + mean_revert + noise

    # Historical pattern: flattening 2017-2019, inversion 2019, 2022-2024
    mask_flat = (dates >= "2017-01-01") & (dates <= "2018-12-31")
    yc[mask_flat] = np.linspace(1.2, 0.15, mask_flat.sum()) + np.random.normal(0, 0.05, mask_flat.sum())

    mask_inv1 = (dates >= "2019-01-01") & (dates <= "2019-10-01")
    yc[mask_inv1] = np.linspace(0.15, -0.05, mask_inv1.sum()) + np.random.normal(0, 0.03, mask_inv1.sum())

    mask_steep = (dates >= "2020-03-01") & (dates <= "2021-03-31")
    yc[mask_steep] = np.linspace(0.4, 1.6, mask_steep.sum()) + np.random.normal(0, 0.05, mask_steep.sum())

    mask_inv2 = (dates >= "2022-04-01") & (dates <= "2024-09-01")
    yc[mask_inv2] = np.linspace(0.3, -0.5, mask_inv2.sum()) + np.random.normal(0, 0.05, mask_inv2.sum())

    mask_norm = (dates >= "2024-09-01") & (dates <= "2025-12-31")
    yc[mask_norm] = np.linspace(-0.3, 0.2, mask_norm.sum()) + np.random.normal(0, 0.04, mask_norm.sum())

    return yc


def generate_breadth(dates, spx_returns):
    """Generate breadth (% of stocks above 50-day MA) from SPX returns."""
    n = len(dates)
    breadth = np.full(n, 60.0)

    for i in range(1, n):
        window = min(i, 20)
        recent_return = np.mean(spx_returns[max(0, i - window):i]) * 252
        mean_revert = 0.02 * (55 - breadth[i - 1])
        momentum = recent_return * 2
        noise = np.random.normal(0, 1.5)
        breadth[i] = breadth[i - 1] + mean_revert + momentum + noise

    # Drop breadth during declines
    mask_2020 = (dates >= "2020-02-24") & (dates <= "2020-03-23")
    breadth[mask_2020] = np.random.uniform(10, 25, mask_2020.sum())

    mask_2022 = (dates >= "2022-05-01") & (dates <= "2022-10-15")
    breadth[mask_2022] = np.random.uniform(20, 40, mask_2022.sum())

    return np.clip(breadth, 5, 98)


def generate_put_call(dates, vix):
    """Generate put-call ratio correlated with VIX."""
    n = len(dates)
    pcr = np.full(n, 0.85)

    for i in range(1, n):
        mean_revert = 0.02 * (0.85 - pcr[i - 1])
        vix_influence = 0.003 * (vix[i] - 18)
        noise = np.random.normal(0, 0.03)
        pcr[i] = pcr[i - 1] + mean_revert + vix_influence + noise

    # Spike during fear events
    mask_2020 = (dates >= "2020-02-24") & (dates <= "2020-04-01")
    pcr[mask_2020] = np.random.uniform(1.1, 1.6, mask_2020.sum())

    return np.clip(pcr, 0.4, 2.0)


def main():
    print("Generating synthetic market data...")
    dates = generate_trading_days(START, END)
    n = len(dates)

    # Generate SPX
    spx_close, spx_high, spx_low, spx_volume = generate_spx(dates)
    spx_returns = np.diff(np.log(spx_close))
    spx_returns = np.insert(spx_returns, 0, 0)

    # Generate indicators
    vix = generate_vix(dates, spx_returns)
    hy_spread = generate_hy_spreads(dates, vix)
    yield_curve = generate_yield_curve(dates)
    breadth = generate_breadth(dates, spx_returns)
    put_call = generate_put_call(dates, vix)

    # Build output
    output = {
        "dates": [d.strftime("%Y-%m-%d") for d in dates],
        "spx_close": [round(float(v), 2) for v in spx_close],
        "spx_high": [round(float(v), 2) for v in spx_high],
        "spx_low": [round(float(v), 2) for v in spx_low],
        "spx_volume": [int(v) for v in spx_volume],
        "vix": [round(float(v), 2) for v in vix],
        "hy_spread": [round(float(v), 4) for v in hy_spread],
        "yield_curve": [round(float(v), 4) for v in yield_curve],
        "breadth": [round(float(v), 2) for v in breadth],
        "put_call": [round(float(v), 4) for v in put_call],
        "metadata": {
            "start_date": START,
            "end_date": END,
            "total_trading_days": n,
            "fetch_timestamp": datetime.now().isoformat(),
            "data_sources": {
                "spx": "Synthetic (modeled on actual 2010-2025 patterns)",
                "vix": "Synthetic (correlated with SPX volatility)",
                "hy_spread": "Synthetic (BAMLH0A0HYM2 pattern)",
                "yield_curve": "Synthetic (T10Y2Y pattern)",
                "breadth": "Synthetic (sector ETF breadth proxy)",
                "put_call": "Synthetic (equity put-call ratio proxy)",
            },
            "note": "Replace with fetch_data.py for real API data"
        },
        "validation_log": []
    }

    os.makedirs("public/data", exist_ok=True)
    with open("public/data/market_data.json", "w") as f:
        json.dump(output, f)

    size = os.path.getsize("public/data/market_data.json") / (1024 * 1024)
    print(f"Generated {n} trading days of data")
    print(f"SPX range: {spx_close[0]:.0f} to {spx_close[-1]:.0f}")
    print(f"VIX range: {vix.min():.1f} to {vix.max():.1f}")
    print(f"File size: {size:.1f} MB")
    print(f"Saved to public/data/market_data.json")


if __name__ == "__main__":
    main()
