# Phase 9: Prediction Evaluation and ML Data Preparation

Phase 9 evaluates the existing model and prepares real-world outcome data. It does not retrain or replace the production model.

## Evaluation methodology

An evaluation row requires an explicit `predictionId` on farmer feedback. The service verifies that the feedback farmer and harvest match the prediction before using it. Feedback without a supported explicit spoilage outcome remains `OUTCOME_UNKNOWN` and is counted as unevaluated.

The current feedback schema supports a binary observed-spoilage label:

- `No Spoilage` -> `NO_SPOILAGE`
- `Partial Spoilage`, `Full Spoilage`, or `Spoiled` sale status -> `SPOILAGE`
- a positive explicit `spoiledQuantity` -> `SPOILAGE`
- all other cases -> unknown

The prediction view is a high-risk alert evaluation: `High` is treated as a positive spoilage-risk alert and `Low`/`Medium` as no high-risk alert. This does not claim that `Low`, `Medium`, and `High` correspond to `No Spoilage`, `Partial Spoilage`, and `Full Spoilage`.

Metrics are withheld unless there are at least two labeled rows and both binary classes are represented in actual and predicted values. Otherwise the API reports `Insufficient labeled outcomes for reliable evaluation.`

Model sources and model versions are reported separately. `ml_model` predictions are never combined with `rule_based` fallback predictions in one metric.

## API endpoints

- `GET /api/admin/prediction-evaluation`: aggregate evaluation status, sample counts, coverage, confusion matrix, precision, recall, F1, and source/version groups.
- `GET /api/admin/ml-data-readiness`: aggregate data-quality counts, sensor-field availability, model sources, and shelf-life readiness.
- `GET /api/admin/ml-data-preparation`: admin-only prepared rows for future ML work.

All endpoints use the existing `protect` and `adminOnly` middleware. The evaluation endpoint does not return individual feedback records.

## Leakage and privacy controls

Prepared rows contain prediction-time features only. Actual outcomes, observed timestamps, and labels are stored as outcome fields and are never copied into model inputs. Farmer names, phone numbers, locations, JWTs, API keys, and other personal information are excluded. Database identifiers are retained only as traceability/grouping fields and are not predictive features.

The prepared data keeps all records from one harvest together. Future training must use batch-disjoint splits, time-aware validation where possible, and a final test set of unseen batches. Repeated sensor observations from one harvest must not be treated as independent random samples.

## Shelf-life readiness

Current feedback records do not record a documented `end_of_saleable_life_timestamp`. Therefore no remaining-shelf-life regression labels are generated. A report of spoilage is not enough to establish the timestamp at which produce became unsaleable. Batches sold before an endpoint or lost to follow-up must remain censored rather than receiving an invented target.

## Preservation

The service reads predictions, feedback, harvests, and sensor readings only. It does not update or overwrite any of those documents, does not retrain automatically, and does not modify the existing `.joblib` model artifact, datasets, or baseline metrics.