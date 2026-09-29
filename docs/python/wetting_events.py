"""Wetting Events (rainfall response).

Flags days on which daily-mean soil moisture has risen by at least `min_rise`
over the last `window` days while at least `min_rain` of rain fell in the
same window. Consecutive flagged days form one wetting event.
"""
import pandas as pd


def wetting_events(vwc: pd.Series, precip: pd.Series, window: int = 3,
                   min_rise: float = 0.03, min_rain: float = 5.0) -> pd.Series:
    """Daily wetting-event flags.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    precip : pd.Series
        Precipitation (mm) with a DatetimeIndex (summed to daily totals).
    window : int
        Window length w (days).
    min_rise : float
        Minimum rise in water content, Delta-theta_min (m3/m3).
    min_rain : float
        Minimum rain over the window, P_min (mm).

    Returns
    -------
    pd.Series
        Boolean flag per day. Count events with
        ``(flag & ~flag.shift(fill_value=False)).sum()``.
    """
    v = vwc.resample("D").mean()
    p = precip.resample("D").sum().reindex(v.index, fill_value=0.0)
    rise = v - v.shift(window)
    rain = p.rolling(window, min_periods=1).sum()
    return ((rise >= min_rise) & (rain >= min_rain)).rename("wetting")
