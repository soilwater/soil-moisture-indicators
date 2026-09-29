"""Soil Moisture Anomaly.

Departure of daily soil moisture from its typical value for the same time of
year: the median of all observations within +/- `window` days of the same
calendar day, pooled across all years.

Reference: Patrignani, A., Knapp, M., Redmond, C., & Santos, E. (2020).
Technical overview of the Kansas Mesonet. J. Atmos. Oceanic Technol., 37(12),
2167-2183. https://doi.org/10.1175/JTECH-D-19-0214.1
"""
import numpy as np
import pandas as pd


def soil_moisture_anomaly(vwc: pd.Series, window: int = 15) -> pd.Series:
    """Seasonal soil moisture anomaly.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    window : int
        Half-width w of the seasonal window (days).

    Returns
    -------
    pd.Series
        Anomaly a_t = theta_t - seasonal median (m3/m3).
    """
    doy = vwc.index.dayofyear.to_numpy()
    vals = vwc.to_numpy(dtype=float)
    valid = np.isfinite(vals)
    climatology = np.full(len(vals), np.nan)
    for d in np.unique(doy):
        dist = np.abs(doy - d)
        dist = np.minimum(dist, 366 - dist)  # circular day-of-year distance
        pool = vals[valid & (dist <= window)]
        if pool.size:
            climatology[doy == d] = np.median(pool)
    return pd.Series(vals - climatology, index=vwc.index, name="anomaly")
