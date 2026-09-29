export default {
  id: "relative_saturation",
  name: "Relative Saturation (%)",
  type: "timeseries",
  primary: "vwc",
  requires: ["vwc"],
  minResolution: "any",
  minDays: "any",
  description:
    "Soil moisture as a percentage of the saturated water content. With a porosity value this is the degree of saturation θ/φ; left at 0, the maximum VWC observed in the record stands in for saturation.",
  context:
    "Expresses moisture as 'how full the soil pores are' from 0 to 100%, an intuitive framing for non-technical audiences. Enter porosity (e.g. from bulk density) for a true degree of saturation; the record-maximum fallback only approximates it if the record includes saturated conditions.",
  equations: [
    "S_t = 100\\,\\frac{\\theta_t}{\\phi}",
    "\\phi = \\max_t \\theta_t \\quad \\text{if porosity is not provided}",
  ],
  variables: [
    ["S_t", "relative saturation on day t (%)"],
    ["\\theta_t", "daily mean volumetric water content on day t (m³/m³)"],
    ["\\phi", "porosity (m³/m³)"],
  ],
  reference: "N/A",
  args: [
    { kind: "param", name: "porosity", label: "Porosity φ (m³/m³, 0 = record max)", type: "number", default: 0, min: 0, max: 0.7, step: 0.01 },
  ],
  caption(result, ctx) {
    const phi = ctx.params.porosity > 0 ? ctx.params.porosity : Math.max(...ctx.primary.filter(Number.isFinite));
    return `Saturation reference φ = ${phi.toFixed(3)} m³/m³${ctx.params.porosity > 0 ? " (porosity)" : " (record maximum)"}.`;
  },
  compute(vwc, porosity) {
    const phi = porosity > 0 ? porosity : Math.max(...vwc.filter(Number.isFinite));
    if (!(phi > 0)) return vwc.map(() => NaN);
    return vwc.map((v) => (100 * v) / phi);
  },
  plot(result, ctx) {
    const { colors, times } = ctx;
    return {
      traces: [
        {
          x: times, y: result, type: "scattergl", mode: "lines",
          line: { color: colors.accent2, width: 1.2 }, name: "Relative saturation",
          hovertemplate: "%{y:.1f}%<extra></extra>",
        },
      ],
      layout: { showlegend: false, yaxis: { title: { text: "Relative saturation (%)" } } },
    };
  },
};
