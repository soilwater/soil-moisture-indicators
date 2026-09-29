"""Dry-Spell Duration (days below median).

Running length, in days, of the current spell with soil moisture below the
record median. Resets to zero when moisture returns to or above the median
(or when a day is missing).
"""
import numpy as np
import pandas as pd


def dry_spell_duration(vwc: pd.Series) -> pd.Series:
    """Days below the record median.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    pd.Series
        D_t = D_{t-1} + 1 if theta_t < median, else 0 (days).
    """
    below = (vwc < vwc.median()).to_numpy()  # NaN compares False -> resets
    out = np.zeros(len(below))
    run = 0
    for i, is_below in enumerate(below):
        run = run + 1 if is_below else 0
        out[i] = run
    return pd.Series(out, index=vwc.index, name="dry_spell_days")
