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

## Exploratory inference service

The standalone FastAPI service loads the existing Phase 4B artifact once at startup:

```text
ml/models/spoilage_risk_baseline.joblib
```

Install the service dependencies:

```text
python -m pip install -r ml/requirements.txt
```

Run from the repository root:

```text
python -m uvicorn ml.src.api:app --host 0.0.0.0 --port 8000
```

The service is an exploratory wrapper around the saved baseline. It does not claim production accuracy and does not retrain or substitute a model when the artifact is unavailable.

The artifact was created with scikit-learn 1.8.0. Run the service with a compatible scikit-learn environment and treat version-mismatch warnings as a deployment blocker to resolve before relying on predictions.

### Endpoints

`GET /health` reports service status, model availability, model version, and source.

`POST /predict/spoilage-risk` accepts exactly the features used by the saved pipeline:

```json
{
	"crop": "Tomato",
	"maturity_stage": "Fully Ripe",
	"hours_since_harvest": 24,
	"temperature_c": 25.5,
	"humidity_percent": 60,
	"ethylene_ppm": 1.2,
	"voc_index": 0.8,
	"co2_ppm": 420
}
```

The response contains `spoilage_risk`, model probabilities when supported by the loaded artifact, model metadata, and a UTC prediction timestamp. The service rejects extra fields and out-of-domain numeric values with HTTP 422.

FastAPI OpenAPI documentation is available at `/docs` and `/redoc` when the service is running.

There is intentionally no `/predict/shelf-life` endpoint. Phase 4A found no defensible remaining-shelf-life target in the current datasets. Real longitudinal batch data and documented saleability endpoints are required before building that model.
