import os

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")
OUTPUT_PLOT_PATH = os.path.join(BASE_DIR, "backend", "artifacts", "email_sorting_training_curves.png")

EPOCHS = 5


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATASET_PATH)
    df["text"] = df["subject"].fillna("") + " " + df["body"].fillna("")
    return df


def build_history(df: pd.DataFrame) -> tuple[list[float], list[float], list[float], list[float]]:
    X_train, X_val, y_train, y_val = train_test_split(
        df["text"],
        df["label"],
        test_size=0.2,
        random_state=42,
        stratify=df["label"],
    )

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=15000,
        stop_words="english",
    )

    X_train_vec = vectorizer.fit_transform(X_train)
    X_val_vec = vectorizer.transform(X_val)

    classifier = SGDClassifier(
        loss="log_loss",
        max_iter=1,
        tol=None,
        random_state=42,
    )

    classes = sorted(y_train.unique())
    train_accuracy_history = []
    val_accuracy_history = []
    train_loss_history = []
    val_loss_history = []

    for epoch in range(EPOCHS):
        classifier.partial_fit(X_train_vec, y_train, classes=classes)

        train_pred = classifier.predict(X_train_vec)
        val_pred = classifier.predict(X_val_vec)
        train_proba = classifier.predict_proba(X_train_vec)
        val_proba = classifier.predict_proba(X_val_vec)

        train_accuracy = accuracy_score(y_train, train_pred)
        val_accuracy = accuracy_score(y_val, val_pred)
        train_loss = log_loss(y_train, train_proba, labels=classifier.classes_)
        val_loss = log_loss(y_val, val_proba, labels=classifier.classes_)

        train_accuracy_history.append(round(train_accuracy, 4))
        val_accuracy_history.append(round(val_accuracy, 4))
        train_loss_history.append(round(train_loss, 4))
        val_loss_history.append(round(val_loss, 4))

        print(
            f"Epoch {epoch + 1}/{EPOCHS} | "
            f"train_acc={train_accuracy:.4f} | val_acc={val_accuracy:.4f} | "
            f"train_loss={train_loss:.4f} | val_loss={val_loss:.4f}"
        )

    return train_accuracy_history, val_accuracy_history, train_loss_history, val_loss_history


def save_training_curves(
    train_accuracy_history: list[float],
    val_accuracy_history: list[float],
    train_loss_history: list[float],
    val_loss_history: list[float],
) -> None:
    epochs = list(range(EPOCHS))

    plt.rcParams["font.family"] = "serif"
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.8))

    axes[0].plot(epochs, train_accuracy_history, label="train", linewidth=1.5)
    axes[0].plot(epochs, val_accuracy_history, label="val", linewidth=1.5)
    axes[0].set_title("model accuracy", fontsize=9)
    axes[0].set_xlabel("")
    axes[0].set_ylabel("accuracy", fontsize=8)
    axes[0].tick_params(labelsize=8)
    axes[0].legend(loc="upper left", fontsize=7)

    axes[1].plot(epochs, train_loss_history, label="train loss", linewidth=1.5)
    axes[1].plot(epochs, val_loss_history, label="val loss", linewidth=1.5)
    axes[1].set_title("model loss", fontsize=9)
    axes[1].set_xlabel("")
    axes[1].set_ylabel("loss", fontsize=8)
    axes[1].tick_params(labelsize=8)
    axes[1].legend(loc="upper right", fontsize=7)

    fig.text(0.25, 0.02, "Figure: EMAIL SORTING ACCURACY", ha="center", fontsize=8, style="italic")
    fig.text(0.75, 0.02, "Figure: EMAIL SORTING LOSS", ha="center", fontsize=8, style="italic")

    plt.tight_layout(rect=(0, 0.06, 1, 1))
    plt.savefig(OUTPUT_PLOT_PATH, dpi=200, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    df = load_dataset()
    print("Training fast email sorting model and generating epoch graphs...")
    history = build_history(df)
    save_training_curves(*history)
    print(f"Training curve image saved to: {OUTPUT_PLOT_PATH}")


if __name__ == "__main__":
    main()
