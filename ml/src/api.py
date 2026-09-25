from __future__ import annotations

from fastapi import FastAPI, HTTPException, status

from .inference import ModelUnavailableError, SpoilageRiskInference
from .schemas import HealthResponse, SpoilageRiskRequest, SpoilageRiskResponse

MODEL_VERSION = "spoilage_risk_baseline"
MODEL_SOURCE = "exploratory_baseline"

app = FastAPI(
    title="SmartCrate ML Inference Service",
    description=(
        "Standalone exploratory spoilage-risk inference service. "
        "This service does not provide shelf-life regression."
    ),
    version="0.1.0",
)
inference = SpoilageRiskInference()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if inference.model_loaded else "degraded",
        model_loaded=inference.model_loaded,
        model_version=MODEL_VERSION,
        model_source=MODEL_SOURCE,
    )


@app.post(
    "/predict/spoilage-risk",
    response_model=SpoilageRiskResponse,
    status_code=status.HTTP_200_OK,
)
def predict_spoilage_risk(request: SpoilageRiskRequest) -> SpoilageRiskResponse:
    try:
        return inference.predict(request)
    except ModelUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Spoilage-risk model unavailable: {error}",
        ) from error
