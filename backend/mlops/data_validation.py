import os
import pandas as pd


REQUIRED_COLUMNS = ["subject", "body", "label"]


def validate_dataset(dataset_path: str) -> tuple[pd.DataFrame, dict]:
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    df = pd.read_csv(dataset_path)

    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    initial_rows = len(df)
    df = df.dropna(subset=REQUIRED_COLUMNS).copy()
    dropped_missing = initial_rows - len(df)

    for col in ["subject", "body", "label"]:
        df[col] = df[col].astype(str).str.strip()

    before_empty = len(df)
    df = df[(df["subject"] != "") & (df["body"] != "") & (df["label"] != "")]
    dropped_empty = before_empty - len(df)

    before_dupes = len(df)
    df = df.drop_duplicates(subset=["subject", "body", "label"])
    dropped_duplicates = before_dupes - len(df)

    label_counts = df["label"].value_counts().to_dict()
    if len(label_counts) < 2:
        raise ValueError("Need at least 2 labels for classification")

    stats = {
        "rows_initial": initial_rows,
        "rows_valid": len(df),
        "dropped_missing": dropped_missing,
        "dropped_empty": dropped_empty,
        "dropped_duplicates": dropped_duplicates,
        "num_labels": len(label_counts),
        "label_distribution": label_counts,
    }

    return df.reset_index(drop=True), stats
