import { seasonalProbability } from "../assets/js/utils.js";

export default {
  id: "soil_moisture_percentile",
  name: "Soil Moisture Percentile (SMP)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "daily",
  minDays: 730,
  description:
    "Percentile (0–100) of each observation relative to all observations from the same time of year (±w days across all years; Gringorten plotting position). Seasonal ranking prevents the climatological dry season from being classified as drought.",
  equations: [
    "P_t = 100\\,\\frac{i_t - 0.44}{n_t + 0.12}",
    "i_t = \\#\\{\\theta_s \\le \\theta_t : |d(s) - d(t)| \\le w\\}",
  ],
  variables: [
    ["P_t", "seasonal percentile of day t (0–100)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["i_t", "number of values in the seasonal pool that are ≤ θ_t"],
    ["n_t", "number of values in the seasonal pool: all days, in any year, within ±w days of the same calendar day"],
    ["d(t)", "day of year of day t (1–366, treated as circular)"],
    ["w", "half-width of the seasonal window (days)"],
  ],
  reference:
    "Sheffield, J., Goteti, G., Wen, F., & Wood, E. F. (2004). A simulated soil moisture based drought analysis for the United States. J. Geophys. Res., 109, D24108. https://doi.org/10.1029/2004JD005182",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "windowDays", label: "Seasonal window w (± days)", type: "int", default: 15, min: 3, max: 45, step: 1 },
    { kind: "param", name: "droughtPercentile", label: "Drought threshold (percentile)", type: "int", default: 10, min: 1, max: 30, step: 1 },
  ],
  caption(result, ctx) {
    const fin = result.filter(Number.isFinite);
    const thr = ctx.params.droughtPercentile;
    const below = fin.filter((p) => p <= thr).length;
    return `<strong>${((100 * below) / fin.length).toFixed(1)}%</strong> of observations at or below the ${thr}th seasonal percentile.`;
  },
  compute(vwc, timestamp, windowDays) {
    return seasonalProbability(vwc, timestamp, windowDays).map((p) => 100 * p);
  },
  plot(result, ctx) {
    const { colors, times, params } = ctx;
    const thr = params.droughtPercentile;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent, width: 1.2 }, name: "Percentile",
          hovertemplate: "%{y:.1f}<extra></extra>",
        },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "Seasonal percentile" }, range: [0, 100] },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: thr, y1: thr, line: { color: colors.warn, width: 1, dash: "dash" } }],
        annotations: [{ x: 0, xref: "paper", y: thr, yref: "y", xanchor: "left", yanchor: "bottom", text: `Drought threshold (${thr}th)`, showarrow: false, font: { size: 11, color: colors.warn } }],
      },
    };
  },
};
