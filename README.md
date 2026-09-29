# soil-moisture-indicators

A catalog of common soil moisture indicators for daily time series: drought
indices, plant-available water, soil-water dynamics, and long-term trends.

**Live site:** <https://soilwater.github.io/soil-moisture-indicators/>

The site is an interactive dashboard that runs entirely in the browser. Pick
the sample dataset or upload your own CSV, choose an indicator, and adjust its
parameters. Below each chart, a Method section lists the equations one per
line, defines every variable, cites the reference, and shows the Python
implementation.

## Indicators

| Group | Indicators |
|---|---|
| Drought and anomalies | Soil Moisture Anomaly · Soil Moisture Percentile (SMP) · Standardized Soil Moisture Index (SSI) · Drought Category (USDM percentile scale) · Soil Moisture Deficit Index (SMDI) · Flash Drought Onset (SMPD) · Drought Severity (run theory) · Dry-Spell Duration · Z-Score |
| Plant-available water | Fraction of Available Water (FAW) · Soil Water Deficit Index (SWDI) · Field Capacity (drained upper limit) · Wilting Point (field lower limit) · Relative Saturation |
| Dynamics | Dry-Down Timescale (τ) · Wetting Events · Rate of Change · Soil Moisture Memory · Soil Water Index (SWI) · Moving Average · Antecedent Precipitation Index (API) |
| Trends | Seasonal Mann-Kendall Trend + Sen's Slope |

## Python

Each indicator is published as a self-contained Python function (numpy,
pandas, scipy) in [`docs/python/`](docs/python/). The functions take the
primary series first and produce the same results as the dashboard. This was
verified to floating-point precision, including on records with gaps. See
[`docs/python/README.md`](docs/python/README.md) for usage.

## Data format

A CSV with a `timestamp` column, `vwc` (volumetric water content, m³/m³), and
optionally `precip` (precipitation, mm). All indicators use daily values.
Sub-daily records are aggregated on load: VWC to the daily mean, precipitation
to the daily total.

**Profile storage.** If you combine several sensors into a profile water
storage S (mm), divide it by the profile depth D (mm) before uploading. S/D is
the depth-weighted mean water content (m³/m³), so every indicator, parameter,
and unit applies unchanged. Results then describe the whole profile. If you
enter field capacity or wilting point (FAW, SWDI), use profile-averaged values. Deeper
profiles respond more slowly than a single shallow sensor (longer memory and
dry-down times, smaller wetting rises), so compare sites of similar depth.

## Repository layout

```
docs/                     GitHub Pages site (served from /docs)
  index.html              The dashboard
  llms.txt                LLM-friendly summary and indicator contract
  indicators/             Dashboard (JavaScript) implementation, one file per indicator
  python/                 Published Python implementation, one file per indicator
  assets/css, assets/js   Styles, dashboard controller, plotting, shared math
  datasets/               Sample data
```

## Run locally

The site uses ES modules, so serve `docs/` over HTTP rather than opening the
file directly:

```bash
npx serve docs
```

## Adding or changing an indicator

Edit both `docs/indicators/<id>.js` (dashboard) and `docs/python/<id>.py`
(published code) so they stay in sync. New indicators also need one import
and one entry in `docs/assets/js/registry.js`. The full module contract is in
[`docs/llms.txt`](docs/llms.txt).

## Credits

Charts: [Plotly.js](https://plotly.com/javascript/) · Equations:
[KaTeX](https://katex.org/) · Code highlighting:
[highlight.js](https://highlightjs.org/)
