import { seasonalProbability } from "../assets/js/utils.js";

// USDM percentile ranges: D4 0–2, D3 3–5, D2 6–10, D1 11–20, D0 21–30.
const CLASSES = [
  { label: "D4", max: 2, color: "#730000" },
  { label: "D3", max: 5, color: "#e60000" },
  { label: "D2", max: 10, color: "#ffaa00" },
  { label: "D1", max: 20, color: "#fcd37f" },
  { label: "D0", max: 30, color: "#ffff00" },
];

function classify(pct) {
  if (!Number.isFinite(pct)) return "No data";
  for (const c of CLASSES) if (pct <= c.max) return c.label;
  return "No drought";
}

export default {
  id: "usdm_drought_category",
  name: "Drought Category (USDM percentile scale)",
  type: "categorical",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "daily",
  minDays: 730,
  description:
    "D0–D4 drought category from the seasonal percentile (±w days across all years), using the U.S. Drought Monitor percentile ranges (D0 ≤ 30, D1 ≤ 20, D2 ≤ 10, D3 ≤ 5, D4 ≤ 2). This is the soil moisture component only; the official USDM blends multiple indicators with expert judgment.",
  equations: [
    "P_t = 100\\,\\frac{i_t - 0.44}{n_t + 0.12}",
    "\\text{D4}: \\; P_t \\le 2",
    "\\text{D3}: \\; 2 < P_t \\le 5",
    "\\text{D2}: \\; 5 < P_t \\le 10",
    "\\text{D1}: \\; 10 < P_t \\le 20",
    "\\text{D0}: \\; 20 < P_t \\le 30",
  ],
  variables: [
    ["P_t", "seasonal percentile of day t (0–100)"],
    ["i_t", "number of values in the seasonal pool that are ≤ θ_t"],
    ["n_t", "number of values in the seasonal pool: all days, in any year, within ±w days of the same calendar day"],
    ["w", "half-width of the seasonal window (days)"],
  ],
  reference:
    "Svoboda, M., et al. (2002). The Drought Monitor. Bull. Amer. Meteor. Soc., 83(8), 1181-1190. https://doi.org/10.1175/1520-0477-83.8.1181",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "windowDays", label: "Seasonal window w (± days)", type: "int", default: 15, min: 3, max: 45, step: 1 },
  ],
  caption(result) {
    const n = result.filter((x) => x !== "No data").length;
    const parts = CLASSES.map((c) => {
      const k = result.filter((x) => x === c.label).length;
      return `${c.label} ${((100 * k) / n).toFixed(1)}%`;
    });
    return `<strong>Share of record by category:</strong> ${parts.join(" · ")}`;
  },
  compute(vwc, timestamp, windowDays) {
    const p = seasonalProbability(vwc, timestamp, windowDays);
    return p.map((x) => classify(100 * x));
  },
  plot(result, ctx) {
    const { colors, times, primary } = ctx;
    const traces = [
      {
        x: times, y: primary, type: "scattergl", mode: "lines",
        line: { color: colors.muted, width: 1 }, name: "VWC", hoverinfo: "skip",
      },
    ];
    // Driest classes drawn last so they sit on top.
    for (const c of [...CLASSES].reverse()) {
      const xs = [];
      const ys = [];
      result.forEach((lab, i) => { if (lab === c.label) { xs.push(times[i]); ys.push(primary[i]); } });
      traces.push({
        x: xs, y: ys, type: "scattergl", mode: "markers",
        marker: { color: c.color, size: 5 }, name: c.label,
        hovertemplate: `%{x}<br>${c.label}<extra></extra>`,
      });
    }
    return { traces, layout: { showlegend: true, yaxis: { title: { text: "VWC (m³/m³)" } } } };
  },
};
