/**
 * Core calculation engine for S&P 500 backtesting.
 * All computations run client-side for real-time interactivity.
 */

/**
 * Identify decline periods for a given threshold.
 * A decline period starts when price drops >= threshold% from a local high,
 * and ends when price rises >= threshold% from the local low.
 *
 * @param {number[]} prices - SPX close prices
 * @param {number} declineThreshold - e.g. 5, 10, 20 (percent)
 * @returns {boolean[]} - true for each date that falls within a decline period
 */
export function identifyDeclinePeriods(prices, declineThreshold) {
  const n = prices.length;
  const isDecline = new Array(n).fill(false);
  const threshold = declineThreshold / 100;

  let peak = prices[0];
  let trough = prices[0];
  let inDecline = false;
  let declineStart = 0;

  for (let i = 1; i < n; i++) {
    if (!inDecline) {
      if (prices[i] > peak) {
        peak = prices[i];
        trough = prices[i];
      }
      if (prices[i] < trough) {
        trough = prices[i];
      }
      // Check if we've declined enough from peak
      if ((peak - trough) / peak >= threshold) {
        inDecline = true;
        declineStart = i;
        // Mark from the start of the decline (peak)
        for (let j = i; j >= 0; j--) {
          if (prices[j] >= peak * 0.999) {
            declineStart = j;
            break;
          }
        }
        for (let j = declineStart; j <= i; j++) {
          isDecline[j] = true;
        }
      }
    } else {
      isDecline[i] = true;
      if (prices[i] < trough) {
        trough = prices[i];
      }
      // Check if we've recovered enough from trough
      if ((prices[i] - trough) / trough >= threshold) {
        inDecline = false;
        peak = prices[i];
        trough = prices[i];
      }
    }
  }

  return isDecline;
}

/**
 * Calculate decline duration statistics.
 */
export function calculateDeclineDurations(prices, declineThreshold) {
  const isDecline = identifyDeclinePeriods(prices, declineThreshold);
  const n = isDecline.length;
  const durations = [];

  let start = -1;
  for (let i = 0; i < n; i++) {
    if (isDecline[i] && start === -1) {
      start = i;
    } else if (!isDecline[i] && start !== -1) {
      durations.push(i - start);
      start = -1;
    }
  }
  if (start !== -1) {
    durations.push(n - start);
  }

  if (durations.length === 0) {
    return { count: 0, avg: 0, median: 0, min: 0, max: 0, std: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = durations.reduce((s, v) => s + (v - avg) ** 2, 0) / durations.length;

  return {
    count: durations.length,
    avg: Math.round(avg * 10) / 10,
    median: Math.round(median * 10) / 10,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    std: Math.round(Math.sqrt(variance) * 10) / 10,
  };
}

/**
 * Check if an indicator crosses its threshold, with lag.
 *
 * @param {number[]} values - indicator time series
 * @param {number} threshold - trigger threshold
 * @param {string} direction - 'above' or 'below'
 * @param {number} lagDays - look-back offset in days
 * @returns {boolean[]} - true where the indicator signals
 */
export function indicatorSignal(values, threshold, direction, lagDays = 0) {
  const n = values.length;
  const signal = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const lookIdx = i - lagDays;
    if (lookIdx < 0 || lookIdx >= n) continue;
    const val = values[lookIdx];
    if (val == null) continue;

    if (direction === 'above') {
      signal[i] = val >= threshold;
    } else {
      signal[i] = val <= threshold;
    }
  }

  return signal;
}

/**
 * Calculate precision/recall statistics for an indicator signal vs actual declines.
 */
export function calculateStats(signal, actual, startIdx, endIdx) {
  let tp = 0, fp = 0, fn = 0, tn = 0;

  for (let i = startIdx; i <= endIdx; i++) {
    const s = signal[i];
    const a = actual[i];
    if (s && a) tp++;
    else if (s && !a) fp++;
    else if (!s && a) fn++;
    else tn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

  return { tp, fp, fn, tn, precision, recall };
}

/**
 * Calculate combination statistics for multiple signals.
 * Returns stats for when N or more signals fire simultaneously.
 */
export function calculateCombinationStats(signals, actual, startIdx, endIdx) {
  const n = endIdx - startIdx + 1;
  const numSignals = signals.length;
  const results = [];

  for (let minFiring = 1; minFiring <= numSignals; minFiring++) {
    const combined = new Array(actual.length).fill(false);

    for (let i = startIdx; i <= endIdx; i++) {
      let count = 0;
      for (const signal of signals) {
        if (signal[i]) count++;
      }
      combined[i] = count >= minFiring;
    }

    const stats = calculateStats(combined, actual, startIdx, endIdx);
    results.push({
      minFiring,
      label: minFiring === numSignals ? `All ${numSignals}` : `Any ${minFiring}+`,
      ...stats,
    });
  }

  return results;
}

/**
 * Find date index range for a given start/end date string.
 */
export function getDateRange(dates, startDate, endDate) {
  let startIdx = 0;
  let endIdx = dates.length - 1;

  if (startDate) {
    startIdx = dates.findIndex(d => d >= startDate);
    if (startIdx === -1) startIdx = 0;
  }
  if (endDate) {
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= endDate) {
        endIdx = i;
        break;
      }
    }
  }

  return { startIdx, endIdx };
}
