import os
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from transformers import DistilBertTokenizerFast, TFDistilBertForSequenceClassification
import joblib

# --------------------------------------------------
# 1. Resolve dataset path safely (NO path errors)
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")

# --------------------------------------------------
# 2. Load dataset
# --------------------------------------------------
df = pd.read_csv(DATA_PATH)

# 🔽 SAFE MODE: use subset to avoid long CPU training
df = df.sample(2000, random_state=42)

# Combine subject + body
df["text"] = df["subject"] + " " + df["body"]

# --------------------------------------------------
# 3. Encode labels
# --------------------------------------------------
label_encoder = LabelEncoder()
df["label_encoded"] = label_encoder.fit_transform(df["label"])
num_labels = df["label_encoded"].nunique()

# --------------------------------------------------
# 4. Train-test split
# --------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    df["text"],
    df["label_encoded"],
    test_size=0.2,
    random_state=42
)

# --------------------------------------------------
# 5. Tokenizer
# --------------------------------------------------
tokenizer = DistilBertTokenizerFast.from_pretrained(
    "distilbert-base-uncased"
)

train_encodings = tokenizer(
    list(X_train),
    truncation=True,
    padding=True,
    max_length=128
)

test_encodings = tokenizer(
    list(X_test),
    truncation=True,
    padding=True,
    max_length=128
)

# --------------------------------------------------
# 6. TensorFlow datasets
# --------------------------------------------------
train_dataset = tf.data.Dataset.from_tensor_slices((
    dict(train_encodings),
    y_train
)).batch(4)

test_dataset = tf.data.Dataset.from_tensor_slices((
    dict(test_encodings),
    y_test
)).batch(4)

# --------------------------------------------------
# 7. Load DistilBERT (CRITICAL FIX: from_pt=True)
# --------------------------------------------------
model = TFDistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=num_labels,
    from_pt=True
)

# --------------------------------------------------
# 8. Compile model (Keras-3 SAFE)
# --------------------------------------------------
model.compile(
    optimizer="adam",
    loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=["accuracy"]
)

# --------------------------------------------------
# 9. Train
# --------------------------------------------------
print("\n🚀 Starting DistilBERT training...\n")

model.fit(
    train_dataset,
    validation_data=test_dataset,
    epochs=3
)

# --------------------------------------------------
# 10. Save model & encoder
# --------------------------------------------------
MODEL_DIR = os.path.join(BASE_DIR, "backend", "email_sort_model")
model.save_pretrained(MODEL_DIR)

joblib.dump(
    label_encoder,
    os.path.join(BASE_DIR, "backend", "label_encoder.pkl")
)

print("\n✅ Model training completed and saved successfully!")
