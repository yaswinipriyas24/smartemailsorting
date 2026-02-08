from backend.database import SessionLocal
from backend.models import Email


def store_email(email_data: dict):
    """
    Store classified email into PostgreSQL database
    """
    db = SessionLocal()

    try:
        email = Email(
            email_id=email_data["email_id"],
            sender=email_data.get("sender"),
            subject=email_data.get("subject"),
            body=email_data.get("body"),
            received_at=email_data.get("received_at"),

            category=email_data.get("category"),
            confidence=email_data.get("confidence"),
            urgent=email_data.get("urgent"),
            deadlines=", ".join(email_data.get("deadlines", [])),

            is_read=False,
            is_processed=True
        )

        db.add(email)
        db.commit()
        db.refresh(email)

        return email

    except Exception as e:
        db.rollback()
        raise e

    finally:
        db.close()
