import pandas as pd
import spacy

# Load SpaCy English model
nlp = spacy.load("en_core_web_sm")

# Load dataset
df = pd.read_csv("dataset/emails.csv")

# Combine subject + body
df["text"] = df["subject"] + " " + df["body"]

# Function to extract deadlines
def extract_deadlines(text):
    doc = nlp(text)
    dates = []
    for ent in doc.ents:
        if ent.label_ in ["DATE", "TIME"]:
            dates.append(ent.text)
    return dates

# Apply extraction
df["deadlines"] = df["text"].apply(extract_deadlines)

# Mark urgent emails
df["is_urgent"] = df["deadlines"].apply(lambda x: True if len(x) > 0 else False)

# Show sample results
print("\n📅 SAMPLE DEADLINE EXTRACTION:\n")
print(df[["subject", "deadlines", "is_urgent"]].head(10))

print("\n🚨 Urgent email count:", df["is_urgent"].sum())
