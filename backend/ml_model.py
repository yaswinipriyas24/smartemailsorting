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
LABEL_ENCODER_PATH = os.path.join(BASE_DIR, "backend", "label_encoder.pkl")

# -------------------------------------------------
# Load TF-IDF model (PRIMARY BRAIN)
# -------------------------------------------------
tfidf_bundle = joblib.load(TFIDF_MODEL_PATH)
tfidf_vectorizer = tfidf_bundle["vectorizer"]
tfidf_classifier = tfidf_bundle["classifier"]

# -------------------------------------------------
# Load DistilBERT (ARCHITECTURAL BACKUP ONLY)
# -------------------------------------------------
tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
bert_model = TFDistilBertForSequenceClassification.from_pretrained(BERT_MODEL_PATH)

# -------------------------------------------------
# Load label encoder
# -------------------------------------------------
label_encoder = joblib.load(LABEL_ENCODER_PATH)

# -------------------------------------------------
# Load spaCy for deadline extraction
# -------------------------------------------------
nlp = spacy.load("en_core_web_sm")

# -------------------------------------------------
# Urgency keywords
# -------------------------------------------------
URGENT_KEYWORDS = [
    "urgent", "asap", "immediately", "deadline", "due",
    "today", "tomorrow", "now", "few days left",
    "last chance", "action required", "unlock now",
    "ending soon", "pay now", "submit today"
]

# -------------------------------------------------
# Category rule keywords
# -------------------------------------------------
MARKETING_KEYWORDS = [
    "offer", "promotion", "discount", "unlock",
    "limited time", "few days left", "deal",
    "start shipping", "no extra setup"
]

HR_KEYWORDS = ["leave", "hr", "payroll"]
REMINDER_KEYWORDS = ["reminder"]
ANNOUNCEMENT_KEYWORDS = ["office", "closed", "holiday", "notice"]

# -------------------------------------------------
# Main prediction function
# -------------------------------------------------
def classify_email(subject, body):
    text = subject + " " + body
    text_lower = text.lower()

    # ---------- TF-IDF Prediction ----------
    tfidf_vec = tfidf_vectorizer.transform([text])
    tfidf_probs = tfidf_classifier.predict_proba(tfidf_vec)[0]

    confidence = float(np.max(tfidf_probs))
    index = int(np.argmax(tfidf_probs))
    final_label = tfidf_classifier.classes_[index]

    model_used = "TF-IDF"

    # ---------- RULE-BASED CATEGORY CORRECTIONS ----------
    if any(word in text_lower for word in MARKETING_KEYWORDS):
        final_label = "Marketing"

    elif any(word in text_lower for word in HR_KEYWORDS):
        final_label = "Human Resources"

    elif any(word in text_lower for word in REMINDER_KEYWORDS):
        final_label = "Reminders"

    elif any(word in text_lower for word in ANNOUNCEMENT_KEYWORDS):
        final_label = "Announcements"

    elif "contract" in text_lower or "agreement" in text_lower:
        final_label = "Legal"

    elif "welcome" in text_lower or "joining" in text_lower:
        final_label = "General Communication"


    # ---------- Deadline extraction ----------
    doc = nlp(body)
    deadlines = [ent.text for ent in doc.ents if ent.label_ in ["DATE", "TIME"]]

    # ---------- Urgency detection ----------
    urgent = False

    if deadlines:
        urgent = True

    for word in URGENT_KEYWORDS:
        if word in text_lower:
            urgent = True
            break

    return {
        "category": final_label,
        "confidence": round(confidence, 3),
        "model_used": model_used,
        "urgent": urgent,
        "deadlines": deadlines
    }
