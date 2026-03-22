import os
from pprint import pprint

from backend.mlops.data_validation import validate_dataset


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")


if __name__ == "__main__":
    df, stats = validate_dataset(DATASET_PATH)
    print("\nDataset validation passed")
    pprint(stats)
    print(f"\nSample valid records: {len(df)}")
