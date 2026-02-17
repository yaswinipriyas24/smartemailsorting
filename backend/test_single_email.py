import pandas as pd

df = pd.read_csv("dataset/emails.csv")
print(df["category"].value_counts())
