"""Dry-Down Timescale (tau).

A dry-down starts at a wetting peak (a day not lower than the previous day and
followed by a decline) and continues while daily rain stays at or below
`max_rain` and soil moisture does not rise by more than `rise_tol` from one
day to the next. Dry-downs lasting at least `min_days` are fit with

    theta(t) = theta_r + (theta_0 - theta_r) * exp(-t / tau)

by scanning the residual theta_r and solving a log-linear fit for each value.
The reported value is the median tau across dry-downs; k = 1 / tau.

References:
McColl, K. A., et al. (2017). Global characterization of surface soil moisture
drydowns. Geophys. Res. Lett., 44, 3682-3690. https://doi.org/10.1002/2017GL072819
Rondinelli, W. J., Hornbuckle, B. K., Patton, J. C., Cosh, M. H., Walker, V. A.,
Carr, B. D., & Logsdon, S. D. (2015). Different rates of soil drying after
rainfall are observed by the SMOS satellite and the South Fork in situ soil
moisture network. J. Hydrometeorol., 16(2), 889-903.
https://doi.org/10.1175/JHM-D-14-0137.1
"""
import numpy as np
import pandas as pd


def _fill_short_gaps(s: pd.Series, limit: int = 3) -> pd.Series:
    """Linearly interpolate interior gaps of at most `limit` missing days."""
    missing = s.isna()
    gap_id = (~missing).cumsum()
    gap_len = missing.groupby(gap_id).transform("sum")
    filled = s.interpolate(limit_area="inside")
    return filled.where(~missing | (gap_len <= limit))


def _fit_dry_down(days: np.ndarray, vals: np.ndarray, steps: int = 60):
    """Least-squares fit of theta_r + A*exp(slope*t); returns (tau, theta_r) or None."""
    vmin = vals.min()
    best = None
    for s in range(steps):
        theta_r = (vmin - 1e-4) * s / (steps - 1)
        slope, intercept = np.polyfit(days, np.log(vals - theta_r), 1)
        if not slope < 0:
            continue
        pred = theta_r + np.exp(intercept + slope * days)
        sse = float(np.sum((vals - pred) ** 2))
        if best is None or sse < best[0]:
            best = (sse, theta_r, slope)
    if best is None:
        return None
    return -1.0 / best[2], best[1]


def dry_down_timescale(vwc: pd.Series, precip: pd.Series, min_days: int = 15,
                       max_rain: float = 2.0, rise_tol: float = 0.005) -> dict:
    """Median e-folding timescale of soil dry-downs.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    precip : pd.Series
        Precipitation (mm) with a DatetimeIndex (summed to daily totals).
    min_days : int
        Minimum dry-down length L (days).
    max_rain : float
        Rain tolerated per day inside a dry-down, P_max (mm).
    rise_tol : float
        Day-to-day rise in water content tolerated as noise, epsilon (m3/m3).

    Returns
    -------
    dict
        tau_median (days), k (1/day), and a DataFrame of individual dry-downs.
    """
    v_series = _fill_short_gaps(vwc.resample("D").mean())
    p_series = precip.resample("D").sum().reindex(v_series.index, fill_value=0.0)
    v = v_series.to_numpy(dtype=float)
    p = p_series.to_numpy(dtype=float)
    n = len(v)
    events = []
    i = 1
    while i < n - 1:
        is_peak = (np.isfinite(v[i - 1]) and np.isfinite(v[i]) and np.isfinite(v[i + 1])
                   and v[i] >= v[i - 1] and v[i + 1] < v[i])
        if not is_peak:
            i += 1
            continue
        j = i
        while (j + 1 < n and np.isfinite(v[j + 1]) and p[j + 1] <= max_rain
               and v[j + 1] - v[j] <= rise_tol):
            j += 1
        if j - i >= min_days:
            fit = _fit_dry_down(np.arange(j - i + 1, dtype=float), v[i:j + 1])
            if fit is not None:
                events.append({"start": v_series.index[i], "end": v_series.index[j],
                               "tau_days": fit[0], "theta_r": fit[1]})
        i = max(j, i + 1)
    table = pd.DataFrame(events, columns=["start", "end", "tau_days", "theta_r"])
    tau = float(table["tau_days"].median()) if len(table) else np.nan
    return {"tau_median": tau, "k": 1.0 / tau if tau else np.nan, "dry_downs": table}
