"""Drought Severity (run theory).

Accumulated moisture deficit below a fixed threshold (the record median)
during the most severe uninterrupted dry run. With daily data each deficit is
weighted by a 1-day time step, so severity has units of m3/m3 x day.

Reference: Yevjevich, V. (1967). An objective approach to definitions and
investigations of continental hydrologic droughts. Hydrology Papers No. 23,
Colorado State University, Fort Collins.
"""
import pandas as pd


def drought_severity(vwc: pd.Series) -> dict:
    """Severity and duration of the most severe below-median run.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    dict
        severity (m3/m3 x day), duration_days, start and end dates of the run.
    """
    threshold = vwc.median()
    # Missing days count as zero deficit, i.e. they end a run.
    deficit = (threshold - vwc).clip(lower=0).fillna(0.0).to_numpy()
    best, best_len, best_end = 0.0, 0, None
    run, run_len = 0.0, 0
    for i, d in enumerate(deficit):
        if d > 0:
            run += d
            run_len += 1
            if run > best:
                best, best_len, best_end = run, run_len, i
        else:
            run, run_len = 0.0, 0
    dt_days = 1.0
    if best_end is None:
        return {"severity": 0.0, "duration_days": 0, "start": None, "end": None}
    return {
        "severity": best * dt_days,
        "duration_days": best_len * dt_days,
        "start": vwc.index[best_end - best_len + 1],
        "end": vwc.index[best_end],
    }
