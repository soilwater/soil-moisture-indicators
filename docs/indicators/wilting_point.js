import { quantile, mean } from "../assets/js/utils.js";

/** Robust minimum: mean of the observations at or below a low percentile. */
function estimate(vwc, pct) {
  const q = quantile(vwc, pct / 100);
  const tail = vwc.filter((v) => Number.isFinite(v) && v <= q);
  return tail.length ? mean(tail) : NaN;
}

export default {
  id: "wilting_point",
  name: "Wilting Point (field lower limit)",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Field estimate of the lower limit of plant-available water: a robust minimum of the record (mean of observations at or below the p-th percentile). It approaches the lower limit only if the record includes severe drying under active roots; in humid climates or short records it overestimates it.",
  equations: [
    "\\theta_{WP} = \\operatorname{mean}\\{\\theta_t : \\theta_t \\le P_p(\\theta)\\}",
  ],
  variables: [
    ["\\theta_{WP}", "estimated wilting point (field lower limit) (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["P_p(\\theta)", "p-th percentile of the record (m³/m³)"],
  ],
  reference:
    "Ratliff, L. F., Ritchie, J. T., & Cassel, D. K. (1983). Field-measured limits of soil water availability as related to laboratory-measured properties. Soil Sci. Soc. Am. J., 47(4), 770-775. https://doi.org/10.2136/sssaj1983.03615995004700040032x",
  args: [
    { kind: "param", name: "wpPercentile", label: "Dry-end percentile p", type: "int", default: 2, min: 1, max: 20, step: 1 },
  ],
  caption(result) {
    return Number.isFinite(result)
      ? `<strong>Wilting point ≈ ${result.toFixed(3)} m³/m³</strong>: the estimated lower limit of water plants can extract.`
      : "Not enough data to estimate the lower limit.";
  },
  compute(vwc, wpPercentile) {
    return estimate(vwc, wpPercentile);
  },
  plot(result, ctx) {
    const { colors, times, primary } = ctx;
    return {
      traces: [
        {
          x: times, y: primary, type: "scattergl", mode: "lines",
          line: { color: colors.input, width: 1 }, name: "VWC",
          hovertemplate: "%{y:.3f}<extra></extra>",
        },
      ],
      layout: {
        showlegend: false,
        yaxis: { title: { text: "VWC (m³/m³)" } },
        shapes: Number.isFinite(result)
          ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: result, y1: result, line: { color: "#d97706", width: 1.5, dash: "dash" } }]
          : [],
      },
    };
  },
};
