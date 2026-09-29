"""Soil Water Index (SWI).

Recursive exponential filter that smooths near-surface soil moisture into a
proxy for deeper, root-zone moisture, controlled by a characteristic time
length T (days). Missing values are forward- then back-filled so the
recursion is continuous.

References:
Wagner, W., Lemoine, G., & Rott, H. (1999). A method for estimating soil
moisture from ERS scatterometer and soil data. Remote Sens. Environ., 70(2),
191-207. https://doi.org/10.1016/S0034-4257(99)00036-X
Albergel, C., et al. (2008). From near-surface to root-zone soil moisture
using an exponential filter. Hydrol. Earth Syst. Sci., 12, 1323-1337.
https://doi.org/10.5194/hess-12-1323-2008
"""
import numpy as np
import pandas as pd


def soil_water_index(vwc: pd.Series, T: float = 10.0) -> pd.Series:
    """Soil water index (recursive exponential filter).

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    T : float
        Characteristic time length (days).

    Returns
    -------
    pd.Series
        SWI_t (m3/m3).
    """
    v = vwc.ffill().bfill().to_numpy(dtype=float)
    dt_days = np.diff(vwc.index.to_numpy()).astype("timedelta64[s]").astype(float) / 86400.0
    swi = np.empty(len(v))
    swi[0] = v[0]
    gain = 1.0
    for i in range(1, len(v)):
        gain = gain / (gain + np.exp(-dt_days[i - 1] / T))
        swi[i] = swi[i - 1] + gain * (v[i] - swi[i - 1])
    return pd.Series(swi, index=vwc.index, name="SWI")
