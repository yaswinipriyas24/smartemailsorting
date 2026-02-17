from backend.email_fetcher import fetch_emails

if __name__ == "__main__":
    emails = fetch_emails(limit=5)
    for e in emails:
        print("\n📧 EMAIL")
        print("ID:", e["email_id"])
        print("From:", e["sender"])
        print("Subject:", e["subject"])
        print("Body:", e["body"][:200])
