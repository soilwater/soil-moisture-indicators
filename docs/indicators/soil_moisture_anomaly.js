import { seasonalClimatology } from "../assets/js/utils.js";

export default {
  id: "soil_moisture_anomaly",
  name: "Soil Moisture Anomaly",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "daily",
  minDays: 730,
  description:
    "Departure of water content from its seasonal norm, defined as the median of all observations within ±w days of the same calendar day across all years. Unlike percentile-based indices, the anomaly retains physical units (m³/m³).",
  equations: [
    "a_t = \\theta_t - \\tilde{\\theta}_{d(t)}",
    "\\tilde{\\theta}_{d} = \\operatorname{median}\\{\\theta_s : |d(s) - d| \\le w\\}",
  ],
  variables: [
    ["a_t", "soil moisture anomaly on day t (m³/m³)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\tilde{\\theta}_{d}", "seasonal median for day of year d, pooled across all years (m³/m³)"],
    ["d(t)", "day of year of day t (1–366, treated as circular)"],
    ["w", "half-width of the seasonal window (days)"],
  ],
  reference:
    "Patrignani, A., Knapp, M., Redmond, C., & Santos, E. (2020). Technical overview of the Kansas Mesonet. J. Atmos. Oceanic Technol., 37(12), 2167-2183. https://doi.org/10.1175/JTECH-D-19-0214.1",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "windowDays", label: "Seasonal window w (± days)", type: "int", default: 15, min: 3, max: 45, step: 1 },
  ],
  compute(vwc, timestamp, windowDays) {
    const clim = seasonalClimatology(vwc, timestamp, windowDays, "median");
    return vwc.map((v, i) => v - clim[i]);
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    const pos = result.map((v) => (v >= 0 ? v : 0));
    const neg = result.map((v) => (v < 0 ? v : 0));
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.text, width: 1 }, name: "Anomaly",
          hovertemplate: "%{y:.4f}<extra></extra>",
        },
        { x: times, y: pos, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(37,99,235,0.35)", name: "Wetter than usual", hoverinfo: "skip" },
        { x: times, y: neg, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(220,38,38,0.35)", name: "Drier than usual", hoverinfo: "skip" },
      ],
      layout: { showlegend: true, yaxis: { title: { text: "Anomaly (m³/m³)" } } },
    };
  },
};
