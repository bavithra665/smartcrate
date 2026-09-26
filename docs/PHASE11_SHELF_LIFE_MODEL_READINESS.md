# Phase 11: Shelf-Life Model Readiness

## Readiness decision

Shelf-life regression training is not yet justified because the dataset available in this workspace does not meet the required readiness threshold. The existing gate requires at least 30 valid shelf-life rows from at least 10 distinct harvest batches. The workspace-only audit, with no MongoDB collection records accessible, returned 0 valid rows and 0 distinct batches. A live MongoDB audit could not run because `MONGO_URI` is not configured in this environment.

No shelf-life model was trained, no shelf-life model artifact or prediction was created, and the existing spoilage-risk classifier and artifact were not modified. More genuine longitudinal sensor and quality-observation data with documented saleability endpoints is required.

## Target and eligibility

For a valid observation, the target is:

`remaining_shelf_life_days = (end_of_saleable_life_timestamp - observation_timestamp) / 24 hours`

Only documented endpoints with valid timestamps and a prediction-time feature observation can contribute. Censored batches, unknown endpoints, invalid or non-positive targets, observations after the endpoint, future observations, and rows missing required features must be excluded. Endpoint timestamps are labels only, never model inputs.

## Prediction-time feature contract

The preparation contract permits `crop`, `variety`, `maturity_stage`, `storage_condition`, `hours_since_harvest`, `temperature`, `humidity`, `ethylene`, `voc_index`, `co2`, and `current_weight`. Sensor values are used only when observed at or before the prediction timestamp; future quality observations and sensor/weight readings are not eligible inputs. An `ethylene` reading is not asserted to be calibrated ppm.

Identifiers such as `farmerId`, `harvestId`, `predictionId`, and `recommendationId`, as well as comments and sale dates, are excluded from features. Sale dates cannot substitute for a documented saleability endpoint.

## Training and evaluation status

- Training threshold: 30 valid rows and 10 distinct harvest batches; the existing readiness gate remains authoritative.
- Preprocessing/model: not created; model type has not been selected because training is blocked.
- Model version: none.
- Split: no split was generated. The existing utility is batch-disjoint, assigns whole harvest batches to train/validation/test at 70/15/15 proportions, and uses random seed 42. It does not claim a time-aware split.
- Metrics: MAE, RMSE, R-squared, and subgroup metrics are unavailable because no model was trained or evaluated.
- Uncertainty: none is reported.

## Inference and limitations

`POST /predict/shelf-life` accepts only prediction-time fields and responds with HTTP 503 `SHELF_LIFE_MODEL_NOT_READY` while no justified model is available. Node preserves the spoilage-risk prediction and leaves shelf-life fields unset when this response is returned. React displays “Shelf-life model: Data collection in progress” and ignores historical shelf-life values that lack shelf-model provenance.

Current observations are insufficient for regression. The existing spoilage-risk dataset is not a substitute for longitudinal saleability labels, and this phase does not infer endpoints from risk, arbitrary feedback timestamps, sale dates, or assumed shelf-life durations. No automatic training occurs.