/**
 * utils.js — shared math helpers for every indicator.
 *
 * These replace the numpy/scipy calls the original Python used, so no
 * indicator has to re-implement statistics, resampling, peak-finding, etc.
 * Everything here is pure (no DOM, no globals) and works on plain arrays of
 * numbers plus arrays of JS `Date` objects for timestamps.
 *
 * Convention: non-finite entries (NaN/null/undefined) are treated the way
 * pandas treats NaN — skipped by reductions, preserved positionally by
 * element-wise ops.
 */

// --- small helpers -------------------------------------------------------

/** Keep only finite numbers from an array. */
export function finite(arr) {
  return arr.filter((v) => Number.isFinite(v));
}

/** Mean of the finite values (NaN if none). */
export function mean(arr) {
  const a = finite(arr);
  if (!a.length) return NaN;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

/**
 * Standard deviation of the finite values.
 * ddof=1 (sample, pandas default) unless overridden; pass ddof=0 for the
 * population std that numpy defaults to.
 */
export function std(arr, ddof = 1) {
  const a = finite(arr);
  const n = a.length;
  if (n - ddof <= 0) return NaN;
  const m = a.reduce((s, x) => s + x, 0) / n;
  const ss = a.reduce((s, x) => s + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (n - ddof));
}

/** Median of the finite values. */
export function median(arr) {
  const a = finite(arr).sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * q-th quantile (q in [0,1]) with linear interpolation — matches
 * numpy.percentile / numpy.quantile default ("linear").
 */
export function quantile(arr, q) {
  const a = finite(arr).sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  if (n === 1) return a[0];
  const idx = q * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

/** Convenience: percentile with p in [0,100]. */
export function percentile(arr, p) {
  return quantile(arr, p / 100);
}

/** Pearson correlation of two equal-length arrays (finite pairs only). */
export function pearson(x, y) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
    }
  }
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

// --- normal distribution -------------------------------------------------

/** Error function (Abramowitz & Stegun 7.1.26). */
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/**
 * Lag-`lag` autocorrelation of a series (Pearson of x[t] vs x[t-lag] over
 * pairwise-finite entries) — equivalent to pandas Series.autocorr(lag).
 */
export function autocorr(x, lag) {
  const a = [];
  const b = [];
  for (let i = lag; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(x[i - lag])) {
      a.push(x[i - lag]);
      b.push(x[i]);
    }
  }
  return pearson(a, b);
}

/** Standard normal CDF. */
export function normCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Inverse standard normal CDF (Acklam's algorithm) — replaces norm.ppf. */
export function normInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q;
  let r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// --- search / binning ----------------------------------------------------

/** Number of elements of sorted array `a` that are <= v (searchsorted right). */
export function searchsortedRight(a, v) {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// --- linear fits ---------------------------------------------------------

/** Ordinary least-squares line fit; returns {slope, intercept}. */
export function polyfit1(x, y) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
    }
  }
  const n = xs.length;
  if (n < 2) return { slope: NaN, intercept: NaN };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = den === 0 ? NaN : num / den;
  return { slope, intercept: my - slope * mx };
}

// --- rolling windows -----------------------------------------------------

/**
 * Trailing time-based rolling mean over a real calendar window of
 * `windowDays` days. Window for row i includes rows j with
 * times[i] - windowDays < times[j] <= times[i]. min_periods=1.
 */
export function rollingMeanTime(times, values, windowDays) {
  const n = values.length;
  const out = new Array(n).fill(NaN);
  const spanMs = windowDays * 86400000;
  let start = 0;
  for (let i = 0; i < n; i++) {
    const ti = times[i].getTime();
    while (times[start].getTime() <= ti - spanMs) start++;
    let sum = 0;
    let cnt = 0;
    for (let j = start; j <= i; j++) {
      if (Number.isFinite(values[j])) {
        sum += values[j];
        cnt++;
      }
    }
    out[i] = cnt ? sum / cnt : NaN;
  }
  return out;
}

