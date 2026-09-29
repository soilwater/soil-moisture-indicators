"""Wilting Point (field lower limit).

Field-estimated lower limit of plant-available water: a robust minimum of the
record, computed as the mean of the observations at or below the p-th
percentile. It approximates the wilting point only if the record includes a
severe dry-down under active roots.

Reference: Ratliff, L. F., Ritchie, J. T., & Cassel, D. K. (1983).
Field-measured limits of soil water availability as related to
laboratory-measured properties. Soil Sci. Soc. Am. J., 47(4), 770-775.
https://doi.org/10.2136/sssaj1983.03615995004700040032x
"""
import numpy as np
import pandas as pd


def wilting_point(vwc: pd.Series, percentile: float = 2) -> float:
    """Robust minimum of the record.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    percentile : float
        Dry-end percentile p.

    Returns
    -------
    float
        Estimated wilting point (m3/m3).
    """
    v = vwc.to_numpy(dtype=float)
    v = v[np.isfinite(v)]
    q = np.percentile(v, percentile)
    return float(v[v <= q].mean())
