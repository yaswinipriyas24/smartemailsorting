from sqlalchemy.orm import Session
from backend.models import Email


def store_email(db: Session, email_data: dict):
    """
    Store a classified email into PostgreSQL.
    Avoids duplicates using email_id.
    """

    # 🔍 Check for existing email (idempotency)
    existing_email = db.query(Email).filter(
        Email.email_id == email_data["email_id"]
    ).first()

    if existing_email:
        return existing_email

    email = Email(
        email_id=email_data["email_id"],
        sender=email_data.get("sender"),
        subject=email_data.get("subject"),
        body=email_data.get("body"),
        received_at=email_data.get("received_at"),

        category=email_data.get("category"),
        confidence=email_data.get("confidence"),
        urgent=email_data.get("urgent", False),
        deadlines=", ".join(email_data.get("deadlines", [])),

        is_read=False,
        is_processed=True
    )

    db.add(email)
    db.commit()
    db.refresh(email)

    return email
