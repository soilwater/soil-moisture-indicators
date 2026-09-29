"""Seasonal Mann-Kendall Trend Test + Sen's Slope.

Daily soil moisture is averaged by calendar month. Each calendar month is
compared only against the same month in other years (Seasonal Kendall), which
removes the seasonal cycle and the day-to-day persistence that would make a
naive daily test overstate significance. Sen's slope is the median of all
within-month pairwise slopes (m3/m3 per year).

References:
Hirsch, R. M., Slack, J. R., & Smith, R. A. (1982). Techniques of trend
analysis for monthly water quality data. Water Resour. Res., 18(1), 107-121.
https://doi.org/10.1029/WR018i001p00107
Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's
tau. J. Amer. Statist. Assoc., 63(324), 1379-1389.
https://doi.org/10.1080/01621459.1968.10480934
"""
import numpy as np
import pandas as pd
from scipy.stats import norm


def seasonal_mann_kendall(vwc: pd.Series) -> dict:
    """Seasonal Kendall trend test on monthly means.

    Parameters
    ----------
    vwc : pd.Series
        Daily mean volumetric water content (m3/m3) with a DatetimeIndex.

    Returns
    -------
    dict
        S, var_S, Z, two-sided p-value, and Sen's slope (m3/m3 per year).
    """
    monthly = vwc.resample("MS").mean().dropna()
    S, var_s, slopes = 0.0, 0.0, []
    for month in range(1, 13):
        m = monthly[monthly.index.month == month]
        years = m.index.year.to_numpy()
        vals = m.to_numpy(dtype=float)
        n = len(vals)
        if n < 2:
            continue
        for i in range(n - 1):
            for j in range(i + 1, n):
                S += np.sign(vals[j] - vals[i])
                slopes.append((vals[j] - vals[i]) / (years[j] - years[i]))
        _, ties = np.unique(vals, return_counts=True)
        var_s += (n * (n - 1) * (2 * n + 5) - np.sum(ties * (ties - 1) * (2 * ties + 5))) / 18.0
    z = 0.0
    if var_s > 0 and S != 0:
        z = (S - np.sign(S)) / np.sqrt(var_s)
    return {
        "S": S,
        "var_S": var_s,
        "Z": z,
        "p": 2 * norm.sf(abs(z)),
        "sen_slope_per_year": float(np.median(slopes)) if slopes else np.nan,
    }
