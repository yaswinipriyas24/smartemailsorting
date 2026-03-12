import json
import os
from datetime import datetime, timezone

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "backend", "artifacts", "models")


def train_tfidf_model(df, test_size: float = 0.2, random_state: int = 42) -> dict:
    df = df.copy()
    df["text"] = df["subject"] + " " + df["body"]

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["label"],
        test_size=test_size,
        random_state=random_state,
        stratify=df["label"],
    )

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=30000,
        stop_words="english",
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    classifier = LogisticRegression(max_iter=2000, class_weight="balanced")
    classifier.fit(X_train_vec, y_train)

    y_pred = classifier.predict(X_test_vec)
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1_macro": float(f1_score(y_test, y_pred, average="macro")),
        "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        "samples_train": int(len(X_train)),
        "samples_test": int(len(X_test)),
    }

    run_id = f"tfidf-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    artifact_dir = os.path.join(MODELS_DIR, run_id)
    os.makedirs(artifact_dir, exist_ok=True)

    joblib.dump(
        {
            "vectorizer": vectorizer,
            "classifier": classifier,
            "model_type": "tfidf",
        },
        os.path.join(artifact_dir, "model_bundle.joblib"),
    )

    metadata = {
        "run_id": run_id,
        "model_type": "tfidf",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "accuracy": metrics["accuracy"],
            "f1_macro": metrics["f1_macro"],
        },
    }
    with open(os.path.join(artifact_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return {
        "run_id": run_id,
        "artifact_dir": artifact_dir,
        "metrics": metrics,
    }
