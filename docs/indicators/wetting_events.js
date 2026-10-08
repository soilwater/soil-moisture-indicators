import { resampleDaily } from "../assets/js/utils.js";

export default {
  id: "wetting_events",
  name: "Wetting Events (rainfall response)",
  type: "categorical",
  primary: "vwc",
  requires: ["vwc", "precip"],
  minResolution: "any",
  minDays: "any",
  description:
    "Days on which daily-mean water content rose by at least Δθmin over the last w days while at least Pmin of rain fell in the same window; consecutive flagged days count as one event. Weak or absent responses to large rainfall can indicate interception, runoff, or a sensor below the wetting front.",
  equations: [
    "\\Delta\\theta_t = \\theta_t - \\theta_{t-w}",
    "P^{(w)}_t = \\sum_{s=t-w+1}^{t} P_s",
    "\\text{wetting}_t = \\big(\\Delta\\theta_t \\ge \\Delta\\theta_{\\min}\\big) \\wedge \\big(P^{(w)}_t \\ge P_{\\min}\\big)",
  ],
  variables: [
    ["\\Delta\\theta_t", "rise in water content over the last w days (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["P^{(w)}_t", "rain over the last w days (mm)"],
    ["P_s", "daily precipitation on day s (mm)"],
    ["w", "window length (days)"],
    ["\\Delta\\theta_{\\min}", "minimum rise that counts as wetting (m³/m³)"],
    ["P_{\\min}", "minimum rain that counts as a rain event (mm)"],
  ],
  reference: "N/A",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "series", column: "precip" },
    { kind: "param", name: "riseDays", label: "Window w (days)", type: "int", default: 3, min: 1, max: 10, step: 1 },
    { kind: "param", name: "minRise", label: "Minimum rise Δθmin (m³/m³)", type: "number", default: 0.03, min: 0.005, max: 0.15, step: 0.005 },
    { kind: "param", name: "minPrecip", label: "Minimum rain Pmin (mm)", type: "number", default: 5, min: 0, max: 50, step: 1 },
  ],
  caption(result) {
    let events = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] === "Wetting Event" && (i === 0 || result[i - 1] !== "Wetting Event")) events++;
    }
    return `<strong>${events} wetting events</strong> detected.`;
  },
  compute(vwc, timestamp, precip, riseDays, minRise, minPrecip) {
    const dv = resampleDaily(timestamp, vwc, "mean");
    const dp = resampleDaily(timestamp, precip, "sum");
    const dayLabel = new Map();
    for (let i = 0; i < dv.times.length; i++) {
      let label = "No";
      if (i >= riseDays) {
        const rise = dv.values[i] - dv.values[i - riseDays];
        let psum = 0;
        for (let j = i - riseDays + 1; j <= i; j++) psum += Number.isFinite(dp.values[j]) ? dp.values[j] : 0;
        if (Number.isFinite(rise) && rise >= minRise && psum >= minPrecip) label = "Wetting Event";
      }
      dayLabel.set(dv.times[i].getTime(), label);
    }
    return timestamp.map((d) => {
      const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return dayLabel.get(key) || "No";
    });
  },
};
