"""Soil Moisture Percentile (SMP).

Percentile (0-100) of each daily observation relative to all observations
from the same time of year: every day, in any year, within +/- `window` days
of the same calendar day. Uses the Gringorten plotting position.

Reference: Sheffield, J., Goteti, G., Wen, F., & Wood, E. F. (2004). A
simulated soil moisture based drought analysis for the United States.
J. Geophys. Res., 109, D24108. https://doi.org/10.1029/2004JD005182
"""
import numpy as np
import pandas as pd


def seasonal_probability(vwc: pd.Series, window: int = 15) -> pd.Series:
    """Gringorten non-exceedance probability (i - 0.44) / (n + 0.12) of each
    value within its day-of-year pool."""
    doy = vwc.index.dayofyear.to_numpy()
    vals = vwc.to_numpy(dtype=float)
    valid = np.isfinite(vals)
    prob = np.full(len(vals), np.nan)
    for d in np.unique(doy):
        dist = np.abs(doy - d)
        dist = np.minimum(dist, 366 - dist)
        pool = np.sort(vals[valid & (dist <= window)])
        rows = (doy == d) & valid
        rank = np.searchsorted(pool, vals[rows], side="right")
        prob[rows] = (rank - 0.44) / (len(pool) + 0.12)
    return pd.Series(prob, index=vwc.index)


def soil_moisture_percentile(vwc: pd.Series, window: int = 15) -> pd.Series:
    """Seasonal soil moisture percentile.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    window : int
        Half-width w of the seasonal window (days).

    Returns
    -------
    pd.Series
        Percentile P_t (0-100).
    """
    return (100 * seasonal_probability(vwc, window)).rename("SMP")
