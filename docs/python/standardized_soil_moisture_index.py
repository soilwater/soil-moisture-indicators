"""Standardized Soil Moisture Index (SSI).

Nonparametric standardized index: each daily observation's empirical
probability relative to the same time of year (Gringorten plotting position,
+/- `window` days across all years) is transformed to a standard-normal value.
Classes (McKee et al., 1993): <= -1 moderate, <= -1.5 severe, <= -2 extreme.

References:
Farahmand, A., & AghaKouchak, A. (2015). A generalized framework for deriving
nonparametric standardized drought indicators. Adv. Water Resour., 76,
140-145. https://doi.org/10.1016/j.advwatres.2014.11.012
McKee, T. B., Doesken, N. J., & Kleist, J. (1993). The relationship of drought
frequency and duration to time scales. Proc. 8th Conf. on Applied Climatology,
Anaheim, CA, Amer. Meteor. Soc., 179-184.
"""
import numpy as np
import pandas as pd
from scipy.stats import norm


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


def standardized_soil_moisture_index(vwc: pd.Series, window: int = 15) -> pd.Series:
    """Standardized soil moisture index.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    window : int
        Half-width w of the seasonal window (days).

    Returns
    -------
    pd.Series
        SSI_t = Phi^-1(p_t) (standard deviations).
    """
    p = seasonal_probability(vwc, window)
    return pd.Series(norm.ppf(p.to_numpy()), index=vwc.index, name="SSI")
