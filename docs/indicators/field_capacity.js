import { quantile, findPeaks, medianGapMs, median } from "../assets/js/utils.js";

/**
 * Field capacity as the median VWC a fixed drainage time after major wetting
 * peaks (peaks in the wettest 5% of the record with prominence ≥ half the
 * record range). A peak is used only if no more than maxRain fell on any day
 * of the drainage window, so the value reflects drainage without new input.
 */
function estimate(times, vwc, precip, drainageDays, maxRain) {
  const fin = vwc.filter(Number.isFinite);
  if (fin.length < 3) return { fc: NaN, peaks: [], targets: [], rejected: [] };
  const range = Math.max(...fin) - Math.min(...fin);
  const peaks = findPeaks(vwc, { height: quantile(vwc, 0.95), prominence: 0.5 * range });
  const medDt = medianGapMs(times);
  if (!peaks.length || !(medDt > 0)) return { fc: NaN, peaks, targets: [], rejected: [] };
  const lag = Math.max(Math.round((drainageDays * 86400000) / medDt), 1);
  const targets = [];
  const rejected = [];
  for (const p of peaks) {
    const i = p + lag;
    if (i >= vwc.length || !Number.isFinite(vwc[i])) continue;
    let dry = true;
    for (let k = p + 1; k <= i; k++) if (precip[k] > maxRain) { dry = false; break; }
    (dry ? targets : rejected).push(i);
  }
  return { fc: targets.length ? median(targets.map((i) => vwc[i])) : NaN, peaks, targets, rejected };
}

export default {
  id: "field_capacity",
  name: "Field Capacity (drained upper limit)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc", "precip"],
  minResolution: "any",
  minDays: "any",
  description:
    "Field estimate of the drained upper limit: the median water content a set drainage time (default 2 days) after major wetting peaks (wettest 5% of the record), once rapid gravitational drainage has largely ceased. Peaks followed by rain during the drainage window are excluded, so each value reflects drainage without new water input.",
  equations: [
    "\\theta_{FC} = \\operatorname{median}_j \\, \\theta(t_j + \\Delta t_d)",
    "\\theta(t_j) \\ge P_{95}(\\theta)",
    "\\operatorname{prom}(t_j) \\ge 0.5\\,(\\theta_{\\max} - \\theta_{\\min})",
    "P_t \\le P_{\\max} \\quad \\text{for all } t_j < t \\le t_j + \\Delta t_d",
  ],
  variables: [
    ["\\theta_{FC}", "estimated field capacity (m³/m³)"],
    ["t_j", "date of the j-th major wetting peak (local maximum of θ)"],
    ["\\Delta t_d", "drainage time after the peak (days)"],
    ["P_{95}(\\theta)", "95th percentile of the record (m³/m³)"],
    ["\\operatorname{prom}(t_j)", "peak prominence: height above the higher of the two surrounding minima (m³/m³)"],
    ["\\theta_{\\max}, \\theta_{\\min}", "record maximum and minimum (m³/m³)"],
    ["P_t", "daily precipitation on day t (mm)"],
    ["P_{\\max}", "rain tolerated per day during the drainage window (mm)"],
  ],
  reference:
    "Veihmeyer, F. J., & Hendrickson, A. H. (1931). The moisture equivalent as a measure of the field capacity of soils. Soil Sci., 32(3), 181-194 ; Ratliff, L. F., Ritchie, J. T., & Cassel, D. K. (1983). Field-measured limits of soil water availability as related to laboratory-measured properties. Soil Sci. Soc. Am. J., 47(4), 770-775. https://doi.org/10.2136/sssaj1983.03615995004700040032x",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "series", column: "precip" },
    { kind: "param", name: "drainageDays", label: "Drainage time Δtd (days)", type: "number", default: 2, min: 0.5, max: 5, step: 0.5 },
    { kind: "param", name: "maxRain", label: "Rain tolerated per day during drainage (mm)", type: "number", default: 0, min: 0, max: 5, step: 0.5 },
  ],
  caption(result, ctx) {
    const { targets, rejected } = estimate(ctx.times, ctx.primary, ctx.data.precip, ctx.params.drainageDays, ctx.params.maxRain);
    const excl = rejected.length ? `; ${rejected.length} excluded for rain during drainage` : "";
    return Number.isFinite(result)
      ? `<strong>Field capacity ≈ ${result.toFixed(3)} m³/m³</strong> (median of ${targets.length} wetting events, ${ctx.params.drainageDays} days after peak${excl}).`
      : `No rain-free drainage periods after major wetting peaks were found${excl}. Try a higher rain tolerance.`;
  },
  compute(vwc, timestamp, precip, drainageDays, maxRain) {
    return estimate(timestamp, vwc, precip, drainageDays, maxRain).fc;
  },
  plot(result, ctx) {
    const { colors, times, primary, params } = ctx;
    const { peaks, targets, rejected } = estimate(times, primary, ctx.data.precip, params.drainageDays, params.maxRain);
    const traces = [
      {
        x: times, y: primary, type: "scattergl", mode: "lines",
        line: { color: colors.input, width: 1 }, name: "VWC",
        hovertemplate: "%{y:.3f}<extra></extra>",
      },
      {
        x: peaks.map((i) => times[i]), y: peaks.map((i) => primary[i]), type: "scatter", mode: "markers",
        marker: { color: colors.accent, size: 7, symbol: "triangle-up" }, name: "Wetting peak",
      },
      {
        x: targets.map((i) => times[i]), y: targets.map((i) => primary[i]), type: "scatter", mode: "markers",
        marker: { color: colors.good, size: 7 }, name: `${params.drainageDays} days after peak`,
      },
    ];
    if (rejected.length) {
      traces.push({
        x: rejected.map((i) => times[i]), y: rejected.map((i) => primary[i]), type: "scatter", mode: "markers",
        marker: { color: colors.muted, size: 8, symbol: "x" }, name: "Excluded (rain during drainage)",
      });
    }
    return {
      traces,
      layout: {
        showlegend: true,
        yaxis: { title: { text: "VWC (m³/m³)" } },
        shapes: Number.isFinite(result)
          ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: result, y1: result, line: { color: colors.good, width: 1.5, dash: "dash" } }]
          : [],
      },
    };
  },
};
