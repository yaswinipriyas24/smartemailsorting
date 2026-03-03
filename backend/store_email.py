# backend/store_email.py

from sqlalchemy.orm import Session
from backend.models import Email
from backend.deadline_extractor import extract_deadline


def store_email(db: Session, email_data: dict):
    """
    Store classified email into database

    Features:
    - Prevent duplicates per user (email_id + user_id)
    - Extract deadline intelligence
    - Auto-mark urgent if deadline <= 2 days
    - Update existing record if already present
    """

    user_id = email_data.get("user_id")

    if not user_id:
        raise ValueError("user_id is required to store email")

    # -------------------------------------------------
    # 1. Check if email already exists for this user
    # -------------------------------------------------
    existing = db.query(Email).filter(
        Email.email_id == email_data["email_id"],
        Email.user_id == user_id
    ).first()
    incoming_is_read = bool(email_data.get("is_read", False))

    # -------------------------------------------------
    # 2. Deadline Intelligence
    # -------------------------------------------------
    full_text = f"{email_data.get('subject', '')} {email_data.get('body', '')}"
    deadline_info = extract_deadline(full_text)

    deadline_date = None
    days_remaining = None

    # ML predicted urgency
    urgent_flag = email_data.get("urgent", False)

    if deadline_info:
        deadline_date = deadline_info.get("deadline_date")
        days_remaining = deadline_info.get("days_remaining")

        # Auto-mark urgent if <= 2 days
        if days_remaining is not None and days_remaining <= 2:
            urgent_flag = True

    # -------------------------------------------------
    # 3. If Exists → Update Instead of Recreating
    # -------------------------------------------------
    if existing:
        existing.category = email_data.get("category")
        existing.confidence = email_data.get("confidence")
        existing.urgent = urgent_flag
        existing.deadline_date = deadline_date
        existing.days_remaining = days_remaining
        existing.deadlines = ", ".join(email_data.get("deadlines", []) or [])
        # Preserve manual resolve if already True; otherwise sync from Gmail read status.
        existing.is_read = bool(existing.is_read) or incoming_is_read

        db.commit()
        db.refresh(existing)
        return existing

    # -------------------------------------------------
    # 4️. Create New Email
    # -------------------------------------------------
    email = Email(
        email_id=email_data["email_id"],
        sender=email_data.get("sender"),
        subject=email_data.get("subject"),
        body=email_data.get("body"),
        received_at=email_data.get("received_at"),

        category=email_data.get("category"),
        confidence=email_data.get("confidence"),
        urgent=urgent_flag,

        deadlines=", ".join(email_data.get("deadlines", []) or []),

        deadline_date=deadline_date,
        days_remaining=days_remaining,

        user_id=user_id,

        is_read=incoming_is_read,
        is_processed=True
    )

    db.add(email)
    db.commit()
    db.refresh(email)

    return email