// --- resampling ----------------------------------------------------------

function utcDayStart(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Resample to a continuous daily index from first to last day (inclusive),
 * matching pandas resample("1D"). agg = "mean" (empty day -> NaN) or "sum"
 * (empty day -> 0). Returns {times: Date[], values: number[]}.
 */
export function resampleDaily(times, values, agg = "mean") {
  const buckets = new Map();
  for (let i = 0; i < times.length; i++) {
    const key = utcDayStart(times[i]);
    if (!buckets.has(key)) buckets.set(key, []);
    if (Number.isFinite(values[i])) buckets.get(key).push(values[i]);
  }
  if (!buckets.size) return { times: [], values: [] };
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const first = keys[0];
  const last = keys[keys.length - 1];
  const outT = [];
  const outV = [];
  for (let k = first; k <= last; k += 86400000) {
    outT.push(new Date(k));
    const seg = buckets.get(k) || [];
    if (agg === "sum") {
      outV.push(seg.reduce((s, x) => s + x, 0));
    } else {
      outV.push(seg.length ? seg.reduce((s, x) => s + x, 0) / seg.length : NaN);
    }
  }
  return { times: outT, values: outV };
}

/**
 * Resample a continuous daily series into fixed 5-day (pentad) means, aligned
 * to the first day — matches pandas daily.resample("5D").mean().
 */
export function resamplePentadMean(days, values) {
  const outT = [];
  const outV = [];
  for (let i = 0; i < days.length; i += 5) {
    const seg = [];
    for (let j = i; j < Math.min(i + 5, days.length); j++) {
      if (Number.isFinite(values[j])) seg.push(values[j]);
    }
    outT.push(days[i]);
    outV.push(seg.length ? seg.reduce((s, x) => s + x, 0) / seg.length : NaN);
  }
  return { times: outT, values: outV };
}

/** Linear interpolation of interior NaN gaps up to `limit` consecutive NaNs. */
export function interpolateLimit(values, limit) {
  const out = values.slice();
  const n = out.length;
  let i = 0;
  while (i < n) {
    if (!Number.isFinite(out[i])) {
      const start = i;
      while (i < n && !Number.isFinite(out[i])) i++;
      const gap = i - start;
      const left = start - 1;
      const right = i;
      if (left >= 0 && right < n && gap <= limit) {
        const step = (out[right] - out[left]) / (gap + 1);
        for (let k = 0; k < gap; k++) out[start + k] = out[left] + step * (k + 1);
      }
    } else {
      i++;
    }
  }
  return out;
}

/** UTC day-of-year (1–366) for a Date. */
export function dayOfYear(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((utcDayStart(d) - start) / 86400000) + 1;
}

// --- peaks ---------------------------------------------------------------

/**
 * Plateau-aware local maxima indices (mirrors scipy._local_maxima_1d):
 * a maximum is a point (or plateau midpoint) that rises before and falls
 * after it.
 */
function localMaxima(x) {
  const mids = [];
  const iMax = x.length - 1;
  let i = 1;
  while (i < iMax) {
    if (x[i - 1] < x[i]) {
      let iAhead = i + 1;
      while (iAhead < iMax && x[iAhead] === x[i]) iAhead++;
      if (x[iAhead] < x[i]) {
        mids.push(Math.floor((i + iAhead - 1) / 2));
        i = iAhead;
      } else {
        i = iAhead;
      }
    } else {
      i++;
    }
  }
  return mids;
}

/** Topographic prominence of `peak` in signal x (full-signal window). */
function prominence(x, peak) {
  const peakVal = x[peak];
  let leftMin = peakVal;
  let i = peak - 1;
  while (i >= 0 && x[i] <= peakVal) {
    if (x[i] < leftMin) leftMin = x[i];
    i--;
  }
  let rightMin = peakVal;
  let j = peak + 1;
  while (j < x.length && x[j] <= peakVal) {
    if (x[j] < rightMin) rightMin = x[j];
    j++;
  }
  return peakVal - Math.max(leftMin, rightMin);
}

/**
 * Peak finder in the spirit of scipy.signal.find_peaks, supporting `height`
 * (minimum peak value) and `prominence` (minimum topographic prominence).
 * Returns an array of peak indices.
 */
export function findPeaks(x, { height = null, prominence: minProm = null } = {}) {
  let peaks = localMaxima(x);
  if (height !== null) peaks = peaks.filter((p) => x[p] >= height);
  if (minProm !== null) peaks = peaks.filter((p) => prominence(x, p) >= minProm);
  return peaks;
}

// --- runs / grouping -----------------------------------------------------

/**
 * Run-theory (Yevjevich) analysis of below-threshold deficits. Returns
 * { severity, groupId, worstGroupId } where `severity[i]` is the summed
 * deficit of the run row i belongs to, and worstGroupId marks the worst run.
 */
export function belowRuns(values, threshold) {
  const n = values.length;
  // Missing values count as zero deficit (they end a run rather than poisoning it).
  const deficit = values.map((v) => (Number.isFinite(v) ? Math.max(threshold - v, 0) : 0));
  const below = deficit.map((d) => d > 0);
  const groupId = new Array(n);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (!below[i]) g++; // increments on rows at/above threshold (~below)
    groupId[i] = g;
  }
  const sums = new Map();
  for (let i = 0; i < n; i++) {
    sums.set(groupId[i], (sums.get(groupId[i]) || 0) + deficit[i]);
  }
  const severity = groupId.map((gi) => sums.get(gi));
  let worstGroupId = null;
  let worst = -Infinity;
  for (let i = 0; i < n; i++) {
    if (below[i] && severity[i] > worst) {
      worst = severity[i];
      worstGroupId = groupId[i];
    }
  }
  return { severity, groupId, worstGroupId, below, deficit };
}

