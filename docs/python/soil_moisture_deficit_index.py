"""Soil Moisture Deficit Index (SMDI).

Weekly means of daily soil moisture (7-day blocks from the first day) are
compared with the long-term median, minimum, and maximum for the same week of
the year, and the resulting deficit SD is accumulated as
SMDI_w = 0.5 * SMDI_{w-1} + SD_w / 50 (range -4 to +4).

Reference: Narasimhan, B., & Srinivasan, R. (2005). Development and
evaluation of Soil Moisture Deficit Index (SMDI) and Evapotranspiration
Deficit Index (ETDI) for agricultural drought monitoring. Agric. For.
Meteorol., 133, 69-88. https://doi.org/10.1016/j.agrformet.2005.07.012
"""
import numpy as np
import pandas as pd


def soil_moisture_deficit_index(vwc: pd.Series) -> pd.Series:
    """Weekly SMDI.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    pd.Series
        SMDI for each week, indexed by the week's first day.
    """
    daily = vwc.resample("D").mean()
    start = daily.index[0]
    weekly = daily.groupby((daily.index - start).days // 7).mean()
    weekly.index = start + pd.to_timedelta(weekly.index * 7, unit="D")
    week_of_year = (weekly.index.dayofyear - 1) // 7

    valid = weekly.notna()
    clim = weekly[valid].groupby(week_of_year[valid.to_numpy()])
    median, low, high = clim.median(), clim.min(), clim.max()

    smdi = np.full(len(weekly), np.nan)
    prev, started = 0.0, False
    for i, (sw, wk) in enumerate(zip(weekly.to_numpy(dtype=float), week_of_year)):
        if not np.isfinite(sw):
            continue
        m = median[wk]
        if sw <= m:
            span = m - low[wk]
        else:
            span = high[wk] - m
        sd = 100 * (sw - m) / span if span > 0 else 0.0
        smdi[i] = 0.5 * prev + sd / 50 if started else sd / 50
        prev, started = smdi[i], True
    return pd.Series(smdi, index=weekly.index, name="SMDI")
