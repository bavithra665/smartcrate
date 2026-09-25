# Exploratory Spoilage-Risk Classification Baseline

This is an exploratory baseline using `dataset/spoilage_sensor_starter.csv`. It is not a validated production model and is not connected to SmartCrate backend, frontend, hardware, or an inference service.

## Configuration

- Model: class-balanced Logistic Regression
- Target: `spoilage_risk`
- Classes: `Low`, `Medium`, `High`
- Features: `crop`, `maturity_stage`, `hours_since_harvest`, `temperature_c`, `humidity_percent`, `ethylene_ppm`, `voc_index`, `co2_ppm`
- Excluded: `weight_loss_percent`, because it may be downstream of spoilage and leak the target
- Categorical preprocessing: one-hot encoding
- Numeric preprocessing: standard scaling
- Split: stratified 80/20 train/test split
- Random seed: 42
- No valid batch/session grouping key was available

## Test-set distribution

| Class | Count |
|---|---:|
| Low | 645 |
| Medium | 350 |
| High | 5 |

## Results

Confusion matrix label order is `Low`, `Medium`, `High`:

```text
[[557, 87,  1],
 [ 47,225, 78],
 [  0,  1,  4]]
```

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Low | 0.9222 | 0.8636 | 0.8919 | 645 |
| Medium | 0.7188 | 0.6429 | 0.6787 | 350 |
| High | 0.0482 | 0.8000 | 0.0909 | 5 |

- Macro F1: `0.5539`
- Weighted F1: `0.8133`

## Interpretation and limitations

The High class has only 27 total rows and 5 test rows. Although recall was 0.80 on those five examples, precision was 0.0482 because the baseline generated many false High predictions. This is not sufficient evidence for production use.

The dataset has no batch/session identifier, so repeated observations cannot be ruled out and grouped splitting was not possible. Its provenance and label-generation process are undocumented. `ethylene_ppm` calibration and physical SmartCrate sensor provenance are also unverified.

No shelf-life regression target was used or created. No data was fabricated, and `weight_loss_percent` was not used in the main baseline.

## Artifacts

- Training: `src/train_spoilage_model.py`
- Evaluation: `src/evaluate_spoilage_model.py`
- Preprocessing: `src/preprocessing.py`
- Model artifact: `models/spoilage_risk_baseline.joblib`
- Machine-readable metrics: `reports/spoilage_risk_baseline_metrics.json`
