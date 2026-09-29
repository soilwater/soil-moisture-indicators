"""Flash Drought Onset (Soil Moisture Percentile Drop, SMPD).

Daily soil moisture is averaged into pentads (5-day periods). Each pentad is
ranked against all pentads within +/- 2 pentads of the same time of year, in
any year (Gringorten plotting position). An onset is flagged when a pentad's
percentile falls below `lower` after having been at or above `upper` within the
preceding `max_pentads` pentads.

Reference: Ford, T. W., & Labosier, C. F. (2017). Meteorological conditions
associated with the onset of flash drought in the eastern United States.
Agric. For. Meteorol., 247, 414-423.
https://doi.org/10.1016/j.agrformet.2017.08.031
"""
import numpy as np
import pandas as pd


def flash_drought_onset(vwc: pd.Series, upper: float = 40, lower: float = 20,
                        max_pentads: int = 4) -> pd.DataFrame:
    """Flash drought onsets by pentad.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    upper, lower : float
        Percentiles the soil must drop from (P_high) and below (P_low).
    max_pentads : int
        Maximum number of pentads m allowed for the drop.

    Returns
    -------
    pd.DataFrame
        One row per pentad (indexed by its first day): mean VWC, seasonal
        percentile, and a boolean `onset` column.
    """
    daily = vwc.resample("D").mean()
    start = daily.index[0]
    bins = (daily.index - start).days // 5
    pentad = daily.groupby(bins).mean()
    pentad.index = start + pd.to_timedelta(pentad.index * 5, unit="D")
    pentad = pentad.dropna()

    vals = pentad.to_numpy(dtype=float)
    pentad_of_year = (pentad.index.dayofyear.to_numpy() - 1) // 5  # 0..73
    pct = np.empty(len(vals))
    for j in range(len(vals)):
        dist = np.abs(pentad_of_year - pentad_of_year[j])
        dist = np.minimum(dist, 74 - dist)
        pool = np.sort(vals[dist <= 2])
        rank = np.searchsorted(pool, vals[j], side="right")
        pct[j] = 100 * (rank - 0.44) / (len(pool) + 0.12)

    onset = np.zeros(len(pct), dtype=bool)
    for j in range(len(pct)):
        prior = pct[max(0, j - max_pentads):j]
        onset[j] = pct[j] < lower and bool((prior >= upper).any())

    return pd.DataFrame({"vwc": vals, "percentile": pct, "onset": onset}, index=pentad.index)
