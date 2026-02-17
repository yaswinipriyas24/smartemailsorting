# backend/ml_model.py

import os
import joblib
import numpy as np
import tensorflow as tf
import spacy
from transformers import DistilBertTokenizerFast, TFDistilBertForSequenceClassification

# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TFIDF_MODEL_PATH = os.path.join(BASE_DIR, "backend", "tfidf_model.pkl")
BERT_MODEL_PATH = os.path.join(BASE_DIR, "backend", "email_sort_model")

# -------------------------------------------------
# Load TF-IDF model
# -------------------------------------------------
tfidf_bundle = joblib.load(TFIDF_MODEL_PATH)
vectorizer = tfidf_bundle["vectorizer"]
classifier = tfidf_bundle["classifier"]

# -------------------------------------------------
# Load DistilBERT
# -------------------------------------------------
tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
bert_model = TFDistilBertForSequenceClassification.from_pretrained(BERT_MODEL_PATH)

# -------------------------------------------------
# NLP + rules
# -------------------------------------------------
nlp = spacy.load("en_core_web_sm")

URGENT_WORDS = [
    "urgent", "asap", "deadline", "today", "tomorrow",
    "few days left", "pay now", "action required"
]

MARKETING_WORDS = [
    "offer", "promotion", "discount", "unlock",
    "limited time", "deal"
]

# -------------------------------------------------
# ✅ MAIN FUNCTION (THIS WAS THE PROBLEM)
# -------------------------------------------------
# -------------------------------------------------
# ✅ MAIN FUNCTION (UPDATED SMART LOGIC)
# -------------------------------------------------
def classify_email(subject: str, body: str):
    text = f"{subject} {body}"
    text_lower = text.lower()

    # ---------------------------------------
    # 🔹 TF-IDF prediction
    # ---------------------------------------
    vec = vectorizer.transform([text_lower])
    probs = classifier.predict_proba(vec)[0]

    confidence = float(np.max(probs))
    label = classifier.classes_[np.argmax(probs)]

    # ---------------------------------------
    # 🔹 Deadline extraction
    # ---------------------------------------
    doc = nlp(body)
    deadlines = [e.text for e in doc.ents if e.label_ in ["DATE", "TIME"]]

    # ---------------------------------------
    # 🔹 Smart Urgency Rules
    # ---------------------------------------

    # 1️⃣ Strong urgency keywords
    has_urgent_words = any(w in text_lower for w in URGENT_WORDS)

    # 2️⃣ Order-specific urgency
    order_urgent_phrases = [
        "arriving today",
        "out for delivery",
        "dispatched",
        "delivery today",
        "shipped today"
    ]

    is_order_urgent = (
        label == "Orders"
        and any(p in text_lower for p in order_urgent_phrases)
    )

    # 3️⃣ Marketing should NEVER be urgent
    if label == "Marketing":
        urgent = False
    else:
        urgent = bool(deadlines or has_urgent_words or is_order_urgent)

    return {
        "category": label,
        "confidence": round(confidence, 3),
        "urgent": urgent,
        "deadlines": deadlines
    }
