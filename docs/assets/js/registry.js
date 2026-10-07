/**
 * registry.js — the single list of indicators the site knows about.
 *
 * The browser can't scan a folder, so adding an indicator is two steps:
 *   1. create indicators/<id>.js exporting the indicator object
 *      (and python/<id>.py with the published Python implementation)
 *   2. add one import + one array entry below (keep the list alphabetical)
 */
import antecedentPrecipitationIndex from "../../indicators/antecedent_precipitation_index.js";
import droughtSeverity from "../../indicators/drought_severity.js";
import dryDownTimescale from "../../indicators/dry_down_timescale.js";
import fieldCapacity from "../../indicators/field_capacity.js";
import flashDroughtOnset from "../../indicators/flash_drought_onset.js";
import fractionAvailableWater from "../../indicators/fraction_available_water.js";
import relativeSaturation from "../../indicators/relative_saturation.js";
import seasonalMannKendall from "../../indicators/seasonal_mann_kendall.js";
import soilMoistureAnomaly from "../../indicators/soil_moisture_anomaly.js";
import soilMoistureDeficitIndex from "../../indicators/soil_moisture_deficit_index.js";
import soilMoistureMemory from "../../indicators/soil_moisture_memory.js";
import soilMoisturePercentile from "../../indicators/soil_moisture_percentile.js";
import soilWaterDeficitIndex from "../../indicators/soil_water_deficit_index.js";
import soilWaterIndex from "../../indicators/soil_water_index.js";
import standardizedSoilMoistureIndex from "../../indicators/standardized_soil_moisture_index.js";
import usdmDroughtCategory from "../../indicators/usdm_drought_category.js";
import wettingEvents from "../../indicators/wetting_events.js";
import wiltingPoint from "../../indicators/wilting_point.js";

export const INDICATORS = [
  antecedentPrecipitationIndex,
  droughtSeverity,
  dryDownTimescale,
  fieldCapacity,
  flashDroughtOnset,
  fractionAvailableWater,
  relativeSaturation,
  seasonalMannKendall,
  soilMoistureAnomaly,
  soilMoistureDeficitIndex,
  soilMoistureMemory,
  soilMoisturePercentile,
  soilWaterDeficitIndex,
  soilWaterIndex,
  standardizedSoilMoistureIndex,
  usdmDroughtCategory,
  wettingEvents,
  wiltingPoint,
];

/** Human-friendly labels for the data columns an indicator may consume. */
export const COLUMN_LABELS = {
  vwc: "VWC (m³/m³)",
  precip: "Precipitation (mm)",
  timestamp: "Timestamp",
};

/** Indicators sorted by display name (for menus). */
export function indicatorsByName() {
  return [...INDICATORS].sort((a, b) => a.name.localeCompare(b.name));
}
