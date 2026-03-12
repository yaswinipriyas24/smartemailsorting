import os
from pprint import pprint

from backend.mlops.pipeline import run_mlops_cycle

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")


if __name__ == "__main__":
    report = run_mlops_cycle(
        dataset_path=DATA_PATH,
        min_f1_macro=0.60,
        promote_on_pass=True,
    )
    print("\nMLOps training lifecycle completed via tfidf_train.py")
    pprint(report)
