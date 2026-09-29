export default {
  id: "rate_of_change",
  name: "Rate of Change (dθ/dt)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "First time-derivative of soil moisture (change per day). Positive spikes mark wetting; sustained negatives mark drying — the raw signal underlying flash-drought and infiltration analysis.",
  context:
    "The raw speed of wetting and drying. Sharp positive spikes mark infiltration after rain; sustained negatives mark drying — the building block behind flash-drought and infiltration analysis.",
  equations: [
    "\\dot{\\theta}_t = \\frac{\\theta_t - \\theta_{t-1}}{\\Delta t}",
  ],
  variables: [
    ["\\dot{\\theta}_t", "rate of change on day t (m³/m³ per day)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\Delta t", "time between consecutive observations (1 day)"],
  ],
  reference: "N/A",
  args: [{ kind: "series", column: "timestamp" }],
  compute(vwc, timestamp) {
    const out = new Array(vwc.length).fill(NaN);
    for (let i = 1; i < vwc.length; i++) {
      const dtDays = (timestamp[i].getTime() - timestamp[i - 1].getTime()) / 86400000;
      if (dtDays > 0) out[i] = (vwc[i] - vwc[i - 1]) / dtDays;
    }
    return out;
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    const pos = result.map((v) => (v >= 0 ? v : 0));
    const neg = result.map((v) => (v < 0 ? v : 0));
    return {
      traces: [
        { x: times, y: pos, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(37,99,235,0.35)", name: "Wetting", hoverinfo: "skip" },
        { x: times, y: neg, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(220,38,38,0.35)", name: "Drying", hoverinfo: "skip" },
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.text, width: 0.8 }, name: "dθ/dt",
          hovertemplate: "%{y:.4f}/day<extra></extra>",
        },
      ],
      layout: { showlegend: true, yaxis: { title: { text: "dθ/dt (per day)" } } },
    };
  },
};
