import argparse
import json
import os

from backend.mlops.data_validation import validate_dataset
from backend.mlops.registry import promote_model, register_model
from backend.mlops.train import train_tfidf_model


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DATASET = os.path.join(BASE_DIR, "dataset", "emails.csv")
DEFAULT_REPORT = os.path.join(BASE_DIR, "backend", "artifacts", "last_mlops_report.json")


def run_mlops_cycle(
    dataset_path: str = DEFAULT_DATASET,
    min_f1_macro: float = 0.60,
    promote_on_pass: bool = True,
) -> dict:
    df, data_stats = validate_dataset(dataset_path)
    train_result = train_tfidf_model(df)

    metrics = train_result["metrics"]
    artifact_dir = train_result["artifact_dir"]
    run_id = train_result["run_id"]

    rel_artifact_dir = os.path.relpath(artifact_dir, BASE_DIR)
    model_id = register_model(
        model_type="tfidf",
        artifact_dir=rel_artifact_dir,
        metrics={
            "accuracy": metrics["accuracy"],
            "f1_macro": metrics["f1_macro"],
        },
        data_snapshot={
            "dataset_path": os.path.relpath(dataset_path, BASE_DIR),
            "rows_valid": data_stats["rows_valid"],
            "num_labels": data_stats["num_labels"],
        },
    )

    passed = metrics["f1_macro"] >= min_f1_macro
    promoted = False
    if promote_on_pass and passed:
        promote_model(model_id)
        promoted = True

    report = {
        "run_id": run_id,
        "model_id": model_id,
        "dataset": data_stats,
        "metrics": {
            "accuracy": metrics["accuracy"],
            "f1_macro": metrics["f1_macro"],
        },
        "threshold": {"min_f1_macro": min_f1_macro, "passed": passed},
        "promoted": promoted,
        "artifact_dir": rel_artifact_dir,
    }

    os.makedirs(os.path.dirname(DEFAULT_REPORT), exist_ok=True)
    with open(DEFAULT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run complete MLOps lifecycle for Smart Email Sorting")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="Path to CSV dataset")
    parser.add_argument("--min-f1", type=float, default=0.60, help="Minimum macro F1 required for promotion")
    parser.add_argument(
        "--no-promote",
        action="store_true",
        help="Train/register only; do not promote to production",
    )
    args = parser.parse_args()

    report = run_mlops_cycle(
        dataset_path=args.dataset,
        min_f1_macro=args.min_f1,
        promote_on_pass=not args.no_promote,
    )

    print("MLOps lifecycle completed")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
