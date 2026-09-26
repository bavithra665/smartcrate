from __future__ import annotations

from datetime import datetime
from typing import Dict

from pydantic import BaseModel, ConfigDict, Field


class SpoilageRiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    crop: str = Field(..., min_length=1, max_length=100)
    maturity_stage: str = Field(..., min_length=1, max_length=50)
    hours_since_harvest: float = Field(..., ge=0, le=240)
    temperature_c: float = Field(..., ge=15, le=40)
    humidity_percent: float = Field(..., ge=30, le=95)
    ethylene_ppm: float = Field(..., ge=0.066, le=15)
    voc_index: float = Field(..., ge=0.1, le=6.02)
    co2_ppm: float = Field(..., ge=300, le=926.8)


class ShelfLifeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    crop: str = Field(..., min_length=1, max_length=100)
    variety: str | None = Field(default=None, max_length=100)
    maturity_stage: str = Field(..., min_length=1, max_length=50)
    storage_condition: str | None = Field(default=None, max_length=100)
    hours_since_harvest: float = Field(..., ge=0)
    temperature: float | None = None
    humidity: float | None = None
    ethylene: float | None = None
    voc_index: float | None = None
    co2: float | None = None
    current_weight: float | None = Field(default=None, ge=0)


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    model_source: str


class SpoilageRiskResponse(BaseModel):
    spoilage_risk: str
    probabilities: Dict[str, float] | None = None
    model_version: str
    model_source: str
    prediction_timestamp: datetime
