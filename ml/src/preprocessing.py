from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TARGET = "spoilage_risk"
CATEGORICAL_FEATURES = ["crop", "maturity_stage"]
NUMERIC_FEATURES = [
    "hours_since_harvest",
    "temperature_c",
    "humidity_percent",
    "ethylene_ppm",
    "voc_index",
    "co2_ppm",
]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
EXCLUDED_FEATURES = ["weight_loss_percent"]
ALLOWED_TARGETS = ["Low", "Medium", "High"]


def load_dataset(dataset_path: Path) -> pd.DataFrame:
    """Load and validate the starter dataset without changing its contents."""
    frame = pd.read_csv(dataset_path)
    required_columns = set(FEATURES + EXCLUDED_FEATURES + [TARGET])
    missing_columns = sorted(required_columns.difference(frame.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")

    if frame[FEATURES + [TARGET]].isna().any().any():
        missing = frame[FEATURES + [TARGET]].isna().sum()
        raise ValueError(f"Dataset contains missing values: {missing[missing > 0].to_dict()}")

    invalid_targets = sorted(set(frame[TARGET]) - set(ALLOWED_TARGETS))
    if invalid_targets:
        raise ValueError(f"Unexpected target values: {invalid_targets}")

    for column in NUMERIC_FEATURES:
        if not pd.api.types.is_numeric_dtype(frame[column]):
            raise ValueError(f"Feature must be numeric: {column}")

    return frame


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_FEATURES,
            ),
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )


def build_model_pipeline(classifier) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("classifier", classifier),
        ]
    )
