import { resampleDaily, interpolateLimit, seasonalClimatology, autocorr, std } from "../assets/js/utils.js";

/**
 * Autocorrelation of daily anomalies from a smoothed seasonal climatology
 * (mean of all days within ±15 days of the same calendar day), and the lag at
 * which it first falls to 1/e, linearly interpolated between whole-day lags.
 */
function memoryAcf(times, vwc, maxLagDays) {
  const daily = resampleDaily(times, vwc, "mean");
  const values = interpolateLimit(daily.values, 3);
  const clim = seasonalClimatology(values, daily.times, 15, "mean");
  const anomaly = values.map((v, i) => (Number.isFinite(v) ? v - clim[i] : NaN));
  const years = new Set(daily.times.map((d) => d.getUTCFullYear()));
  if (years.size < 2 || !(std(anomaly) >= 1e-9)) return { acf: [], memory: NaN };
  const maxLag = Math.min(maxLagDays, anomaly.length - 2);
  if (maxLag < 1) return { acf: [], memory: NaN };
  const acf = [];
  let memory = NaN;
  let prev = 1; // r(0) = 1
  const target = 1 / Math.E;
  for (let lag = 1; lag <= maxLag; lag++) {
    const val = autocorr(anomaly, lag);
    acf.push({ lag, val });
    if (Number.isNaN(memory) && val < target) {
      memory = lag - 1 + (prev - target) / (prev - val);
    }
    prev = val;
  }
  return { acf, memory };
}

export default {
  id: "soil_moisture_memory",
  name: "Soil Moisture Memory (e-folding)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: 730,
  description:
    "Lag (days) at which the autocorrelation of daily soil moisture anomalies first decays to 1/e. Anomalies are departures from a smoothed seasonal climatology (±15 days), so the seasonal cycle does not inflate persistence. Needs at least two years of data.",
  context:
    "Measures how long the soil 'remembers' a wet or dry anomaly. Longer memory means today's conditions carry more skill for predicting the coming weeks — useful context for forecasting and irrigation planning.",
  equations: [
    "a_t = \\theta_t - \\bar{\\theta}_{d(t)}",
    "\\bar{\\theta}_{d} = \\operatorname{mean}\\{\\theta_s : |d(s) - d| \\le 15\\}",
    "\\rho(\\tau) = \\operatorname{corr}(a_t,\\, a_{t+\\tau})",
    "\\rho(\\tau^{*}) = 1/e",
  ],
  variables: [
    ["a_t", "soil moisture anomaly on day t (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\bar{\\theta}_{d}", "smoothed seasonal mean for day of year d (±15 days, all years)"],
    ["d(t)", "day of year of day t (1–366, treated as circular)"],
    ["\\rho(\\tau)", "autocorrelation of the anomalies at lag τ"],
    ["\\tau", "lag (days)"],
    ["\\tau^{*}", "soil moisture memory: first lag at which ρ falls to 1/e, interpolated between whole days (days)"],
  ],
  reference:
    "Entin, J. K., Robock, A., Vinnikov, K. Y., Hollinger, S. E., Liu, S., & Namkhai, A. (2000). Temporal and spatial scales of observed soil moisture variations in the extratropics. J. Geophys. Res., 105(D9), 11865-11877. https://doi.org/10.1029/2000JD900051",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "maxLagDays", label: "Max lag (days)", type: "int", default: 60, min: 10, max: 180, step: 5 },
  ],
  caption(result) {
    return Number.isFinite(result)
      ? `<strong>Memory ≈ ${result.toFixed(1)} days</strong>: how long a wet or dry anomaly typically persists (autocorrelation decays to 1/e).`
      : "Not enough data — memory needs about two years to separate season from anomaly.";
  },
  compute(vwc, timestamp, maxLagDays) {
    return memoryAcf(timestamp, vwc, maxLagDays).memory;
  },
  plot(result, ctx) {
    const { colors, times, primary, params } = ctx;
    const { acf } = memoryAcf(times, primary, params.maxLagDays);
    if (!acf.length) {
      return {
        traces: [],
        layout: {
          xaxis: { visible: false }, yaxis: { visible: false },
          annotations: [{ text: "Not enough data (needs ~2 years)", showarrow: false, x: 0.5, y: 0.5, xref: "paper", yref: "paper", font: { color: colors.muted, size: 16 } }],
        },
      };
    }
    const shapes = [
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: 1 / Math.E, y1: 1 / Math.E, line: { color: colors.warn, width: 1, dash: "dash" } },
    ];
    if (Number.isFinite(result)) {
      shapes.push({ type: "line", x0: result, x1: result, yref: "paper", y0: 0, y1: 1, line: { color: colors.text, width: 1, dash: "dot" } });
    }
    return {
      traces: [
        {
          x: acf.map((a) => a.lag), y: acf.map((a) => a.val), type: "scatter",
          mode: "lines+markers", marker: { size: 4, color: "#5b3fb0" }, line: { color: "#5b3fb0", width: 1 },
          name: "ACF", hovertemplate: "lag %{x}d: %{y:.3f}<extra></extra>",
        },
      ],
      layout: {
        showlegend: false, shapes,
        xaxis: { title: { text: "Lag (days)" } },
        yaxis: { title: { text: "Autocorrelation" } },
        annotations: [
          { x: 0, xref: "paper", y: 1 / Math.E, yref: "y", xanchor: "left", yanchor: "bottom", text: "1/e", showarrow: false, font: { size: 11, color: colors.warn } },
          ...(Number.isFinite(result) ? [{ x: result, xref: "x", y: 1, yref: "paper", yanchor: "bottom", text: `Memory ≈ ${result.toFixed(0)} days`, showarrow: false, font: { size: 12, color: colors.text } }] : []),
        ],
      },
    };
  },
};
