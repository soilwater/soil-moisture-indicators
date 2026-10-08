export default {
  id: "soil_water_index",
  name: "Soil Water Index (SWI)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Recursive exponential filter that propagates near-surface soil moisture to a root-zone proxy, controlled by a characteristic time length T (days). Larger T represents a deeper, more slowly responding layer; when the input is already a profile average, the filter mainly adds smoothing.",
  equations: [
    "\\mathrm{SWI}_t = \\mathrm{SWI}_{t-1} + K_t\\,(\\theta_t - \\mathrm{SWI}_{t-1})",
    "K_t = \\frac{K_{t-1}}{K_{t-1} + e^{-\\Delta t/T}}",
    "\\mathrm{SWI}_1 = \\theta_1",
    "K_1 = 1",
  ],
  variables: [
    ["\\mathrm{SWI}_t", "soil water index on day t (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["K_t", "filter gain on day t (–)"],
    ["\\Delta t", "time between consecutive observations (days)"],
    ["T", "characteristic time length (days)"],
  ],
  reference:
    "Wagner, W., Lemoine, G., & Rott, H. (1999). A method for estimating soil moisture from ERS scatterometer and soil data. Remote Sens. Environ., 70(2), 191-207. https://doi.org/10.1016/S0034-4257(99)00036-X ; Albergel, C., et al. (2008). From near-surface to root-zone soil moisture using an exponential filter. Hydrol. Earth Syst. Sci., 12, 1323-1337. https://doi.org/10.5194/hess-12-1323-2008",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "tDays", label: "Characteristic time T (days)", type: "number", default: 10, min: 1, max: 60, step: 1 },
  ],
  compute(vwc, timestamp, tDays) {
    // Forward/back-fill NaNs so the recursion is continuous.
    const v = vwc.slice();
    let last = NaN;
    for (let i = 0; i < v.length; i++) { if (!Number.isFinite(v[i])) v[i] = last; else last = v[i]; }
    last = NaN;
    for (let i = v.length - 1; i >= 0; i--) { if (!Number.isFinite(v[i])) v[i] = last; else last = v[i]; }
    const n = v.length;
    const swi = new Array(n).fill(NaN);
    if (!n) return swi;
    swi[0] = v[0];
    let K = 1.0;
    for (let i = 1; i < n; i++) {
      const dtDays = (timestamp[i].getTime() - timestamp[i - 1].getTime()) / 86400000;
      K = K / (K + Math.exp(-dtDays / tDays));
      swi[i] = swi[i - 1] + K * (v[i] - swi[i - 1]);
    }
    return swi;
  },
  plot(result, ctx) {
    const { colors, times, primary, params } = ctx;
    return {
      traces: [
        {
          x: times, y: primary, type: "scattergl", mode: "lines",
          line: { color: colors.muted, width: 1 }, name: "Raw VWC",
          hovertemplate: "%{y:.3f}<extra>Raw</extra>",
        },
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.good, width: 1.8 }, name: `SWI (T=${params.tDays}d)`,
          hovertemplate: "%{y:.3f}<extra>SWI</extra>",
        },
      ],
      layout: { showlegend: true, yaxis: { title: { text: "VWC (m³/m³)" } } },
    };
  },
};
