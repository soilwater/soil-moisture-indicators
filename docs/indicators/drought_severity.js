import { median, belowRuns, medianGapMs } from "../assets/js/utils.js";

/**
 * Worst below-threshold run (run theory). Each deficit is weighted by the
 * time step in days (1 for daily data), so severity is in m³ m⁻³ · day.
 */
function worstRun(vwc, times) {
  const thr = median(vwc);
  const dtDays = medianGapMs(times) / 86400000;
  const { groupId, worstGroupId, below, deficit } = belowRuns(vwc, thr);
  const idx = [];
  for (let i = 0; i < vwc.length; i++) if (groupId[i] === worstGroupId && below[i]) idx.push(i);
  const severity = idx.reduce((s, i) => s + deficit[i], 0) * dtDays;
  const duration = idx.length * dtDays;
  return { thr, idx, severity, duration };
}

export default {
  id: "drought_severity",
  name: "Drought Severity (run theory)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Accumulated moisture deficit below a fixed threshold (the record median) during the most severe uninterrupted dry run. Severity integrates depth and duration, so it has units of m³/m³ × days.",
  context:
    "Summarizes a whole record into a single 'worst dry spell' number that blends how deep and how long it was. Useful for ranking seasons or sites when you need one comparable figure. Because the threshold is fixed, a normal dry season also counts as deficit.",
  equations: [
    "\\delta_t = \\max(\\tilde{\\theta} - \\theta_t,\\; 0)",
    "S = \\max_{R} \\sum_{t \\in R} \\delta_t\\,\\Delta t",
    "D = |R^{*}|\\,\\Delta t",
  ],
  variables: [
    ["\\delta_t", "moisture deficit below the threshold on day t (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\tilde{\\theta}", "threshold: median of the whole record (m³/m³)"],
    ["R", "a run of consecutive days with δ_t > 0"],
    ["R^{*}", "the run with the largest summed deficit"],
    ["\\Delta t", "time step (1 day)"],
    ["S", "drought severity (m³/m³ · day)"],
    ["D", "duration of the most severe run (days)"],
  ],
  reference:
    "Yevjevich, V. (1967). An objective approach to definitions and investigations of continental hydrologic droughts. Hydrology Papers No. 23, Colorado State University, Fort Collins.",
  args: [{ kind: "series", column: "timestamp" }],
  caption(result, ctx) {
    const { duration } = worstRun(ctx.primary, ctx.times);
    return `<strong>Severity = ${result.toFixed(2)} m³/m³·day</strong> over a ${duration.toFixed(0)}-day run below the median. Higher means a deeper or longer drought.`;
  },
  compute(vwc, timestamp) {
    return worstRun(vwc, timestamp).severity;
  },
  plot(result, ctx) {
    const { colors, times, primary } = ctx;
    const { thr, idx } = worstRun(primary, times);
    const traces = [
      {
        x: times, y: primary, type: "scattergl", mode: "lines",
        line: { color: colors.text, width: 1 }, name: "VWC",
        hovertemplate: "%{y:.3f}<extra>VWC</extra>",
      },
      {
        x: times, y: primary.map(() => thr), type: "scattergl", mode: "lines",
        line: { color: colors.muted, width: 1, dash: "dash" }, name: "Median (threshold)", hoverinfo: "skip",
      },
    ];
    // Worst run drawn as a closed polygon between the VWC curve and the median.
    if (idx.length) {
      const rx = idx.map((i) => times[i]);
      const ry = idx.map((i) => primary[i]);
      traces.push({
        x: [...rx, ...rx.slice().reverse()],
        y: [...ry, ...rx.map(() => thr)],
        type: "scatter", mode: "lines", line: { width: 0 },
        fill: "toself", fillcolor: "rgba(178,34,34,0.4)",
        name: "Most severe run", hoverinfo: "skip",
      });
    }
    return { traces, layout: { showlegend: true, yaxis: { title: { text: "VWC (m³/m³)" } } } };
  },
};
