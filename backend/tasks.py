from datetime import datetime

from backend.celery_worker import celery_app
from backend.database import SessionLocal
from backend.models import User, UserProfile
from backend.sync_emails import sync_emails


@celery_app.task(name="backend.sync_user_emails")
def sync_user_emails_task(user_id: int, limit: int = 20, clear_db: bool = False):
    result = sync_emails(user_id=user_id, limit=limit, clear_db=clear_db)

    db = SessionLocal()
    try:
        if result.get("status") == "success":
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
                if not profile:
                    profile = UserProfile(user_id=user_id)
                    db.add(profile)
                profile.last_sync_at = datetime.utcnow()
                profile.total_syncs = int(profile.total_syncs or 0) + 1
                db.commit()
        return result
    finally:
        db.close()
