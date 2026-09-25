# SmartCrate ML Exploratory Baseline

This directory contains an exploratory spoilage-risk classification baseline using `dataset/spoilage_sensor_starter.csv`.

It is not a validated production model. The dataset's provenance, label-generation process, batch/session identity, and `ethylene_ppm` calibration are not established.

## Baseline

- Target: `spoilage_risk`
- Classes: `Low`, `Medium`, `High`
- Model: class-balanced Logistic Regression
- Features: `crop`, `maturity_stage`, `hours_since_harvest`, `temperature_c`, `humidity_percent`, `ethylene_ppm`, `voc_index`, `co2_ppm`
- Excluded: `weight_loss_percent`, because it may be downstream of spoilage and leak the target
- Categorical preprocessing: one-hot encoding
- Numeric preprocessing: standard scaling
- Split: stratified 80/20 train/test split with random seed 42

No valid batch/session grouping key exists, so grouped splitting was not possible. Metrics must therefore be treated as exploratory only.

## Commands

From the repository root:

```text
python ml/src/train_spoilage_model.py
python ml/src/evaluate_spoilage_model.py
```

Training writes:

- `ml/models/spoilage_risk_baseline.joblib`
- `ml/reports/spoilage_risk_baseline_metrics.json`

The model is not connected to Node.js, React, or a FastAPI service.