// --- temporal metadata -----------------------------------------------------

/** Median gap between successive timestamps, in milliseconds. */
export function medianGapMs(times) {
  if (times.length < 2) return NaN;
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i].getTime() - times[i - 1].getTime());
  }
  return median(gaps);
}

/** Number of days between the first and last timestamp. */
export function spanDays(times) {
  if (times.length < 2) return 0;
  const first = times[0].getTime();
  const last = times[times.length - 1].getTime();
  return Math.floor((last - first) / 86400000);
}

/** True if a record spanning `days` satisfies an indicator needing `req`. */
export function lengthSufficient(days, req) {
  if (req === "any") return true;
  return days >= req;
}

// --- seasonal climatology (day-of-year windows) --------------------------

/** Circular distance between two days of year (1–366). */
function doyDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 366 - d);
}

/**
 * Pool, for every day of year present, all finite values whose day of year
 * lies within ±windowDays (circular, across all years). Returns the per-row
 * day of year and a Map doy -> sorted pool.
 */
export function doyPools(values, times, windowDays) {
  const doy = times.map((d) => dayOfYear(d));
  const byDay = new Map();
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) continue;
    if (!byDay.has(doy[i])) byDay.set(doy[i], []);
    byDay.get(doy[i]).push(values[i]);
  }
  const days = [...byDay.keys()];
  const pools = new Map();
  for (const d of new Set(doy)) {
    const pool = [];
    for (const nd of days) {
      if (doyDistance(nd, d) <= windowDays) for (const v of byDay.get(nd)) pool.push(v);
    }
    pool.sort((a, b) => a - b);
    pools.set(d, pool);
  }
  return { doy, pools };
}

/**
 * Seasonal non-exceedance probability of each value within its day-of-year
 * pool, using the Gringorten plotting position p = (i − 0.44)/(n + 0.12),
 * where i is the number of pool values ≤ the observation. Always in (0, 1).
 */
