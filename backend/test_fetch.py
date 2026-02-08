from email_fetcher import fetch_all_emails

emails = fetch_all_emails(5)

for e in emails:
    print("\n📧 EMAIL")
    print("ID:", e["email_id"])
    print("From:", e["sender"])
    print("Subject:", e["subject"])
    print("Body:", e["body"][:200])
