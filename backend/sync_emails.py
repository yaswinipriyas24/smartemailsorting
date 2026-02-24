# backend/sync_emails.py

from sqlalchemy.exc import SQLAlchemyError
from backend.database import SessionLocal
from backend.email_fetcher import fetch_emails_for_user
from backend.ml_model import classify_email
from backend.store_email import store_email
from backend.models import Email
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# ------------------------------------------------------------------
# NOTE: This function is defined HERE. It should NOT be imported.
# ------------------------------------------------------------------
def sync_emails(user_id: int, limit: int = 50, clear_db: bool = False):
    """
    Sync emails for a specific user.
    """
    db = SessionLocal()

    try:
        # 1. Optional Clear
        if clear_db:
            logging.info(f"Clearing emails for user {user_id}...")
            db.query(Email).filter(Email.user_id == user_id).delete()
            db.commit()

        # 2. Fetch
        emails = fetch_emails_for_user(user_id, limit)
        logging.info(f"Fetched {len(emails)} emails")

        stored_count = 0
        category_counter = {}

        # 3. Process
        for email in emails:
            try:
                # Classify
                ml_result = classify_email(
                    email.get("subject", ""),
                    email.get("body", "")
                )

                # Prepare Payload
                payload = {
                    **email,
                    **ml_result,
                    "user_id": user_id
                }

                # Store
                saved = store_email(db, payload)

                if saved:
                    stored_count += 1
                    cat = ml_result.get("category", "Unknown")
                    category_counter[cat] = category_counter.get(cat, 0) + 1
                    
                    logging.info(f"Stored | {email.get('subject', '')[:30]}... -> {cat}")

            except Exception as e:
                logging.error(f"Skipped email: {str(e)}")
                continue

        return {
            "status": "success",
            "fetched": len(emails),
            "stored": stored_count,
            "category_distribution": category_counter
        }

    except SQLAlchemyError as db_error:
        db.rollback()
        logging.error(f"Database Error: {str(db_error)}")
        return {"status": "error", "message": "Database error"}

    except Exception as e:
        logging.error(f"Unexpected Error: {str(e)}")
        return {"status": "error", "message": str(e)}

    finally:
        db.close()