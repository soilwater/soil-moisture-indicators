import { resampleDaily } from "../assets/js/utils.js";

export default {
  id: "antecedent_precipitation_index",
  name: "Antecedent Precipitation Index (API)",
  type: "timeseries",
  primary: "precip",
  requires: ["precip"],
  minResolution: "any",
  minDays: "any",
  description:
    "Daily running total of rainfall in which each earlier day's contribution decays by the factor k (0 < k < 1), a simple proxy for how wet the soil should be from precipitation alone. The index starts at zero, so the first few weeks (roughly 3/(1 − k) days) are underestimated.",
  context:
    "Estimates how wet the soil should be from rainfall alone, before you trust any sensor. When measured moisture disagrees with recent rain it points to runoff, drainage, or a sensor problem.",
  equations: [
    "\\mathrm{API}_t = k\\,\\mathrm{API}_{t-1} + P_t",
    "\\mathrm{API}_0 = 0",
  ],
  variables: [
    ["\\mathrm{API}_t", "antecedent precipitation index on day t (mm)"],
    ["P_t", "daily precipitation on day t (mm)"],
    ["k", "daily recession factor (0 < k < 1)"],
  ],
  reference:
    "Kohler, M. A., & Linsley, R. K. (1951). Predicting the runoff from storm rainfall. Research Paper No. 34, U.S. Weather Bureau, Washington, D.C.",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "k", label: "Recession factor k", type: "number", default: 0.9, min: 0.5, max: 0.99, step: 0.01 },
  ],
  compute(precip, timestamp, k) {
    // Daily rainfall totals so the daily recession factor is applied once/day.
    const daily = resampleDaily(timestamp, precip, "sum");
    const apiByDay = new Map();
    let value = 0;
    for (let i = 0; i < daily.times.length; i++) {
      value = k * value + (Number.isFinite(daily.values[i]) ? daily.values[i] : 0);
      apiByDay.set(daily.times[i].getTime(), value);
    }
    return timestamp.map((d) => {
      const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return apiByDay.has(key) ? apiByDay.get(key) : NaN;
    });
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent, width: 1.5 }, name: "API",
          hovertemplate: "%{y:.1f} mm<extra>API</extra>",
        },
      ],
      layout: { showlegend: false, yaxis: { title: { text: "API (mm)" } } },
    };
  },
};
