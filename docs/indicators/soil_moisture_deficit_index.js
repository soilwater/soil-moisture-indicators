import { resampleDaily, dayOfYear, median } from "../assets/js/utils.js";

/** Weekly SMDI series and its representative week-start times. */
function smdiSeries(times, vwc) {
  const daily = resampleDaily(times, vwc, "mean");
  // weekly means + week-of-year index (0..52)
  const wTimes = [];
  const wVals = [];
  const wIdx = [];
  for (let i = 0; i < daily.times.length; i += 7) {
    const seg = [];
    for (let j = i; j < Math.min(i + 7, daily.times.length); j++) {
      if (Number.isFinite(daily.values[j])) seg.push(daily.values[j]);
    }
    wTimes.push(daily.times[i]);
    wVals.push(seg.length ? seg.reduce((a, b) => a + b, 0) / seg.length : NaN);
    wIdx.push(Math.floor((dayOfYear(daily.times[i]) - 1) / 7));
  }
  // week-of-year climatology (median / min / max across years)
  const byWeek = new Map();
  for (let i = 0; i < wVals.length; i++) {
    if (!Number.isFinite(wVals[i])) continue;
    if (!byWeek.has(wIdx[i])) byWeek.set(wIdx[i], []);
    byWeek.get(wIdx[i]).push(wVals[i]);
  }
  const med = new Map();
  const mn = new Map();
  const mx = new Map();
  for (const [k, arr] of byWeek) {
    med.set(k, median(arr));
    mn.set(k, Math.min(...arr));
    mx.set(k, Math.max(...arr));
  }
  // seasonal deficit SD, then the recursive SMDI accumulation
  const smdi = new Array(wVals.length).fill(NaN);
  let prev = 0;
  let started = false;
  for (let i = 0; i < wVals.length; i++) {
    const sw = wVals[i];
    if (!Number.isFinite(sw)) continue;
    const M = med.get(wIdx[i]);
    let sd;
    if (sw <= M) {
      const d = M - mn.get(wIdx[i]);
      sd = d > 0 ? ((sw - M) / d) * 100 : 0;
    } else {
      const d = mx.get(wIdx[i]) - M;
      sd = d > 0 ? ((sw - M) / d) * 100 : 0;
    }
    smdi[i] = started ? 0.5 * prev + sd / 50 : sd / 50;
    prev = smdi[i];
    started = true;
  }
  return { wTimes, smdi };
}

export default {
  id: "soil_moisture_deficit_index",
  name: "Soil Moisture Deficit Index (SMDI)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: 730,
  description:
    "Weekly drought index: each week's mean moisture is compared with the long-term median, minimum, and maximum for that week of the year, and the resulting deficit is accumulated with a 0.5 memory term. Ranges from −4 (extremely dry) to +4 (extremely wet).",
  context:
    "A weekly drought index on a familiar −4 (severe drought) to +4 (very wet) scale, designed to compare current conditions against the same week in previous years. Works best with several years of data.",
  equations: [
    "\\bar{\\theta}_w = \\operatorname{mean}\\{\\theta_t : t \\in \\text{week } w\\}",
    "\\mathrm{SD}_w = 100\\,\\frac{\\bar{\\theta}_w - M_w}{M_w - L_w} \\quad \\text{if } \\bar{\\theta}_w \\le M_w",
    "\\mathrm{SD}_w = 100\\,\\frac{\\bar{\\theta}_w - M_w}{U_w - M_w} \\quad \\text{if } \\bar{\\theta}_w > M_w",
    "\\mathrm{SMDI}_w = 0.5\\,\\mathrm{SMDI}_{w-1} + \\frac{\\mathrm{SD}_w}{50}",
    "\\mathrm{SMDI}_1 = \\mathrm{SD}_1 / 50",
  ],
  variables: [
    ["\\bar{\\theta}_w", "mean water content of week w (m³/m³)"],
    ["M_w", "long-term median of the weekly means for that week of the year (m³/m³)"],
    ["L_w", "long-term minimum for that week of the year (m³/m³)"],
    ["U_w", "long-term maximum for that week of the year (m³/m³)"],
    ["\\mathrm{SD}_w", "soil moisture deficit or surplus of week w (%)"],
    ["\\mathrm{SMDI}_w", "soil moisture deficit index of week w (−4 to +4)"],
  ],
  reference:
    "Narasimhan, B., & Srinivasan, R. (2005). Development and evaluation of Soil Moisture Deficit Index (SMDI) and Evapotranspiration Deficit Index (ETDI) for agricultural drought monitoring. Agric. For. Meteorol., 133, 69-88. https://doi.org/10.1016/j.agrformet.2005.07.012",
  args: [{ kind: "series", column: "timestamp" }],
  compute(vwc, timestamp) {
    const { wTimes, smdi } = smdiSeries(timestamp, vwc);
    // map weekly SMDI back onto original rows (backward as-of)
    const out = new Array(timestamp.length).fill(NaN);
    let p = 0;
    for (let i = 0; i < timestamp.length; i++) {
      const t = timestamp[i].getTime();
      while (p + 1 < wTimes.length && wTimes[p + 1].getTime() <= t) p++;
      if (wTimes.length && wTimes[p].getTime() <= t) out[i] = smdi[p];
    }
    return out;
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    const neg = result.map((v) => (v < 0 ? v : 0));
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: "#8b5a2b", width: 1.2 }, name: "SMDI",
          hovertemplate: "%{y:.2f}<extra></extra>",
        },
        { x: times, y: neg, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(139,90,43,0.3)", name: "Deficit", hoverinfo: "skip" },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "SMDI" }, range: [-4.2, 4.2] },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: colors.muted, width: 1 } },
        ],
      },
    };
  },
};
