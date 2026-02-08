import pandas as pd
from sklearn.model_selection import train_test_split

df = pd.read_csv("dataset/emails.csv")

print("\n📊 BASIC INFO")
print("Total records:", len(df))
print("Total columns:", df.shape[1])

print("\n📌 Column names:")
print(df.columns.tolist())

print("\n❓ Missing values per column:")
print(df.isnull().sum())

print("\n⚖️ Category distribution:")
print(df['label'].value_counts())

print("\n🧹 Duplicate rows:", df.duplicated().sum())

df['text_length'] = df['subject'].str.len() + df['body'].str.len()
print("\n📝 Text length stats:")
print(df['text_length'].describe())

X_train, X_test, y_train, y_test = train_test_split(
    df[['subject', 'body']],
    df['label'],
    test_size=0.2,
    random_state=42
)

print("\n📦 TRAIN–TEST SPLIT")
print("Training size:", len(X_train))
print("Testing size:", len(X_test))
