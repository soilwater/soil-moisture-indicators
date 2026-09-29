"""Antecedent Precipitation Index (API).

Daily running total of rainfall in which each earlier day's contribution
decays by the factor k. The index starts at zero, so roughly the first
3 / (1 - k) days are underestimated (spin-up).

Reference: Kohler, M. A., & Linsley, R. K. (1951). Predicting the runoff from
storm rainfall. Research Paper No. 34, U.S. Weather Bureau, Washington, D.C.
"""
import numpy as np
import pandas as pd


def antecedent_precipitation_index(precip: pd.Series, k: float = 0.9) -> pd.Series:
    """Antecedent precipitation index.

    Parameters
    ----------
    precip : pd.Series
        Precipitation (mm) with a DatetimeIndex. Summed to daily totals;
        days without data count as 0 mm.
    k : float
        Daily recession factor, 0 < k < 1.

    Returns
    -------
    pd.Series
        API_t = k * API_{t-1} + P_t (mm), with API_0 = 0.
    """
    daily = precip.resample("D").sum()
    api = np.empty(len(daily))
    value = 0.0
    for i, p in enumerate(daily.to_numpy(dtype=float)):
        value = k * value + p
        api[i] = value
    return pd.Series(api, index=daily.index, name="API")
