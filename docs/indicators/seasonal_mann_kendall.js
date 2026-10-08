import { seasonalKendall } from "../assets/js/utils.js";

export default {
  id: "seasonal_mann_kendall",
  name: "Seasonal Mann-Kendall Trend + Sen's Slope",
  type: "scalar",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: 1095,
  description:
    "Seasonal Kendall test for a monotonic trend, applied to monthly means with each calendar month compared only with the same month in other years; Sen's slope gives the magnitude in m³/m³ per year. Monthly aggregation and seasonal blocking avoid the serial correlation that invalidates a Mann-Kendall test on daily values.",
  equations: [
    "S = \\sum_{m=1}^{12} \\sum_{i<j} \\operatorname{sgn}\\big(\\bar{\\theta}_{m,j} - \\bar{\\theta}_{m,i}\\big)",
    "\\operatorname{Var}(S) = \\sum_{m=1}^{12} \\frac{n_m(n_m-1)(2n_m+5) - \\sum_g t_g(t_g-1)(2t_g+5)}{18}",
    "Z = \\frac{S - \\operatorname{sgn}(S)}{\\sqrt{\\operatorname{Var}(S)}}",
    "p = 2\\,\\big[1 - \\Phi(|Z|)\\big]",
    "\\beta = \\operatorname{median}\\left\\{ \\frac{\\bar{\\theta}_{m,j} - \\bar{\\theta}_{m,i}}{y_j - y_i} \\right\\}",
  ],
  variables: [
    ["\\bar{\\theta}_{m,j}", "mean water content of calendar month m in year j (m³/m³)"],
    ["n_m", "number of years with data for month m"],
    ["t_g", "number of tied values in tie group g within a month"],
    ["S", "Seasonal Kendall statistic"],
    ["Z", "standardized test statistic"],
    ["\\Phi", "standard normal cumulative distribution function"],
    ["p", "two-sided p-value"],
    ["y_j", "year of observation j"],
    ["\\beta", "Sen's slope: median of all within-month pairwise slopes (m³/m³ per year)"],
  ],
  reference:
    "Hirsch, R. M., Slack, J. R., & Smith, R. A. (1982). Techniques of trend analysis for monthly water quality data. Water Resour. Res., 18(1), 107-121. https://doi.org/10.1029/WR018i001p00107 ; Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. J. Amer. Statist. Assoc., 63(324), 1379-1389. https://doi.org/10.1080/01621459.1968.10480934",
  args: [{ kind: "series", column: "timestamp" }],
  caption(result, ctx) {
    const r = seasonalKendall(ctx.times, ctx.primary);
    const slope = Number.isFinite(r.senSlopePerYear) ? `${r.senSlopePerYear >= 0 ? "+" : ""}${r.senSlopePerYear.toFixed(4)} m³/m³ per year` : "n/a";
    const sig = r.p < 0.05;
    const dir = r.Z > 0 ? "wetter" : "drier";
    const verdict = sig
      ? `a statistically significant trend toward ${dir} soil (p = ${r.p.toFixed(3)})`
      : `no statistically significant trend (p = ${r.p.toFixed(2)})`;
    return `<strong>Z = ${r.Z.toFixed(2)}</strong>, Sen's slope <strong>${slope}</strong>: ${verdict} at the 5% level.`;
  },
  compute(vwc, timestamp) {
    return seasonalKendall(timestamp, vwc).Z;
  },
  plot(result, ctx) {
    const { colors } = ctx;
    const r = seasonalKendall(ctx.times, ctx.primary);
    const t = r.monthly.times;
    const v = r.monthly.values;
    // Sen line through the median point (fractional years on x).
    const yrs = t.map((d) => d.getUTCFullYear() + d.getUTCMonth() / 12);
    const finIdx = v.map((x, i) => (Number.isFinite(x) ? i : -1)).filter((i) => i >= 0);
    const sortedV = finIdx.map((i) => v[i]).sort((a, b) => a - b);
    const sortedY = finIdx.map((i) => yrs[i]).sort((a, b) => a - b);
    const mid = (arr) => (arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2);
    const b = r.senSlopePerYear;
    const a = mid(sortedV) - b * mid(sortedY);
    return {
      traces: [
        {
          x: t, y: v, type: "scatter", mode: "lines+markers",
          line: { color: colors.accent2, width: 1 }, marker: { size: 4 }, name: "Monthly mean VWC",
          hovertemplate: "%{x|%b %Y}: %{y:.3f}<extra></extra>",
        },
        {
          x: t, y: yrs.map((y) => a + b * y), type: "scatter", mode: "lines",
          line: { color: colors.text, width: 1.5, dash: "dash" }, name: "Sen's slope", hoverinfo: "skip",
        },
      ],
      layout: { showlegend: true, yaxis: { title: { text: "Monthly mean VWC (m³/m³)" } } },
    };
  },
};
