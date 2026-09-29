"""Rate of Change (d theta / dt).

First time-derivative of soil moisture: the change between consecutive
observations divided by the time between them, in days.
"""
import pandas as pd


def rate_of_change(vwc: pd.Series) -> pd.Series:
    """Rate of change of soil moisture.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    pd.Series
        (theta_t - theta_{t-1}) / Delta t, in m3/m3 per day.
    """
    dt_days = vwc.index.to_series().diff().dt.total_seconds() / 86400.0
    return (vwc.diff() / dt_days.to_numpy()).rename("rate_of_change")
