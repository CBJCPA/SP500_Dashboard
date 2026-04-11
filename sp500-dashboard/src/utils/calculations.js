/**
 * Core calculation engine for S&P 500 backtesting.
 * All computations run client-side for real-time interactivity.
 */

/**
 * Identify decline periods for a given threshold.
 * For each date, looks FORWARD: will price decline by >= threshold%
 * before it rises by >= threshold% from that date's close?
 * If yes, that date is labeled as a "decline" (the target outcome for prediction).
 *
 * @param {number[]} prices - SPX close prices
 * @param {number} declineThreshold - e.g. 5, 10, 20 (percent)
 * @returns {boolean[]} - true for each date where a decline of threshold% occurs before a rise of threshold%
 */
export function identifyDeclinePeriods(prices, declineThreshold) {
  const n = prices.length;
  const isDecline = new Array(n).fill(false);
  const threshold = declineThreshold / 100;

  for (let i = 0; i < n; i++) {
    const entryPrice = prices[i];
    if (entryPrice == null) continue;

    const downTarget = entryPrice * (1 - threshold);
    const upTarget = entryPrice * (1 + threshold);

    for (let j = i + 1; j < n; j++) {
      if (prices[j] == null) continue;
      if (prices[j] <= downTarget) {
        // Price declined threshold% first — this is a decline period
        isDecline[i] = true;
        break;
      }
      if (prices[j] >= upTarget) {
        // Price rose threshold% first — not a decline period
        break;
      }
    }
  }

  return isDecline;
}

/**
 * Calculate decline duration statistics.
 * For each contiguous block of decline-labeled dates, measures the number of
 * days from the start of the block until price recovers back to the entry level.
 */
export function calculateDeclineDurations(prices, declineThreshold) {
  const isDecline = identifyDeclinePeriods(prices, declineThreshold);
  const n = isDecline.length;
  const durations = [];

  let i = 0;
  while (i < n) {
    if (isDecline[i]) {
      const entryPrice = prices[i];
      // Find how long until price recovers to entry level
      let recovered = false;
      for (let j = i + 1; j < n; j++) {
        if (prices[j] != null && prices[j] >= entryPrice) {
          durations.push(j - i);
          recovered = true;
          break;
        }
      }
      if (!recovered) {
        durations.push(n - i); // Still hasn't recovered by end of data
      }
      // Skip to next non-decline day to avoid counting overlapping periods
      while (i < n && isDecline[i]) i++;
    } else {
      i++;
    }
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

/**
 * Find optimal threshold and lag for an indicator against a decline target.
 * Searches a grid of threshold/lag values and returns the combination with
 * the highest F1 score (harmonic mean of precision and recall).
 *
 * @param {number[]} values - indicator time series
 * @param {boolean[]} actual - decline labels from identifyDeclinePeriods
 * @param {string} direction - 'above' or 'below'
 * @param {number} threshMin - min threshold to search
 * @param {number} threshMax - max threshold to search
 * @param {number} threshStep - threshold step size
 * @param {number} startIdx - start of date range
 * @param {number} endIdx - end of date range
 * @returns {{ threshold: number, lag: number, precision: number, recall: number, f1: number }}
 */
export function findOptimalPreset(values, actual, direction, threshMin, threshMax, threshStep, startIdx, endIdx) {
  let best = { threshold: (threshMin + threshMax) / 2, lag: 0, precision: 0, recall: 0, f1: 0 };

  // Coarse lag search: 0, 5, 10, 15, 20, 30, 45, 60
  const lagSteps = [0, 5, 10, 15, 20, 30, 45, 60];

  for (let thresh = threshMin; thresh <= threshMax; thresh += threshStep) {
    for (const lag of lagSteps) {
      const signal = indicatorSignal(values, thresh, direction, lag);
      const stats = calculateStats(signal, actual, startIdx, endIdx);

      const f1 = (stats.precision + stats.recall) > 0
        ? 2 * stats.precision * stats.recall / (stats.precision + stats.recall)
        : 0;

      if (f1 > best.f1) {
        best = {
          threshold: Math.round(thresh * 1000) / 1000,
          lag,
          precision: stats.precision,
          recall: stats.recall,
          f1,
        };
      }
    }
  }

  // Fine-tune lag around best: search +/- 5 days in steps of 1
  const bestThresh = best.threshold;
  for (let lag = Math.max(0, best.lag - 5); lag <= Math.min(60, best.lag + 5); lag++) {
    const signal = indicatorSignal(values, bestThresh, direction, lag);
    const stats = calculateStats(signal, actual, startIdx, endIdx);
    const f1 = (stats.precision + stats.recall) > 0
      ? 2 * stats.precision * stats.recall / (stats.precision + stats.recall)
      : 0;
    if (f1 > best.f1) {
      best = { threshold: bestThresh, lag, precision: stats.precision, recall: stats.recall, f1 };
    }
  }

  return best;
}
