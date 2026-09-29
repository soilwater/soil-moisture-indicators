import { resolveLimits } from "../assets/js/utils.js";

// Martínez-Fernández et al. (2015) drought classes.
const CLASS_LINES = [
  { y: 0, label: "0: no drought above" },
  { y: -2, label: "−2: mild / moderate" },
  { y: -5, label: "−5: moderate / severe" },
  { y: -10, label: "−10: severe / extreme" },
];

export default {
  id: "soil_water_deficit_index",
  name: "Soil Water Deficit Index (SWDI)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Soil moisture relative to the available water capacity (field capacity minus wilting point), scaled so 0 is field capacity and −10 is the wilting point. Enter lab or field values for θFC and θWP, or leave 0 to estimate them as the record's 95th and 5th percentiles.",
  context:
    "An agricultural drought index framed around what plants can use: positive values mean water in excess of field capacity, negative values a growing deficit. Its published classes (mild, moderate, severe, extreme) make it easy to report agricultural drought.",
  equations: [
    "\\mathrm{SWDI}_t = 10\\,\\frac{\\theta_t - \\theta_{FC}}{\\theta_{FC} - \\theta_{WP}}",
  ],
  variables: [
    ["\\mathrm{SWDI}_t", "soil water deficit index on day t: 0 at field capacity, −10 at the wilting point"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\theta_{FC}", "field capacity (m³/m³); user value, or the record's 95th percentile if left at 0"],
    ["\\theta_{WP}", "wilting point (m³/m³); user value, or the record's 5th percentile if left at 0"],
  ],
  reference:
    "Martínez-Fernández, J., González-Zamora, A., Sánchez, N., & Gumuzzio, A. (2015). A soil water based index as a suitable agricultural drought indicator. J. Hydrol., 522, 265-273. https://doi.org/10.1016/j.jhydrol.2014.12.051",
  args: [
    { kind: "param", name: "fc", label: "Field capacity θFC (m³/m³, 0 = estimate)", type: "number", default: 0, min: 0, max: 0.6, step: 0.005 },
    { kind: "param", name: "wp", label: "Wilting point θWP (m³/m³, 0 = estimate)", type: "number", default: 0, min: 0, max: 0.4, step: 0.005 },
  ],
  caption(result, ctx) {
    const { fc, wp, fcAuto, wpAuto } = resolveLimits(ctx.primary, ctx.params.fc, ctx.params.wp);
    const fin = result.filter(Number.isFinite);
    const share = (lo, hi) => ((100 * fin.filter((x) => x <= hi && x > lo).length) / fin.length).toFixed(1);
    return `θFC = ${fc.toFixed(3)}${fcAuto ? " (estimated)" : ""}, θWP = ${wp.toFixed(3)}${wpAuto ? " (estimated)" : ""}. Time in class: mild ${share(-2, 0)}% · moderate ${share(-5, -2)}% · severe ${share(-10, -5)}% · extreme ${share(-Infinity, -10)}%.`;
  },
  compute(vwc, fc, wp) {
    const lim = resolveLimits(vwc, fc, wp);
    const awc = lim.fc - lim.wp;
    if (!(awc > 0)) return vwc.map(() => NaN);
    return vwc.map((v) => (10 * (v - lim.fc)) / awc);
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    const neg = result.map((v) => (v < 0 ? v : 0));
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: "#c8843a", width: 1.2 }, name: "SWDI",
          hovertemplate: "%{y:.2f}<extra></extra>",
        },
        { x: times, y: neg, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(200,132,58,0.25)", name: "Deficit", hoverinfo: "skip" },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "SWDI" } },
        shapes: CLASS_LINES.map((c) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: c.y, y1: c.y, line: { color: c.y === 0 ? colors.muted : colors.warn, width: 1, dash: "dot" } })),
        annotations: CLASS_LINES.slice(1).map((c) => ({ x: 1, xref: "paper", y: c.y, yref: "y", xanchor: "right", yanchor: "top", text: c.label, showarrow: false, font: { size: 10, color: colors.warn } })),
      },
    };
  },
};
