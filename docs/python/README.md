# Soil moisture indicators: Python reference implementations

One self-contained function per file. Each is the Python counterpart of the
indicator shown on the dashboard and reproduces the dashboard result (checked
to floating-point precision on the bundled sample data).

## Requirements

```
numpy, pandas, scipy
```

## Input convention

Every function takes the **primary series first**, followed by any other series
and then the parameters:

- `vwc`: daily mean volumetric water content (m³/m³) as a `pandas.Series` with
  a `DatetimeIndex`. For profile storage `S` (mm) over a depth `D` (mm), pass
  `S / D`, the depth-averaged water content.
- `precip` (where needed): precipitation (mm) as a `pandas.Series` with a
  `DatetimeIndex`. Summed to daily totals; days without data count as 0 mm.

Aggregate sub-daily records to daily values first, exactly as the dashboard
does:

```python
import pandas as pd

df = pd.read_csv("my_station.csv", parse_dates=["timestamp"]).set_index("timestamp")
vwc = df["vwc"].resample("D").mean()
precip = df["precip"].resample("D").sum()
```

## Example

```python
from soil_moisture_percentile import soil_moisture_percentile
from dry_down_timescale import dry_down_timescale

smp = soil_moisture_percentile(vwc, window=15)          # pd.Series, 0–100
result = dry_down_timescale(vwc, precip, min_days=7)   # dict
print(result["tau_median"], "days")
```

Seasonal indicators (anomaly, percentile, SSI, USDM category, flash drought,
SMDI, memory) compare each day with the same time of year across all years
and need at least two years of data. The seasonal Mann-Kendall test needs at
least three.
