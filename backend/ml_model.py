import os
import logging
import joblib
import numpy as np
import tensorflow as tf
import spacy
from transformers import DistilBertTokenizerFast, TFDistilBertForSequenceClassification

from backend.mlops.registry import get_production_model

# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LEGACY_TFIDF_MODEL_PATH = os.path.join(BASE_DIR, "backend", "tfidf_model.pkl")
BERT_MODEL_PATH = os.path.join(BASE_DIR, "backend", "email_sort_model")
LABEL_ENCODER_PATH = os.path.join(BASE_DIR, "backend", "label_encoder.pkl")

logger = logging.getLogger(__name__)

def _resolve_tfidf_bundle_path() -> str:
    production = get_production_model()
    if production and production.get("model_type") == "tfidf":
        artifact_dir = production.get("artifact_dir")
        if artifact_dir:
            bundle_path = os.path.join(BASE_DIR, artifact_dir, "model_bundle.joblib")
            if os.path.exists(bundle_path):
                return bundle_path
    return LEGACY_TFIDF_MODEL_PATH


def _load_tfidf_models() -> tuple:
    bundle_path = _resolve_tfidf_bundle_path()
    if not os.path.exists(bundle_path):
        raise FileNotFoundError(
            "No TF-IDF model bundle found. Run `python -m backend.mlops.pipeline` to train and register one."
        )
    bundle = joblib.load(bundle_path)
    return bundle["vectorizer"], bundle["classifier"], bundle_path


def _load_transformer_models() -> tuple:
    label_encoder = joblib.load(LABEL_ENCODER_PATH)
    tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
    bert_model = TFDistilBertForSequenceClassification.from_pretrained(BERT_MODEL_PATH)
    return label_encoder, tokenizer, bert_model


MODEL_BACKEND = os.getenv("MODEL_BACKEND", "tfidf").strip().lower()

vectorizer, classifier, tfidf_bundle_path = _load_tfidf_models()
logger.info("Loaded TF-IDF bundle from: %s", tfidf_bundle_path)

USE_TRANSFORMER = MODEL_BACKEND == "transformer"
label_encoder = None
tokenizer = None
bert_model = None

if USE_TRANSFORMER:
    try:
        label_encoder, tokenizer, bert_model = _load_transformer_models()
    except Exception as exc:
        USE_TRANSFORMER = False
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
