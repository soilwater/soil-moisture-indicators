"""Moving Average.

Trailing (backward-looking) mean of soil moisture over the preceding `window`
days of calendar time, i.e. over the interval (t - window, t].
"""
import pandas as pd


def moving_average(vwc: pd.Series, window: int = 7) -> pd.Series:
    """Trailing calendar-time moving average.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    window : int
        Window length Delta (days).

    Returns
    -------
    pd.Series
        Mean of the valid observations in (t - window, t] (m3/m3).
    """
    return vwc.rolling(f"{window}D", min_periods=1).mean().rename("moving_average")
