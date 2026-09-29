"""Z-Score.

Standardizes each daily observation against the whole record's mean and
sample standard deviation (no seasonal adjustment).
"""
import pandas as pd


def z_score(vwc: pd.Series) -> pd.Series:
    """Whole-record z-score.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    pd.Series
        z_t = (theta_t - mean) / std, using the sample standard deviation.
    """
    return ((vwc - vwc.mean()) / vwc.std(ddof=1)).rename("z_score")
