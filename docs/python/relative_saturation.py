"""Relative Saturation (%).

Soil moisture as a percentage of the saturated water content. With a porosity
value this is the degree of saturation theta / phi; with porosity = 0 the
maximum water content observed in the record stands in for saturation.
"""
import numpy as np
import pandas as pd


def relative_saturation(vwc: pd.Series, porosity: float = 0.0) -> pd.Series:
    """Relative saturation.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    porosity : float
        Porosity phi (m3/m3). Use 0 to fall back to the record maximum.

    Returns
    -------
    pd.Series
        S_t = 100 * theta_t / phi (%).
    """
    phi = porosity if porosity > 0 else np.nanmax(vwc.to_numpy(dtype=float))
    return (100 * vwc / phi).rename("relative_saturation")
