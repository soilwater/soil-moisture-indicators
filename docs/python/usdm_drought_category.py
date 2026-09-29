"""Drought Category (USDM percentile scale).

Assigns each daily observation a D0-D4 drought category from its seasonal
percentile (same time of year, +/- `window` days across all years; Gringorten
plotting position), using the U.S. Drought Monitor percentile ranges:
D4 <= 2, D3 <= 5, D2 <= 10, D1 <= 20, D0 <= 30.

Reference: Svoboda, M., et al. (2002). The Drought Monitor. Bull. Amer.
Meteor. Soc., 83(8), 1181-1190. https://doi.org/10.1175/1520-0477-83.8.1181
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


def usdm_drought_category(vwc: pd.Series, window: int = 15) -> pd.Series:
    """USDM-style drought category per day.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    window : int
        Half-width w of the seasonal window (days).

    Returns
    -------
    pd.Series
        "D4" ... "D0", "No drought", or "No data".
    """
    pct = (100 * seasonal_probability(vwc, window)).to_numpy()
    category = np.select(
        [np.isnan(pct), pct <= 2, pct <= 5, pct <= 10, pct <= 20, pct <= 30],
        ["No data", "D4", "D3", "D2", "D1", "D0"],
        default="No drought",
    )
    return pd.Series(category, index=vwc.index, name="category")
