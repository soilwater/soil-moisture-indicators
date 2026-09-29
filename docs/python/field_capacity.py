"""Field Capacity (drained upper limit).

Field-estimated field capacity: the median soil moisture a set drainage time
after major wetting peaks. Peaks must be in the wettest 5% of the record and
have a prominence of at least half the record range.

References:
Veihmeyer, F. J., & Hendrickson, A. H. (1931). The moisture equivalent as a
measure of the field capacity of soils. Soil Sci., 32(3), 181-194.
Ratliff, L. F., Ritchie, J. T., & Cassel, D. K. (1983). Field-measured limits
of soil water availability as related to laboratory-measured properties.
Soil Sci. Soc. Am. J., 47(4), 770-775.
https://doi.org/10.2136/sssaj1983.03615995004700040032x
"""
import numpy as np
import pandas as pd
from scipy.signal import find_peaks


def field_capacity(vwc: pd.Series, drainage_days: float = 2.0) -> float:
    """Median water content `drainage_days` after major wetting peaks.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.
    drainage_days : float
        Drainage time after the peak (days).

    Returns
    -------
    float
        Estimated field capacity (m3/m3), or NaN if no peaks qualify.
    """
    v = vwc.resample("D").mean().to_numpy(dtype=float)
    record_range = np.nanmax(v) - np.nanmin(v)
    peaks, _ = find_peaks(v, height=np.nanquantile(v, 0.95), prominence=0.5 * record_range)
    lag = max(int(np.floor(drainage_days + 0.5)), 1)  # daily data: 1 row = 1 day
    targets = peaks + lag
    values = v[targets[targets < len(v)]]
    values = values[np.isfinite(values)]
    return float(np.median(values)) if values.size else np.nan
