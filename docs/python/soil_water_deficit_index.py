"""Soil Water Deficit Index (SWDI).

Soil moisture relative to the available water capacity, scaled so that 0 is
field capacity and -10 is the wilting point. Drought classes (Martinez-
Fernandez et al., 2015): > 0 no drought, 0 to -2 mild, -2 to -5 moderate,
-5 to -10 severe, < -10 extreme.

Reference: Martinez-Fernandez, J., Gonzalez-Zamora, A., Sanchez, N., &
Gumuzzio, A. (2015). A soil water based index as a suitable agricultural
drought indicator. J. Hydrol., 522, 265-273.
https://doi.org/10.1016/j.jhydrol.2014.12.051
"""
import numpy as np
import pandas as pd


def soil_water_deficit_index(vwc: pd.Series, fc: float = 0.0, wp: float = 0.0) -> pd.Series:
    """Soil water deficit index.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    fc : float
        Field capacity (m3/m3). 0 = estimate as the record's 95th percentile.
    wp : float
        Wilting point (m3/m3). 0 = estimate as the record's 5th percentile.

    Returns
    -------
    pd.Series
        SWDI_t = 10 * (theta_t - fc) / (fc - wp).
    """
    v = vwc.to_numpy(dtype=float)
    fc = fc if fc > 0 else np.nanpercentile(v, 95)
    wp = wp if wp > 0 else np.nanpercentile(v, 5)
    return (10 * (vwc - fc) / (fc - wp)).rename("SWDI")
