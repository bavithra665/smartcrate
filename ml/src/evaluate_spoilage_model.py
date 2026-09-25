from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from joblib import load
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocessing import ALLOWED_TARGETS, FEATURES, TARGET, load_dataset  # noqa: E402

RANDOM_STATE = 42
TEST_SIZE = 0.2


def evaluate(dataset_path: Path, model_path: Path) -> dict:
    frame = load_dataset(dataset_path)
    _, x_test, _, y_test = train_test_split(
        frame[FEATURES],
        frame[TARGET],
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=frame[TARGET],
    )
    model = load(model_path)
    predictions = model.predict(x_test)
    report = classification_report(
        y_test,
        predictions,
        labels=ALLOWED_TARGETS,
        output_dict=True,
        zero_division=0,
    )
    return {
        "class_distribution": y_test.value_counts().reindex(ALLOWED_TARGETS, fill_value=0).to_dict(),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=ALLOWED_TARGETS).tolist(),
        "labels": ALLOWED_TARGETS,
        "precision_per_class": {label: report[label]["precision"] for label in ALLOWED_TARGETS},
        "recall_per_class": {label: report[label]["recall"] for label in ALLOWED_TARGETS},
        "f1_per_class": {label: report[label]["f1-score"] for label in ALLOWED_TARGETS},
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the saved SmartCrate exploratory baseline.")
    parser.add_argument("--dataset", type=Path, default=Path("ml/dataset/spoilage_sensor_starter.csv"))
    parser.add_argument("--model", type=Path, default=Path("ml/models/spoilage_risk_baseline.joblib"))
    args = parser.parse_args()
    print(json.dumps(evaluate(args.dataset, args.model), indent=2))


if __name__ == "__main__":
    main()
