from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from joblib import dump
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocessing import (  # noqa: E402
    ALLOWED_TARGETS,
    FEATURES,
    TARGET,
    build_model_pipeline,
    load_dataset,
)

RANDOM_STATE = 42
TEST_SIZE = 0.2


def evaluate(model, x_test, y_test) -> dict:
    predictions = model.predict(x_test)
    report = classification_report(
        y_test,
        predictions,
        labels=ALLOWED_TARGETS,
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(y_test, predictions, labels=ALLOWED_TARGETS)
    return {
        "class_distribution": y_test.value_counts().reindex(ALLOWED_TARGETS, fill_value=0).to_dict(),
        "confusion_matrix": {
            "labels": ALLOWED_TARGETS,
            "matrix": matrix.tolist(),
        },
        "precision_per_class": {
            label: report[label]["precision"] for label in ALLOWED_TARGETS
        },
        "recall_per_class": {
            label: report[label]["recall"] for label in ALLOWED_TARGETS
        },
        "f1_per_class": {
            label: report[label]["f1-score"] for label in ALLOWED_TARGETS
        },
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
        "support_per_class": {
            label: int(report[label]["support"]) for label in ALLOWED_TARGETS
        },
    }


def train(dataset_path: Path, model_path: Path, metrics_path: Path) -> dict:
    frame = load_dataset(dataset_path)
    x_train, x_test, y_train, y_test = train_test_split(
        frame[FEATURES],
        frame[TARGET],
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=frame[TARGET],
    )

    model = build_model_pipeline(
        LogisticRegression(
            class_weight="balanced",
            max_iter=2000,
            random_state=RANDOM_STATE,
        )
    )
    model.fit(x_train, y_train)
    evaluation = evaluate(model, x_test, y_test)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    dump(model, model_path)

    result = {
        "experiment": "exploratory_spoilage_risk_logistic_regression",
        "dataset": str(dataset_path.as_posix()),
        "rows": int(len(frame)),
        "features": FEATURES,
        "excluded_features": ["weight_loss_percent"],
        "target": TARGET,
        "model": "LogisticRegression",
        "class_weight": "balanced",
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "split": "stratified train/test; no valid batch/session grouping key was available",
        "evaluation": evaluation,
        "limitations": [
            "Starter dataset provenance and label-generation process are undocumented.",
            "High class has very few examples and test support is small.",
            "No batch or session identifier exists for grouped splitting.",
            "ethylene_ppm calibration and physical sensor provenance are unverified.",
            "This is not a validated production model.",
        ],
    }
    metrics_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the SmartCrate exploratory spoilage-risk baseline.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path("ml/dataset/spoilage_sensor_starter.csv"),
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=Path("ml/models/spoilage_risk_baseline.joblib"),
    )
    parser.add_argument(
        "--metrics",
        type=Path,
        default=Path("ml/reports/spoilage_risk_baseline_metrics.json"),
    )
    args = parser.parse_args()
    result = train(args.dataset, args.model, args.metrics)
    print(json.dumps(result["evaluation"], indent=2))
    print(f"model_artifact={args.model}")
    print(f"metrics_report={args.metrics}")


if __name__ == "__main__":
    main()
