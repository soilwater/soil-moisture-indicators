"""Fraction of Available Water (FAW).

Also called plant-available water fraction or relative extractable water (REW).
Soil moisture scaled between the wilting point (0) and field capacity (1);
values above 1 indicate drainage after wetting. Following FAO-56, crops begin
to experience water stress once FAW < 1 - p, where p is the depletion fraction
(about 0.5 for many crops).

Reference: Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). Crop
evapotranspiration: Guidelines for computing crop water requirements.
FAO Irrigation and Drainage Paper 56. FAO, Rome.
"""
import numpy as np
import pandas as pd


def fraction_available_water(vwc: pd.Series, fc: float = 0.0, wp: float = 0.0) -> pd.Series:
    """Fraction of available water.

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
        FAW_t = (theta_t - wp) / (fc - wp) (dimensionless).
    """
    v = vwc.to_numpy(dtype=float)
    fc = fc if fc > 0 else np.nanpercentile(v, 95)
    wp = wp if wp > 0 else np.nanpercentile(v, 5)
    return ((vwc - wp) / (fc - wp)).rename("FAW")
