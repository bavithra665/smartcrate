from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from joblib import load

from .preprocessing import FEATURES
from .schemas import SpoilageRiskRequest, SpoilageRiskResponse

MODEL_VERSION = "spoilage_risk_baseline"
MODEL_SOURCE = "exploratory_baseline"
DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "spoilage_risk_baseline.joblib"


class ModelUnavailableError(RuntimeError):
    """Raised when the configured model artifact cannot be loaded."""


class SpoilageRiskInference:
    def __init__(self, model_path: Path = DEFAULT_MODEL_PATH) -> None:
        self.model_path = model_path
        self.model: Any | None = None
        self.load_error: str | None = None
        self._load_once()

    @property
    def model_loaded(self) -> bool:
        return self.model is not None

    def _load_once(self) -> None:
        try:
            self.model = load(self.model_path)
            self._validate_model_compatibility()
        except Exception as error:
            self.model = None
            self.load_error = f"{type(error).__name__}: {error}"

    def _validate_model_compatibility(self) -> None:
        if self.model is None or not hasattr(self.model, "predict"):
            raise TypeError("model artifact must expose predict")

        feature_names = list(getattr(self.model, "feature_names_in_", []))
        if feature_names != FEATURES:
            raise ValueError(
                f"model feature order {feature_names!r} does not match expected {FEATURES!r}"
            )

    def predict(self, request: SpoilageRiskRequest) -> SpoilageRiskResponse:
        if self.model is None:
            raise ModelUnavailableError(self.load_error or "model artifact is unavailable")

        features = pd.DataFrame(
            [[
                request.crop,
                request.maturity_stage,
                request.hours_since_harvest,
                request.temperature_c,
                request.humidity_percent,
                request.ethylene_ppm,
                request.voc_index,
                request.co2_ppm,
            ]],
            columns=FEATURES,
        )
        prediction = str(self.model.predict(features)[0])
        probabilities = None
        if hasattr(self.model, "predict_proba"):
            classes = getattr(self.model, "classes_", None)
            if classes is not None:
                probabilities = {
                    str(label): float(probability)
                    for label, probability in zip(classes, self.model.predict_proba(features)[0])
                }

        return SpoilageRiskResponse(
            spoilage_risk=prediction,
            probabilities=probabilities,
            model_version=MODEL_VERSION,
            model_source=MODEL_SOURCE,
            prediction_timestamp=datetime.now(timezone.utc),
        )
