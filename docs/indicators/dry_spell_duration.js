import { median, medianGapMs } from "../assets/js/utils.js";

export default {
  id: "dry_spell_duration",
  name: "Dry-Spell Duration (days below median)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Running length, in days, of the current spell with soil moisture below the record median. Resets to zero whenever moisture returns to or above the median.",
  context:
    "Turns a wiggly line into a simple 'days drier than normal' count: an easy way to show a dry spell building or breaking without explaining statistics. Uses a fixed threshold, so the normal dry season also accumulates days.",
  equations: [
    "D_t = D_{t-1} + 1 \\quad \\text{if } \\theta_t < \\tilde{\\theta}",
    "D_t = 0 \\quad \\text{otherwise}",
  ],
  variables: [
    ["D_t", "length of the current dry spell on day t (days)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\tilde{\\theta}", "median of the whole record (m³/m³)"],
  ],
  reference: "N/A",
  args: [{ kind: "series", column: "timestamp" }],
  caption(result) {
    const max = Math.max(...result.filter(Number.isFinite));
    return `<strong>Longest dry spell: ${max.toFixed(0)} days</strong> below the record median.`;
  },
  compute(vwc, timestamp) {
    const thr = median(vwc);
    const dtDays = medianGapMs(timestamp) / 86400000;
    const out = new Array(vwc.length).fill(0);
    let run = 0;
    for (let i = 0; i < vwc.length; i++) {
      run = vwc[i] < thr ? run + dtDays : 0;
      out[i] = run;
    }
    return out;
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent, width: 1 }, fill: "tozeroy",
          fillcolor: "rgba(79,134,247,0.2)", name: "Dry-spell length",
          hovertemplate: "%{y:.0f} days<extra></extra>",
        },
      ],
      layout: { showlegend: false, yaxis: { title: { text: "Days below median" } } },
    };
  },
};
