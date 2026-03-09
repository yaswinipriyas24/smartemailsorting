# backend/ml_model.py

import os
import logging
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
LABEL_ENCODER_PATH = os.path.join(BASE_DIR, "backend", "label_encoder.pkl")

logger = logging.getLogger(__name__)

# -------------------------------------------------
# Load models (prefer transformer, fallback to TF-IDF)
# -------------------------------------------------
label_encoder = joblib.load(LABEL_ENCODER_PATH)
tfidf_bundle = joblib.load(TFIDF_MODEL_PATH)
vectorizer = tfidf_bundle["vectorizer"]
classifier = tfidf_bundle["classifier"]

USE_TRANSFORMER = True
try:
    tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
    bert_model = TFDistilBertForSequenceClassification.from_pretrained(BERT_MODEL_PATH)
except Exception as exc:
    USE_TRANSFORMER = False
    tokenizer = None
    bert_model = None
    logger.warning("Transformer model unavailable, using TF-IDF fallback: %s", exc)

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
# MAIN FUNCTION (UPDATED SMART LOGIC)
# -------------------------------------------------
def classify_email(subject: str, body: str):
    text = f"{subject} {body}"
    text_lower = text.lower()

    # ---------------------------------------
    # DistilBERT prediction (with TF-IDF fallback)
    # ---------------------------------------
    if USE_TRANSFORMER and tokenizer is not None and bert_model is not None:
        inputs = tokenizer(text, truncation=True, padding=True, max_length=128, return_tensors="tf")
        logits = bert_model(inputs).logits
        probs = tf.nn.softmax(logits, axis=1).numpy()[0]

        confidence = float(np.max(probs))
        label_idx = np.argmax(probs)
        label = label_encoder.inverse_transform([label_idx])[0]
    else:
        vec = vectorizer.transform([text_lower])
        probs = classifier.predict_proba(vec)[0]
        confidence = float(np.max(probs))
        label = classifier.classes_[np.argmax(probs)]

    # ---------------------------------------
    # Deadline extraction
    # ---------------------------------------
    doc = nlp(body)
    deadlines = [e.text for e in doc.ents if e.label_ in ["DATE", "TIME"]]

    # ---------------------------------------
    # Smart Urgency Rules
    # ---------------------------------------

    # 1. Strong urgency keywords
    has_urgent_words = any(w in text_lower for w in URGENT_WORDS)

    #  2. Order-specific urgency
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

    # 3️. Marketing should NEVER be urgent
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
