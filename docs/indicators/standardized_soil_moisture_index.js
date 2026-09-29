import { seasonalProbability, normInv } from "../assets/js/utils.js";

const CLASS_LINES = [
  { y: -1, label: "Moderate (−1)" },
  { y: -1.5, label: "Severe (−1.5)" },
  { y: -2, label: "Extreme (−2)" },
];

export default {
  id: "standardized_soil_moisture_index",
  name: "Standardized Soil Moisture Index (SSI)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "daily",
  minDays: 730,
  description:
    "Nonparametric standardized index: each observation's empirical probability relative to the same time of year (Gringorten plotting position, ±w days across all years) is transformed to a standard-normal value.",
  context:
    "Puts moisture on the same scale as the SPI rainfall index, so values are comparable across sites and seasons: 0 is normal, −1 moderately dry, −1.5 severely dry, −2 extremely dry. It is the percentile (SMP) expressed in standard deviations. Needs several years of data.",
  equations: [
    "p_t = \\frac{i_t - 0.44}{n_t + 0.12}",
    "\\mathrm{SSI}_t = \\Phi^{-1}(p_t)",
  ],
  variables: [
    ["\\mathrm{SSI}_t", "standardized soil moisture index on day t (standard deviations)"],
    ["p_t", "seasonal non-exceedance probability (Gringorten plotting position)"],
    ["i_t", "number of values in the seasonal pool that are ≤ θ_t"],
    ["n_t", "number of values in the seasonal pool: all days, in any year, within ±w days of the same calendar day"],
    ["\\Phi^{-1}", "inverse of the standard normal cumulative distribution function"],
    ["w", "half-width of the seasonal window (days)"],
  ],
  reference:
    "Farahmand, A., & AghaKouchak, A. (2015). A generalized framework for deriving nonparametric standardized drought indicators. Adv. Water Resour., 76, 140-145. https://doi.org/10.1016/j.advwatres.2014.11.012 ; classes after McKee, T. B., Doesken, N. J., & Kleist, J. (1993), 8th Conf. on Applied Climatology, AMS, 179-184.",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "windowDays", label: "Seasonal window w (± days)", type: "int", default: 15, min: 3, max: 45, step: 1 },
  ],
  caption(result) {
    const fin = result.filter(Number.isFinite);
    const share = (thr) => ((100 * fin.filter((z) => z <= thr).length) / fin.length).toFixed(1);
    return `Time at or below <strong>−1</strong>: ${share(-1)}% · <strong>−1.5</strong>: ${share(-1.5)}% · <strong>−2</strong>: ${share(-2)}%`;
  },
  compute(vwc, timestamp, windowDays) {
    return seasonalProbability(vwc, timestamp, windowDays).map((p) => (Number.isFinite(p) ? normInv(p) : NaN));
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent2, width: 1.2 }, name: "SSI",
          hovertemplate: "%{y:.2f}<extra></extra>",
        },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "SSI (standard deviations)" } },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: colors.muted, width: 1 } },
          ...CLASS_LINES.map((c) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: c.y, y1: c.y, line: { color: colors.warn, width: 1, dash: "dot" } })),
        ],
        annotations: CLASS_LINES.map((c) => ({ x: 1, xref: "paper", y: c.y, yref: "y", xanchor: "right", yanchor: "bottom", text: c.label, showarrow: false, font: { size: 10, color: colors.warn } })),
      },
    };
  },
};
