/**
 * app.js — dashboard controller.
 *
 * Every record is aggregated to daily values on load (VWC mean, precipitation
 * total), so all indicators operate on the same daily time step. Each
 * indicator is called as
 *   compute(primarySeries, ...seriesThenParams)
 * with the argument order declared in its `args` list.
 */
import { indicatorsByName, COLUMN_LABELS } from "./registry.js";
import { loadCsv, parseCsv, toDaily } from "./csv.js";
import * as plot from "./plot.js";
import { spanDays, lengthSufficient } from "./utils.js";

const DATASETS = {
  "Stillwater, OK (USCRN)": "datasets/OK_Stillwater_5_WNW.csv",
  "Batesville, AR (USCRN)": "datasets/AR_Batesville_8_WNW.csv",
  "Gadsden, AL (USCRN)": "datasets/AL_Gadsden_19_N.csv",
};

const state = {
  data: null,
  indicator: null,
  params: {},
  profiles: {}, // {label: {span, columns:Set}}
};

const el = {};
const pythonCache = new Map();

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- data ----------------------------------------------------------------

async function computeProfiles() {
  for (const [label, url] of Object.entries(DATASETS)) {
    try {
      const d = toDaily(await loadCsv(url, label));
      state.profiles[label] = { span: spanDays(d.timestamp), columns: d.columns };
    } catch (e) { /* ignore a missing dataset */ }
  }
}

async function loadDataset(label) {
  state.data = toDaily(await loadCsv(DATASETS[label], label));
  render();
}

function loadUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state.data = toDaily(parseCsv(reader.result, file.name));
      render();
    } catch (e) {
      showError(`Could not read “${file.name}”: ${e.message}`);
    }
  };
  reader.readAsText(file);
}

// --- indicator + params --------------------------------------------------

function selectIndicator(id) {
  const all = indicatorsByName();
  state.indicator = all.find((i) => i.id === id) || all[0];
  state.params = {};
  for (const a of state.indicator.args) {
    if (a.kind === "param") state.params[a.name] = a.default;
  }
  buildParamControls();
  renderMethod(state.indicator);
  render();
}

function buildParamControls() {
  el.params.innerHTML = "";
  const paramArgs = state.indicator.args.filter((a) => a.kind === "param");
  if (!paramArgs.length) {
    el.params.innerHTML = `<p class="muted small">No parameters for this indicator.</p>`;
    return;
  }
  for (const a of paramArgs) {
    const wrap = document.createElement("div");
    wrap.className = "param";
    const id = `param-${a.name}`;
    wrap.innerHTML = `
      <label for="${id}">${a.label}</label>
      <div class="param-row">
        <input type="range" id="${id}-range" min="${a.min}" max="${a.max}" step="${a.step}" value="${a.default}">
        <input type="number" id="${id}" min="${a.min}" max="${a.max}" step="${a.step}" value="${a.default}">
      </div>`;
    el.params.appendChild(wrap);
    const range = wrap.querySelector(`#${id}-range`);
    const num = wrap.querySelector(`#${id}`);
    const onInput = (v) => {
      const val = a.type === "int" ? Math.round(+v) : +v;
      state.params[a.name] = val;
      range.value = val;
      num.value = val;
      render();
    };
    range.addEventListener("input", (e) => onInput(e.target.value));
    num.addEventListener("input", (e) => onInput(e.target.value));
  }
}

// --- notices ---------------------------------------------------------------

function showError(msg) {
  el.warn.className = "notice error";
  el.warn.innerHTML = msg;
  el.warn.hidden = false;
  el.charts.hidden = true;
}

function showWarning(msg) {
  el.warn.className = "notice warn";
  el.warn.innerHTML = msg;
  el.warn.hidden = false;
}

function clearNotice() {
  el.warn.hidden = true;
}

// --- info panel + method card ----------------------------------------------

function katex(latex, display) {
  if (window.katex) {
    try {
      return window.katex.renderToString(latex, { throwOnError: false, displayMode: display });
    } catch (e) { /* fall through */ }
  }
  return `<code>${escapeHtml(latex)}</code>`;
}

function renderInfo(ind) {
  const cols = ind.requires.map((c) => COLUMN_LABELS[c] || c).join(", ");
  el.info.innerHTML = `
    <h3>${ind.name}</h3>
    <p>${ind.description}</p>
    ${ind.context ? `<p class="context">${ind.context}</p>` : ""}
    <dl>
      <dt>Required data</dt><dd>${cols} (daily)</dd>
      <dt>Minimum length</dt><dd>${ind.minDays === "any" ? "any" : `${ind.minDays} days`}</dd>
    </dl>`;
}

function hasReference(ind) {
  return ind.reference && !/^n\/a/i.test(ind.reference.trim());
}

