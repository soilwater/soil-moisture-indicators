import { resolveLimits } from "../assets/js/utils.js";

export default {
  id: "fraction_available_water",
  name: "Fraction of Available Water (FAW)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Soil moisture scaled between the wilting point (0) and field capacity (1), also called plant-available water fraction or relative extractable water (REW). Values above 1 indicate drainage after wetting. Enter lab or field values for θFC and θWP, or leave 0 to estimate them as the record's 95th and 5th percentiles.",
  context:
    "Rescales a sensor reading into 'how much of the water plants can use is left'. It is the most direct link between soil moisture and crop water stress and is easy to explain to growers. Crops typically begin to experience stress once FAW drops below 1 − p (about 0.5 for many crops, per FAO-56).",
  equations: [
    "\\mathrm{FAW}_t = \\frac{\\theta_t - \\theta_{WP}}{\\theta_{FC} - \\theta_{WP}}",
    "\\text{water stress when } \\mathrm{FAW}_t < 1 - p",
  ],
  variables: [
    ["\\mathrm{FAW}_t", "fraction of available water on day t (–); > 1 means wetter than field capacity"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\theta_{FC}", "field capacity (m³/m³); user value, or the record's 95th percentile if left at 0"],
    ["\\theta_{WP}", "wilting point (m³/m³); user value, or the record's 5th percentile if left at 0"],
    ["p", "FAO-56 depletion fraction: share of available water that can be used before stress begins"],
  ],
  reference:
    "Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). Crop evapotranspiration: Guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56. FAO, Rome.",
  args: [
    { kind: "param", name: "fc", label: "Field capacity θFC (m³/m³, 0 = estimate)", type: "number", default: 0, min: 0, max: 0.6, step: 0.005 },
    { kind: "param", name: "wp", label: "Wilting point θWP (m³/m³, 0 = estimate)", type: "number", default: 0, min: 0, max: 0.4, step: 0.005 },
    { kind: "param", name: "p", label: "Depletion fraction p (FAO-56)", type: "number", default: 0.5, min: 0.1, max: 0.9, step: 0.05 },
  ],
  caption(result, ctx) {
    const { fc, wp, fcAuto, wpAuto } = resolveLimits(ctx.primary, ctx.params.fc, ctx.params.wp);
    const thr = 1 - ctx.params.p;
    const fin = result.filter(Number.isFinite);
    const stressed = ((100 * fin.filter((x) => x < thr).length) / fin.length).toFixed(1);
    return `θFC = ${fc.toFixed(3)}${fcAuto ? " (estimated)" : ""}, θWP = ${wp.toFixed(3)}${wpAuto ? " (estimated)" : ""}. <strong>${stressed}%</strong> of observations below the stress threshold (FAW < ${thr.toFixed(2)}).`;
  },
  compute(vwc, fc, wp) {
    const lim = resolveLimits(vwc, fc, wp);
    const denom = lim.fc - lim.wp;
    if (!(denom > 0)) return vwc.map(() => NaN);
    return vwc.map((v) => (v - lim.wp) / denom);
  },
  plot(result, ctx) {
    const { colors, times, params } = ctx;
    const thr = 1 - params.p;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.good, width: 1.3 }, name: "FAW",
          hovertemplate: "%{y:.2f}<extra></extra>",
        },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "FAW (–)" } },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: colors.muted, width: 1, dash: "dot" } },
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: colors.muted, width: 1, dash: "dot" } },
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: thr, y1: thr, line: { color: colors.warn, width: 1, dash: "dash" } },
        ],
        annotations: [
          { x: 1, xref: "paper", y: 1, yref: "y", xanchor: "right", yanchor: "bottom", text: "Field capacity", showarrow: false, font: { size: 10, color: colors.muted } },
          { x: 1, xref: "paper", y: 0, yref: "y", xanchor: "right", yanchor: "bottom", text: "Wilting point", showarrow: false, font: { size: 10, color: colors.muted } },
          { x: 0, xref: "paper", y: thr, yref: "y", xanchor: "left", yanchor: "bottom", text: `Stress threshold (1 − p = ${thr.toFixed(2)})`, showarrow: false, font: { size: 11, color: colors.warn } },
        ],
      },
    };
  },
};
