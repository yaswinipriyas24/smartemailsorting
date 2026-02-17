# backend/pipeline.py

from backend.email_fetcher import fetch_emails_for_user
from backend.ml_model import classify_email
from backend.database import SessionLocal
from backend.store_email import store_email
from backend.models import Email
import logging


logging.basicConfig(level=logging.INFO)


def run_pipeline(user_id: int, limit: int = 50, clear_existing: bool = False):
    """
    End-to-end email intelligence pipeline

    Flow:
    Fetch → Classify → Deadline Extraction → Store → Summary

    Args:
        user_id (int): Logged-in user ID (for isolation)
        limit (int): Number of emails to fetch
        clear_existing (bool): Optional full refresh
    """

    db = SessionLocal()

    try:
        logging.info("🚀 Starting Smart Email Pipeline")

        # ---------------------------------------
        # Optional Full Refresh
        # ---------------------------------------
        if clear_existing:
            logging.info("🗑 Clearing existing emails for user")
            db.query(Email).filter(Email.user_id == user_id).delete()
            db.commit()

        # ---------------------------------------
        # Step 1 — Fetch (using this user's Gmail tokens)
        # ---------------------------------------
        emails = fetch_emails_for_user(user_id, limit)
        logging.info(f"📥 Fetched {len(emails)} emails")

        stored_count = 0
        category_counter = {}

        # ---------------------------------------
        # Step 2 — Process Each Email
        # ---------------------------------------
        for email in emails:

            try:
                # Classification
                ml_result = classify_email(
                    email.get("subject", ""),
                    email.get("body", "")
                )

                payload = {
                    **email,
                    **ml_result,
                    "user_id": user_id
                }

                saved = store_email(db, payload)

                if saved:
                    stored_count += 1
                    cat = saved.category
                    category_counter[cat] = category_counter.get(cat, 0) + 1

                    logging.info(
                        f"✅ Stored: {(saved.subject or '')[:40]} → {saved.category}"
                    )

            except Exception as e:
                logging.error(f"❌ Failed processing email: {e}")

        # ---------------------------------------
        # Summary
        # ---------------------------------------
        logging.info("📊 Category Distribution:")
        for cat, count in category_counter.items():
            logging.info(f"   {cat}: {count}")

        logging.info("🎯 Pipeline Completed Successfully")

        return {
            "fetched": len(emails),
            "stored": stored_count,
            "categories": category_counter
        }

    finally:
        db.close()
