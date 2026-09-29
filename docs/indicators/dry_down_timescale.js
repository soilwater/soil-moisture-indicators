import { resampleDaily, interpolateLimit, polyfit1, median } from "../assets/js/utils.js";

/**
 * Fit θ(t) = θr + (θ0 − θr)·exp(−t/τ) to one dry-down by scanning the residual
 * θr on a grid (0 … just below the event minimum) and solving the log-linear
 * fit for each; keeps the θr with the smallest squared error in θ space.
 */
function fitDryDown(days, vals) {
  const vmin = Math.min(...vals);
  let best = null;
  const steps = 60;
  for (let s = 0; s < steps; s++) {
    const thr = (vmin - 1e-4) * (s / (steps - 1));
    const y = vals.map((v) => Math.log(v - thr));
    const { slope, intercept } = polyfit1(days, y);
    if (!(slope < 0)) continue;
    let sse = 0;
    for (let i = 0; i < days.length; i++) {
      const pred = thr + Math.exp(intercept + slope * days[i]);
      sse += (vals[i] - pred) ** 2;
    }
    if (!best || sse < best.sse) best = { thr, slope, intercept, sse };
  }
  if (!best) return null;
  return { tau: -1 / best.slope, thetaR: best.thr, intercept: best.intercept, slope: best.slope };
}

/**
 * Dry-down events on daily data. An event starts at a wetting peak (a day that
 * is not lower than the previous day and is followed by a decline) and
 * continues while daily rain ≤ maxRain and VWC does not rise by more than
 * `riseTol` from one day to the next. Events lasting at least `minDays` are
 * fitted with the exponential model above.
 */
function dryDownEvents(times, vwc, precip, minDays, maxRain, riseTol) {
  const dv = resampleDaily(times, vwc, "mean");
  const dp = resampleDaily(times, precip, "sum");
  const t = dv.times;
  const v = interpolateLimit(dv.values, 3);
  const p = dp.values.map((x) => (Number.isFinite(x) ? x : 0));
  const n = v.length;
  const events = [];
  let i = 1;
  while (i < n - 1) {
    const isPeak = Number.isFinite(v[i]) && Number.isFinite(v[i - 1]) && Number.isFinite(v[i + 1])
      && v[i] >= v[i - 1] && v[i + 1] < v[i];
    if (!isPeak) { i++; continue; }
    let j = i;
    while (
      j + 1 < n && Number.isFinite(v[j + 1]) &&
      p[j + 1] <= maxRain && v[j + 1] - v[j] <= riseTol
    ) j++;
    if (j - i >= minDays) {
      const days = [];
      const vals = [];
      for (let k = i; k <= j; k++) { days.push(k - i); vals.push(v[k]); }
      const fit = fitDryDown(days, vals);
      events.push({ start: i, end: j, fit });
    }
    i = Math.max(j, i + 1);
  }
  return { t, v, events };
}

