from pathlib import Path

from fastapi.testclient import TestClient

from ml.src import api
from ml.src.inference import SpoilageRiskInference


client = TestClient(api.app)

VALID_REQUEST = {
    "crop": "Tomato",
    "maturity_stage": "Fully Ripe",
    "hours_since_harvest": 24,
    "temperature_c": 25.5,
    "humidity_percent": 60,
    "ethylene_ppm": 1.2,
    "voc_index": 0.8,
    "co2_ppm": 420,
}

VALID_SHELF_LIFE_REQUEST = {
    "crop": "Tomato",
    "variety": "Roma",
    "maturity_stage": "Fully Ripe",
    "storage_condition": "Cold Room",
    "hours_since_harvest": 24,
    "temperature": 25.5,
    "humidity": 60,
    "ethylene": 1.2,
    "voc_index": 0.8,
    "co2": 420,
    "current_weight": 4.5,
}


def test_health_reports_loaded_exploratory_model():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "model_loaded": True,
        "model_version": "spoilage_risk_baseline",
        "model_source": "exploratory_baseline",
    }


def test_valid_prediction_returns_structured_probabilities():
    response = client.post("/predict/spoilage-risk", json=VALID_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["spoilage_risk"] in {"Low", "Medium", "High"}
    assert set(body["probabilities"]) == {"Low", "Medium", "High"}
    assert abs(sum(body["probabilities"].values()) - 1) < 1e-8
    assert body["model_version"] == "spoilage_risk_baseline"
    assert body["model_source"] == "exploratory_baseline"
    assert body["prediction_timestamp"]


def test_malformed_request_is_rejected():
    invalid_request = {**VALID_REQUEST, "humidity_percent": 101, "unexpected": 1}

    response = client.post("/predict/spoilage-risk", json=invalid_request)

    assert response.status_code == 422


def test_shelf_life_endpoint_reports_model_not_ready():
    response = client.post("/predict/shelf-life", json=VALID_SHELF_LIFE_REQUEST)

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SHELF_LIFE_MODEL_NOT_READY"
    assert "More longitudinal data is required" in response.json()["detail"]["message"]
    assert "remaining_shelf_life_days" not in response.json()


def test_shelf_life_request_rejects_endpoint_leakage_fields():
    invalid_request = {
        **VALID_SHELF_LIFE_REQUEST,
        "end_of_saleable_life_timestamp": "2026-09-30T00:00:00Z",
    }

    response = client.post("/predict/shelf-life", json=invalid_request)

    assert response.status_code == 422


def test_missing_model_degrades_health_and_returns_service_unavailable(monkeypatch):
    unavailable = SpoilageRiskInference(Path("ml/models/does-not-exist.joblib"))
    monkeypatch.setattr(api, "inference", unavailable)

    health_response = client.get("/health")
    prediction_response = client.post("/predict/spoilage-risk", json=VALID_REQUEST)

    assert health_response.status_code == 200
    assert health_response.json()["status"] == "degraded"
    assert health_response.json()["model_loaded"] is False
    assert prediction_response.status_code == 503

    monkeypatch.setattr(api, "inference", SpoilageRiskInference())