export function seasonalProbability(values, times, windowDays) {
  const { doy, pools } = doyPools(values, times, windowDays);
  return values.map((v, k) => {
    if (!Number.isFinite(v)) return NaN;
    const pool = pools.get(doy[k]);
    if (!pool || !pool.length) return NaN;
    return (searchsortedRight(pool, v) - 0.44) / (pool.length + 0.12);
  });
}

/** Seasonal climatology (median or mean of each row's day-of-year pool). */
export function seasonalClimatology(values, times, windowDays, stat = "median") {
  const { doy, pools } = doyPools(values, times, windowDays);
  const clim = new Map();
  for (const [d, pool] of pools) clim.set(d, stat === "mean" ? mean(pool) : median(pool));
  return doy.map((d) => clim.get(d));
}

/**
 * Resolve field capacity / wilting point. A positive user value is used as
 * given; 0 means "estimate from the record" (95th / 5th percentile).
 */
export function resolveLimits(vwc, fc, wp) {
  const fcAuto = !(fc > 0);
  const wpAuto = !(wp > 0);
  return {
    fc: fcAuto ? percentile(vwc, 95) : fc,
    wp: wpAuto ? percentile(vwc, 5) : wp,
    fcAuto,
    wpAuto,
  };
}

// --- monthly resampling + seasonal trend test ----------------------------

/**
 * Calendar-month means on a continuous monthly index (empty months -> NaN).
 * Returns { times: Date[] (1st of month, UTC), values: number[] }.
 */
export function resampleMonthly(times, values) {
  const buckets = new Map();
  for (let i = 0; i < times.length; i++) {
    if (!Number.isFinite(values[i])) continue;
    const key = Date.UTC(times[i].getUTCFullYear(), times[i].getUTCMonth(), 1);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(values[i]);
  }
  if (!buckets.size) return { times: [], values: [] };
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const first = new Date(keys[0]);
  const last = new Date(keys[keys.length - 1]);
  const outT = [];
  const outV = [];
  let y = first.getUTCFullYear();
  let m = first.getUTCMonth();
  while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
    const key = Date.UTC(y, m, 1);
    outT.push(new Date(key));
    outV.push(buckets.has(key) ? mean(buckets.get(key)) : NaN);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return { times: outT, values: outV };
}

/**
 * Seasonal Mann-Kendall test (Hirsch et al., 1982) on monthly means, with the
 * seasonal Sen slope. S and Var(S) are summed over the 12 calendar months, so
 * the seasonal cycle does not masquerade as a trend. Returns
 * { Z, p, S, varS, senSlopePerYear, monthly }.
 */
export function seasonalKendall(times, values) {
  const monthly = resampleMonthly(times, values);
  let S = 0;
  let varS = 0;
  const slopes = [];
  for (let m = 0; m < 12; m++) {
    const yr = [];
    const ys = [];
    for (let i = 0; i < monthly.times.length; i++) {
      if (monthly.times[i].getUTCMonth() === m && Number.isFinite(monthly.values[i])) {
        yr.push(monthly.times[i].getUTCFullYear());
        ys.push(monthly.values[i]);
      }
    }
    const n = ys.length;
    if (n < 2) continue;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        S += Math.sign(ys[j] - ys[i]);
        slopes.push((ys[j] - ys[i]) / (yr[j] - yr[i]));
      }
    }
    const counts = new Map();
    for (const v of ys) counts.set(v, (counts.get(v) || 0) + 1);
    let tie = 0;
    for (const c of counts.values()) tie += c * (c - 1) * (2 * c + 5);
    varS += (n * (n - 1) * (2 * n + 5) - tie) / 18;
  }
  let Z = 0;
  if (varS > 0) {
    if (S > 0) Z = (S - 1) / Math.sqrt(varS);
    else if (S < 0) Z = (S + 1) / Math.sqrt(varS);
  }
  const p = 2 * (1 - normCdf(Math.abs(Z)));
  return { Z, p, S, varS, senSlopePerYear: slopes.length ? median(slopes) : NaN, monthly };
}

