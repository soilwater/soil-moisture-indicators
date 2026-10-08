import { resampleDaily, resamplePentadMean, dayOfYear, searchsortedRight } from "../assets/js/utils.js";

/**
 * Pentad means with seasonal percentiles: each pentad is ranked (Gringorten)
 * against all pentads within ±2 pentads of the same time of year, across all
 * years.
 */
function pentadPercentiles(times, vwc) {
  const daily = resampleDaily(times, vwc, "mean");
  const pent = resamplePentadMean(daily.times, daily.values);
  const t = [];
  const v = [];
  const idx = [];
  pent.values.forEach((x, i) => {
    if (Number.isFinite(x)) {
      t.push(pent.times[i]);
      v.push(x);
      idx.push(Math.floor((dayOfYear(pent.times[i]) - 1) / 5)); // 0..73
    }
  });
  const pct = v.map((x, i) => {
    const pool = [];
    v.forEach((y, j) => {
      const d = Math.abs(idx[j] - idx[i]);
      if (Math.min(d, 74 - d) <= 2) pool.push(y);
    });
    pool.sort((a, b) => a - b);
    return (100 * (searchsortedRight(pool, x) - 0.44)) / (pool.length + 0.12);
  });
  return { t, pct };
}

export default {
  id: "flash_drought_onset",
  name: "Flash Drought Onset (SMPD)",
  type: "categorical",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "daily",
  minDays: 730,
  description:
    "Soil Moisture Percentile Drop (SMPD) method: flags a pentad (5-day mean) whose seasonal percentile falls below the lower threshold after being at or above the upper threshold within the preceding m pentads, capturing rapid intensification that monthly indices miss. Frozen soil lowers the measured liquid water content and can produce spurious winter onsets.",
  equations: [
    "\\bar{\\theta}_j = \\operatorname{mean}\\{\\theta_t : t \\in \\text{pentad } j\\}",
    "P_j = 100\\,\\dfrac{i_j - 0.44}{n_j + 0.12}",
    "\\text{onset}_j = \\big(P_j < P_{\\text{low}}\\big) \\wedge \\big(\\max_{j-m \\le i < j} P_i \\ge P_{\\text{high}}\\big)",
  ],
  variables: [
    ["\\bar{\\theta}_j", "mean water content of pentad (5-day period) j (m³/m³)"],
    ["P_j", "seasonal percentile of pentad j (0–100)"],
    ["i_j", "number of pentads in the seasonal pool with mean ≤ θ̄_j"],
    ["n_j", "number of pentads in the seasonal pool: pentads within ±2 pentads of the same time of year, in any year"],
    ["P_{\\text{high}}", "upper percentile the soil must drop from"],
    ["P_{\\text{low}}", "lower percentile the soil must drop below"],
    ["m", "maximum number of pentads allowed for the drop"],
  ],
  reference:
    "Ford, T. W., & Labosier, C. F. (2017). Meteorological conditions associated with the onset of flash drought in the eastern United States. Agric. For. Meteorol., 247, 414-423. https://doi.org/10.1016/j.agrformet.2017.08.031",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "upper", label: "Upper percentile P_high", type: "int", default: 40, min: 25, max: 60, step: 1 },
    { kind: "param", name: "lower", label: "Lower percentile P_low", type: "int", default: 20, min: 5, max: 30, step: 1 },
    { kind: "param", name: "maxPentads", label: "Window m (pentads)", type: "int", default: 4, min: 1, max: 8, step: 1 },
  ],
  caption(result) {
    let events = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] === "Flash Drought Onset" && (i === 0 || result[i - 1] !== "Flash Drought Onset")) events++;
    }
    return `<strong>${events} flash-drought onset${events === 1 ? "" : "s"}</strong> detected.`;
  },
  compute(vwc, timestamp, upper, lower, maxPentads) {
    const { t, pct } = pentadPercentiles(timestamp, vwc);
    const onset = pct.map((p, j) => {
      if (!(p < lower)) return false;
      for (let i = Math.max(0, j - maxPentads); i < j; i++) if (pct[i] >= upper) return true;
      return false;
    });
    // Label every observation that falls inside an onset pentad.
    const out = new Array(timestamp.length).fill("No Onset");
    let k = 0;
    for (let r = 0; r < timestamp.length; r++) {
      const tr = timestamp[r].getTime();
      while (k + 1 < t.length && t[k + 1].getTime() <= tr) k++;
      if (t.length && t[k].getTime() <= tr && tr < t[k].getTime() + 5 * 86400000 && onset[k]) {
        out[r] = "Flash Drought Onset";
      }
    }
    return out;
  },
};
