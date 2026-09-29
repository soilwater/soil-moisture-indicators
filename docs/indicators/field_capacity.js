import { quantile, findPeaks, medianGapMs, median } from "../assets/js/utils.js";

/**
 * Field capacity as the median VWC a fixed drainage time after major wetting
 * peaks (peaks in the wettest 5% of the record with prominence ≥ half the
 * record range).
 */
function estimate(times, vwc, drainageDays) {
  const fin = vwc.filter(Number.isFinite);
  if (fin.length < 3) return { fc: NaN, peaks: [], targets: [] };
  const range = Math.max(...fin) - Math.min(...fin);
  const peaks = findPeaks(vwc, { height: quantile(vwc, 0.95), prominence: 0.5 * range });
  const medDt = medianGapMs(times);
  if (!peaks.length || !(medDt > 0)) return { fc: NaN, peaks, targets: [] };
  const lag = Math.max(Math.round((drainageDays * 86400000) / medDt), 1);
  const targets = peaks.map((p) => p + lag).filter((i) => i < vwc.length && Number.isFinite(vwc[i]));
  return { fc: targets.length ? median(targets.map((i) => vwc[i])) : NaN, peaks, targets };
}

export default {
  id: "field_capacity",
  name: "Field Capacity (drained upper limit)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Field-estimated field capacity: the median soil moisture a set drainage time (default 2 days) after major wetting peaks, i.e. after rapid gravitational drainage has largely ceased. Peaks are taken from the wettest 5% of the record.",
  context:
    "The moisture the soil holds after excess water drains, the upper bound of plant-available water and a key reference for irrigation scheduling. Estimating it from your own record avoids lab measurements, but it is only as good as the wetting events captured; rain during the drainage window biases it high.",
  equations: [
    "\\theta_{FC} = \\operatorname{median}_j \\, \\theta(t_j + \\Delta t_d)",
    "\\theta(t_j) \\ge P_{95}(\\theta)",
    "\\operatorname{prom}(t_j) \\ge 0.5\\,(\\theta_{\\max} - \\theta_{\\min})",
  ],
  variables: [
    ["\\theta_{FC}", "estimated field capacity (m³/m³)"],
    ["t_j", "date of the j-th major wetting peak (local maximum of θ)"],
    ["\\Delta t_d", "drainage time after the peak (days)"],
    ["P_{95}(\\theta)", "95th percentile of the record (m³/m³)"],
    ["\\operatorname{prom}(t_j)", "peak prominence: height above the higher of the two surrounding minima (m³/m³)"],
    ["\\theta_{\\max}, \\theta_{\\min}", "record maximum and minimum (m³/m³)"],
  ],
  reference:
    "Veihmeyer, F. J., & Hendrickson, A. H. (1931). The moisture equivalent as a measure of the field capacity of soils. Soil Sci., 32(3), 181-194 ; Ratliff, L. F., Ritchie, J. T., & Cassel, D. K. (1983). Field-measured limits of soil water availability as related to laboratory-measured properties. Soil Sci. Soc. Am. J., 47(4), 770-775. https://doi.org/10.2136/sssaj1983.03615995004700040032x",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "drainageDays", label: "Drainage time Δtd (days)", type: "number", default: 2, min: 0.5, max: 5, step: 0.5 },
  ],
  caption(result, ctx) {
    const { targets } = estimate(ctx.times, ctx.primary, ctx.params.drainageDays);
    return Number.isFinite(result)
      ? `<strong>Field capacity ≈ ${result.toFixed(3)} m³/m³</strong> (median of ${targets.length} wetting events, ${ctx.params.drainageDays} days after peak).`
      : "No major wetting peaks were found to estimate field capacity.";
  },
  compute(vwc, timestamp, drainageDays) {
    return estimate(timestamp, vwc, drainageDays).fc;
  },
  plot(result, ctx) {
    const { colors, times, primary, params } = ctx;
    const { peaks, targets } = estimate(times, primary, params.drainageDays);
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