function linkifyReference(ref) {
  return ref.replace(/(https?:\/\/[^\s;]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

/** Equations (one per line), variable definitions, reference, Python source. */
function renderMethod(ind) {
  el.methodEqs.innerHTML = ind.equations.map((e) => `<div class="eq">${katex(e, true)}</div>`).join("");
  el.methodVars.innerHTML = ind.variables
    .map(([sym, desc]) => `<dt>${katex(sym, false)}</dt><dd>${desc}</dd>`)
    .join("");
  el.methodRef.innerHTML = hasReference(ind)
    ? `<strong>Reference:</strong> ${ind.reference.split(" ; ").map(linkifyReference).join("<br>")}`
    : "";
  el.methodRef.hidden = !hasReference(ind);
  loadPython(ind);
}

async function loadPython(ind) {
  const url = `python/${ind.id}.py`;
  el.download.href = url;
  el.download.setAttribute("download", `${ind.id}.py`);
  el.code.textContent = "Loading…";
  try {
    if (!pythonCache.has(ind.id)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      pythonCache.set(ind.id, await res.text());
    }
    if (state.indicator !== ind) return; // user moved on
    el.code.textContent = pythonCache.get(ind.id);
    el.code.removeAttribute("data-highlighted");
    if (window.hljs) window.hljs.highlightElement(el.code);
    el.codeBlock.hidden = false;
  } catch (e) {
    el.codeBlock.hidden = true;
  }
}

// --- rendering -------------------------------------------------------------

function compatibleDatasets(ind) {
  return Object.entries(state.profiles)
    .filter(([, p]) => ind.requires.every((c) => p.columns.has(c)) && lengthSufficient(p.span, ind.minDays))
    .map(([label]) => label);
}

function render() {
  const ind = state.indicator;
  const data = state.data;
  if (!ind || !data) return;
  renderInfo(ind);
  el.source.textContent = data.subDaily ? `${data.source} · aggregated to daily` : data.source;

  const missing = ind.requires.filter((c) => !data.columns.has(c));
  if (missing.length) {
    const compat = compatibleDatasets(ind);
    const suggestion = compat.length ? ` Bundled datasets with that column: ${compat.join(", ")}.` : "";
    showError(`<strong>${ind.name}</strong> needs column(s) <code>${missing.join(", ")}</code>, which “${data.source}” doesn't have.${suggestion}`);
    return;
  }

  const span = spanDays(data.timestamp);
  if (!lengthSufficient(span, ind.minDays)) {
    showWarning(`<strong>${ind.name}</strong> needs at least <strong>${ind.minDays} days</strong> of data, but this record spans <strong>${span} days</strong>. The result may not be meaningful.`);
  } else {
    clearNotice();
  }

  const primary = data[ind.primary];
  const callArgs = ind.args.map((a) => (a.kind === "series" ? data[a.column] : state.params[a.name]));

  let result;
  try {
    result = ind.compute(primary, ...callArgs);
  } catch (e) {
    showError(`This indicator couldn't run on this data: ${e.message}`);
    return;
  }

  el.charts.hidden = false;
  const ctx = {
    data,
    times: data.timestamp,
    primary,
    primaryName: ind.primary,
    primaryLabel: COLUMN_LABELS[ind.primary] || ind.primary,
    params: state.params,
  };

  Promise.all([
    plot.renderInput("chart-input", data),
    plot.renderResult("chart-result", ind, result, ctx),
  ]).then(() => plot.linkXAxes("chart-input", "chart-result"));

  const note = typeof ind.caption === "function" ? ind.caption(result, ctx) : defaultCaption(ind, result);
  el.resultNote.innerHTML = note || "";
  el.resultFoot.hidden = !note;
}

/** Fallback caption when an indicator doesn't define its own. */
function defaultCaption(ind, result) {
  if (ind.type === "scalar") {
    const v = Number.isFinite(result) ? (+result).toFixed(3) : "N/A";
    return `<strong>${ind.name}:</strong> ${v}`;
  }
  return "";
}

// --- init ------------------------------------------------------------------

async function init() {
  el.dataset = $("dataset");
  el.upload = $("upload");
  el.indicator = $("indicator");
  el.params = $("params");
  el.info = $("info");
  el.warn = $("warning");
  el.resultNote = $("result-note");
  el.resultFoot = $("result-foot");
  el.charts = $("charts");
  el.source = $("source");
  el.methodEqs = $("method-eqs");
  el.methodVars = $("method-vars");
  el.methodRef = $("method-ref");
  el.codeBlock = $("method-code");
  el.code = $("python-code");
  el.download = $("download-code");

  $("copy-code").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(el.code.textContent);
      e.target.textContent = "Copied";
      setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
    } catch (err) { /* clipboard unavailable */ }
  });

  for (const label of Object.keys(DATASETS)) {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    el.dataset.appendChild(opt);
  }
  el.dataset.addEventListener("change", (e) => loadDataset(e.target.value));
  el.upload.addEventListener("change", (e) => {
    if (e.target.files[0]) loadUpload(e.target.files[0]);
  });

  for (const ind of indicatorsByName()) {
    const opt = document.createElement("option");
    opt.value = ind.id;
    opt.textContent = ind.name;
    el.indicator.appendChild(opt);
  }
  el.indicator.addEventListener("change", (e) => selectIndicator(e.target.value));

  await computeProfiles();
  state.data = toDaily(await loadCsv(DATASETS[Object.keys(DATASETS)[0]], Object.keys(DATASETS)[0]));
  selectIndicator(indicatorsByName()[0].id);
}

init();
