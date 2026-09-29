import { rollingMeanTime } from "../assets/js/utils.js";

export default {
  id: "moving_average",
  name: "Moving Average",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Trailing (backward-looking) mean of soil moisture over the preceding Δ days of calendar time. Because it only uses past data it lags the raw series by roughly half the window.",
  context:
    "Smooths out sensor noise and short blips so the real seasonal pattern is easy to see and present. Useful for presenting a cleaner curve to stakeholders; use it for display rather than for statistics.",
  equations: [
    "\\bar{\\theta}_t = \\frac{1}{|W_t|} \\sum_{s \\in W_t} \\theta_s",
    "W_t = \\{ s : t - \\Delta < s \\le t \\}",
  ],
  variables: [
    ["\\bar{\\theta}_t", "moving average on day t (m³/m³)"],
    ["\\theta_s", "daily mean volumetric water content on day s (m³/m³)"],
    ["W_t", "days in the trailing window ending on day t"],
    ["|W_t|", "number of days with data in the window"],
    ["\\Delta", "window length (days)"],
  ],
  reference: "N/A",
  args: [
    { kind: "series", column: "timestamp" },
    { kind: "param", name: "windowDays", label: "Window Δ (days)", type: "int", default: 7, min: 1, max: 90, step: 1 },
  ],
  compute(vwc, timestamp, windowDays) {
    return rollingMeanTime(timestamp, vwc, windowDays);
  },
  plot(result, ctx) {
    const { colors, times, primary, params } = ctx;
    return {
      traces: [
        {
          x: times, y: primary, type: "scattergl", mode: "lines",
          line: { color: colors.muted, width: 0.8 }, name: "Raw VWC",
          hovertemplate: "%{y:.3f}<extra>Raw</extra>",
        },
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent, width: 1.8 }, name: `${params.windowDays}-day mean`,
          hovertemplate: "%{y:.3f}<extra>Mean</extra>",
        },
      ],
      layout: { showlegend: true, yaxis: { title: { text: "VWC (m³/m³)" } } },
    };
  },
};
