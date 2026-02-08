import pandas as pd
import joblib
import os

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")
MODEL_PATH = os.path.join(BASE_DIR, "backend", "tfidf_model.pkl")

# -------------------------------------------------
# Load dataset
# -------------------------------------------------
df = pd.read_csv(DATA_PATH)

# Combine subject + body
df["text"] = df["subject"] + " " + df["body"]

X = df["text"]
y = df["label"]

# -------------------------------------------------
# Train-test split
# -------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# -------------------------------------------------
# TF-IDF Vectorizer
# -------------------------------------------------
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=30000,
    stop_words="english"
)

X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

# -------------------------------------------------
# Logistic Regression Classifier
# -------------------------------------------------
classifier = LogisticRegression(
    max_iter=2000,
    n_jobs=-1
)

classifier.fit(X_train_vec, y_train)

# -------------------------------------------------
# Evaluation
# -------------------------------------------------
y_pred = classifier.predict(X_test_vec)
acc = accuracy_score(y_test, y_pred)

print("\n✅ TF-IDF BASELINE RESULTS")
print(f"Accuracy: {acc:.4f}")
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# -------------------------------------------------
# Save model + vectorizer
# -------------------------------------------------
joblib.dump(
    {
        "vectorizer": vectorizer,
        "classifier": classifier
    },
    MODEL_PATH
)

print(f"\n✅ TF-IDF model saved successfully at:\n{MODEL_PATH}")
