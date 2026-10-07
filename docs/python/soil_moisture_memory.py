"""Soil Moisture Memory (e-folding).

Anomalies are departures of daily soil moisture from a smoothed seasonal
climatology (mean of all days within +/- 15 days of the same calendar day,
across all years). Memory is the lag at which the anomaly autocorrelation
first falls to 1/e, linearly interpolated between whole-day lags.

Reference: Entin, J. K., Robock, A., Vinnikov, K. Y., Hollinger, S. E.,
Liu, S., & Namkhai, A. (2000). Temporal and spatial scales of observed soil
moisture variations in the extratropics. J. Geophys. Res., 105(D9),
11865-11877. https://doi.org/10.1029/2000JD900051
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


def soil_moisture_memory(vwc: pd.Series, max_lag: int = 60) -> float:
    """E-folding lag of the deseasonalized autocorrelation.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    max_lag : int
        Largest lag examined (days).

    Returns
    -------
    float
        Memory tau* (days), or NaN if the record is too short or the
        autocorrelation stays above 1/e up to max_lag.
    """
    daily = _fill_short_gaps(vwc.resample("D").mean())
    doy = daily.index.dayofyear.to_numpy()
    vals = daily.to_numpy(dtype=float)
    valid = np.isfinite(vals)
    climatology = np.full(len(vals), np.nan)
    for d in np.unique(doy):
        dist = np.abs(doy - d)
        dist = np.minimum(dist, 366 - dist)
        pool = vals[valid & (dist <= 15)]
        if pool.size:
            climatology[doy == d] = pool.mean()
    anomaly = pd.Series(vals - climatology, index=daily.index)

    if daily.index.year.nunique() < 2 or not anomaly.std() >= 1e-9:
        return np.nan
    target, prev = 1 / np.e, 1.0
    for lag in range(1, min(max_lag, len(anomaly) - 2) + 1):
        r = anomaly.autocorr(lag)
        if r < target:
            return lag - 1 + (prev - target) / (prev - r)
        prev = r
    return np.nan
