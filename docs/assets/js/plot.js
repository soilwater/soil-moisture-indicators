/**
 * plot.js — Plotly theming and rendering helpers.
 *
 * Indicators may define an optional `plot(result, ctx)` that returns
 * { traces, layout } (a partial layout merged over the themed base). When an
 * indicator has no `plot`, we render a sensible default based on its `type`.
 *
 * Plotly is loaded globally from a CDN in the HTML (window.Plotly).
 */

/** Read theme colors from CSS custom properties so charts match the page. */
export function getColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    bg: get("--chart-bg", "#ffffff"),
    text: get("--text", "#1a1a1a"),
    muted: get("--muted", "#8a8f98"),
    grid: get("--grid", "#e6e8eb"),
    accent: get("--accent", "#2563eb"),
    accent2: get("--accent-2", "#0891b2"),
    warn: get("--warn", "#dc2626"),
    good: get("--good", "#16a34a"),
    input: get("--series-input", "#6b7280"),
  };
}

/** Distinct palette for categorical states (baseline labels use gray). */
const CATEGORY_PALETTE = [
  "#dc2626", "#ea580c", "#d97706", "#7c3aed", "#0891b2", "#16a34a", "#db2777",
];
const BASELINE_LABELS = new Set([
  "OK", "No Onset", "Unfrozen", "No drought", "No Drought",
]);

/** Base themed layout; caller overrides pieces via a partial layout. */
export function baseLayout(colors, { yTitle = "" } = {}) {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: colors.text, family: "Inter, system-ui, sans-serif", size: 13 },
    margin: { l: 56, r: 16, t: 10, b: 40 },
    xaxis: {
      gridcolor: colors.grid,
      zerolinecolor: colors.grid,
      linecolor: colors.grid,
      tickcolor: colors.grid,
      automargin: true,
    },
    yaxis: {
      title: { text: yTitle, font: { size: 12 } },
      gridcolor: colors.grid,
      zerolinecolor: colors.grid,
      linecolor: colors.grid,
      tickcolor: colors.grid,
      automargin: true,
    },
    legend: { orientation: "h", y: -0.18, font: { size: 11 } },
    hovermode: "x unified",
    showlegend: false,
  };
}

const CONFIG = { responsive: true, displaylogo: false, displayModeBar: "hover" };

/** Merge + render into a div. Returns the Plotly.react promise. */
export function react(divId, traces, layoutPartial) {
  const colors = getColors();
  const layout = { ...baseLayout(colors), ...layoutPartial };
  // deep-merge axis overrides so callers can tweak just a title
  layout.xaxis = { ...baseLayout(colors).xaxis, ...(layoutPartial.xaxis || {}) };
  layout.yaxis = { ...baseLayout(colors).yaxis, ...(layoutPartial.yaxis || {}) };
  return window.Plotly.react(divId, traces, layout, CONFIG);
}

/**
 * Link the x-axis of two charts so zoom/pan/reset on one mirrors to the other.
 * Only links when both x-axes are time ("date") axes, so charts with a
 * different x meaning (e.g. autocorrelation lag) are left independent.
 */
export function linkXAxes(idA, idB) {
  const a = document.getElementById(idA);
  const b = document.getElementById(idB);
  if (!a || !b || !a._fullLayout || !b._fullLayout) return;
  // Always clear listeners from a previous render first, so a link left over
  // from a time-based indicator doesn't leak onto a non-time one.
  if (a.removeAllListeners) a.removeAllListeners("plotly_relayout");
  if (b.removeAllListeners) b.removeAllListeners("plotly_relayout");
  if (a._fullLayout.xaxis.type !== "date" || b._fullLayout.xaxis.type !== "date") return;

  let syncing = false;
  const linker = (dst) => (ev) => {
    if (syncing || !ev) return;
    let update = null;
    if (ev["xaxis.range[0]"] !== undefined && ev["xaxis.range[1]"] !== undefined) {
      update = { "xaxis.range": [ev["xaxis.range[0]"], ev["xaxis.range[1]"]] };
    } else if (ev["xaxis.autorange"]) {
      update = { "xaxis.autorange": true };
    }
    if (!update) return;
    syncing = true;
    window.Plotly.relayout(dst, update).finally(() => { syncing = false; });
  };
  a.on("plotly_relayout", linker(b));
  b.on("plotly_relayout", linker(a));
}

/** Plot the primary input series over time. */
export function renderPrimary(divId, ctx) {
  const colors = getColors();
  const traces = [
    {
      x: ctx.times,
      y: ctx.primary,
      type: "scattergl",
      mode: "lines",
      line: { color: colors.input, width: 1.2 },
      name: ctx.primaryName,
      hovertemplate: `%{y:.4g}<extra>${ctx.primaryName}</extra>`,
    },
  ];
  return react(divId, traces, { yaxis: { title: { text: ctx.primaryLabel || ctx.primaryName } } });
}

/** Render an indicator result (custom plot if provided, else default). */
export function renderResult(divId, indicator, result, ctx) {
  const colors = getColors();
  if (typeof indicator.plot === "function") {
    const spec = indicator.plot(result, { ...ctx, colors }) || {};
    return react(divId, spec.traces || [], spec.layout || {});
  }
  if (indicator.type === "timeseries") {
    return react(
      divId,
      [
        {
          x: ctx.times,
          y: result,
          type: "scattergl",
          mode: "lines",
          line: { color: colors.accent, width: 1.4 },
          name: indicator.name,
          hovertemplate: `%{y:.4g}<extra></extra>`,
        },
      ],
      { yaxis: { title: { text: indicator.name } } }
    );
  } else if (indicator.type === "categorical") {
    return react(divId, categoricalTraces(result, ctx, colors), {
      yaxis: { title: { text: ctx.primaryName } },
    });
  } else {
    // scalar with no custom plot: show the number
    const val = Number.isFinite(result) ? result.toFixed(3) : String(result);
    return react(divId, [], {
      annotations: [
        {
          text: val,
          showarrow: false,
          font: { size: 42, color: colors.accent },
          x: 0.5,
          y: 0.5,
          xref: "paper",
          yref: "paper",
        },
      ],
      xaxis: { visible: false },
      yaxis: { visible: false },
    });
  }
}

/**
 * Default categorical rendering: the primary series as a gray line, with
 * flagged states overlaid as colored markers (one legend entry per state).
 */
export function categoricalTraces(labels, ctx, colors) {
  const traces = [
    {
      x: ctx.times,
      y: ctx.primary,
      type: "scattergl",
      mode: "lines",
      line: { color: colors.input, width: 1 },
      name: ctx.primaryName,
      hoverinfo: "skip",
    },
  ];
  const categories = [...new Set(labels)];
  let ci = 0;
  for (const cat of categories) {
    if (BASELINE_LABELS.has(cat)) continue; // don't clutter with the "all clear" state
    const xs = [];
    const ys = [];
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === cat) {
        xs.push(ctx.times[i]);
        ys.push(ctx.primary[i]);
      }
    }
    traces.push({
      x: xs,
      y: ys,
      type: "scattergl",
      mode: "markers",
      marker: { color: CATEGORY_PALETTE[ci % CATEGORY_PALETTE.length], size: 5 },
      name: cat,
      hovertemplate: `%{x}<br>${cat}<extra></extra>`,
    });
    ci++;
  }
  return traces;
}