export default {
  id: "dry_down_timescale",
  name: "Dry-Down Timescale (τ)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc", "precip"],
  minResolution: "daily",
  minDays: "any",
  description:
    "E-folding time of soil drying after wetting. Each dry-down starts at a wetting peak and lasts while daily rain stays at or below a tolerance; it is fit with an exponential decay toward a residual moisture level. The value reported is the median τ across dry-downs.",
  context:
    "How fast soil dries after rain reflects its texture, drainage, and plant water use. Comparing drying timescales between sites or seasons reveals differences you can't see from the moisture level alone: a short τ means water leaves the soil quickly.",
  equations: [
    "\\theta(t) = \\theta_r + (\\theta_0 - \\theta_r)\\,e^{-t/\\tau}",
    "k = 1/\\tau",
    "\\text{dry-down continues while } P_t \\le P_{\\max} \\text{ and } \\theta_t - \\theta_{t-1} \\le \\varepsilon",
    "\\text{dry-downs shorter than } L \\text{ days are discarded}",
    "\\hat{\\tau} = \\operatorname{median}_j \\tau_j",
  ],
  variables: [
    ["t", "days since the start of the dry-down (the wetting peak)"],
    ["\\theta(t)", "daily mean volumetric water content (m³/m³)"],
    ["\\theta_0", "fitted water content at the start of the dry-down (m³/m³)"],
    ["\\theta_r", "fitted residual water content the soil dries toward (m³/m³)"],
    ["\\tau", "e-folding drying timescale of one dry-down (days)"],
    ["k", "drying rate (d⁻¹)"],
    ["P_t", "daily precipitation on day t (mm)"],
    ["P_{\\max}", "rain tolerated per day inside a dry-down (mm)"],
    ["\\varepsilon", "day-to-day rise in water content tolerated as sensor noise (m³/m³)"],
    ["L", "minimum dry-down length (days)"],
    ["\\hat{\\tau}", "reported value: median τ over all dry-downs j"],
  ],
  reference:
    "McColl, K. A., et al. (2017). Global characterization of surface soil moisture drydowns. Geophys. Res. Lett., 44, 3682-3690. https://doi.org/10.1002/2017GL072819 ; Rondinelli, W. J., et al. (2015). J. Hydrometeorol., 16(2), 889-903. https://doi.org/10.1175/JHM-D-14-0137.1",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "series", column: "precip" },
    { kind: "param", name: "minDays", label: "Minimum dry-down length (days)", type: "int", default: 7, min: 3, max: 30, step: 1 },
    { kind: "param", name: "maxRain", label: "Rain tolerated per day (mm)", type: "number", default: 2, min: 0, max: 10, step: 0.5 },
    { kind: "param", name: "riseTol", label: "VWC rise tolerated per day (m³/m³)", type: "number", default: 0.005, min: 0, max: 0.03, step: 0.001 },
  ],
  caption(result, ctx) {
    if (!Number.isFinite(result)) {
      return "No dry-downs met the criteria. Try a shorter minimum length or a higher rain tolerance.";
    }
    const { events } = dryDownEvents(ctx.times, ctx.primary, ctx.data.precip, ctx.params.minDays, ctx.params.maxRain, ctx.params.riseTol);
    const fitted = events.filter((e) => e.fit).length;
    return `<strong>Median τ = ${result.toFixed(1)} days</strong> (k = ${(1 / result).toFixed(3)} d⁻¹) across ${fitted} dry-downs. Shorter τ means faster drying.`;
  },
  compute(vwc, timestamp, precip, minDays, maxRain, riseTol) {
    const { events } = dryDownEvents(timestamp, vwc, precip, minDays, maxRain, riseTol);
    const taus = events.filter((e) => e.fit).map((e) => e.fit.tau);
    return taus.length ? median(taus) : NaN;
  },
  plot(result, ctx) {
    const { colors, params } = ctx;
    const { t, v, events } = dryDownEvents(ctx.times, ctx.primary, ctx.data.precip, params.minDays, params.maxRain, params.riseTol);
    const hx = [];
    const hy = [];
    const fx = [];
    const fy = [];
    for (const e of events) {
      for (let k = e.start; k <= e.end; k++) { hx.push(t[k]); hy.push(v[k]); }
      hx.push(null); hy.push(null);
      if (e.fit) {
        for (let k = e.start; k <= e.end; k++) {
          fx.push(t[k]);
          fy.push(e.fit.thetaR + Math.exp(e.fit.intercept + e.fit.slope * (k - e.start)));
        }
        fx.push(null); fy.push(null);
      }
    }
    const traces = [
      {
        x: t, y: v, type: "scattergl", mode: "lines",
        line: { color: colors.muted, width: 1 }, name: "Daily VWC",
        hovertemplate: "%{y:.3f}<extra></extra>",
      },
    ];
    if (hx.length) {
      traces.push({
        x: hx, y: hy, type: "scatter", mode: "lines", connectgaps: false,
        line: { color: "#e0552b", width: 2.6 }, name: "Dry-downs",
        hovertemplate: "%{y:.3f}<extra>dry-down</extra>",
      });
    }
    if (fx.length) {
      traces.push({
        x: fx, y: fy, type: "scatter", mode: "lines", connectgaps: false,
        line: { color: colors.text, width: 1.2, dash: "dot" }, name: "Exponential fit",
        hoverinfo: "skip",
      });
    }
    return { traces, layout: { showlegend: true, yaxis: { title: { text: "VWC (m³/m³)" } } } };
  },
};
