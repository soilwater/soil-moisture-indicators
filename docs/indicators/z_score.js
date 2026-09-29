import { mean, std } from "../assets/js/utils.js";

export default {
  id: "z_score",
  name: "Z-Score",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Standardizes each observation against the whole record's mean and standard deviation (no seasonal adjustment).",
  context:
    "The simplest 'how unusual is today?' screen — it flags values far from the record's average. Quick to read, but unlike SSI it ignores season, so treat it as a first look rather than a drought call.",
  equations: [
    "z_t = \\frac{\\theta_t - \\bar{\\theta}}{s_\\theta}",
  ],
  variables: [
    ["z_t", "z-score on day t (standard deviations)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\bar{\\theta}", "mean of the whole record (m³/m³)"],
    ["s_\\theta", "sample standard deviation of the whole record (m³/m³)"],
  ],
  reference: "N/A",
  args: [],
  compute(vwc) {
    const m = mean(vwc);
    const s = std(vwc, 1);
    return vwc.map((v) => (v - m) / s);
  },
};
