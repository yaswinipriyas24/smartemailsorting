# -------------------------------------------------
# Smart Email Sorting System - Main Application
# -------------------------------------------------

import csv
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
import logging

from backend.database import init_db, get_db, SessionLocal
from backend.models import (
    Email,
    User,
    UserProfile,
    ModelCorrection,
    AdminEventLog,
    RetrainingRun,
)
from backend.routes import auth
from backend.auth_utils import get_current_user, require_admin, hash_password

from backend.pipeline import run_pipeline
from backend.gmail_oauth import router as gmail_router

# -------------------------------------------------
# Create FastAPI App
# -------------------------------------------------
app = FastAPI(
    title="Smart Email Sorting System",
    version="1.2.0"
)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(BASE_DIR, "dataset", "emails.csv")
TFIDF_TRAIN_SCRIPT = os.path.join(BASE_DIR, "backend", "tfidf_train.py")

ALLOWED_ROLES = {"user", "admin"}
ALLOWED_THEMES = {"light", "dark"}
ALLOWED_LANGUAGES = {"en"}
MODEL_VERSION = os.getenv("MODEL_VERSION", "tfidf-logreg-v1")
REMINDER_POLL_SECONDS = int(os.getenv("REMINDER_POLL_SECONDS", "300"))
DEFAULT_REMINDER_WINDOW_HOURS = int(os.getenv("DEFAULT_REMINDER_WINDOW_HOURS", "24"))
ALLOWED_CATEGORIES = {
    "Announcements",
    "Customer Support",
    "Deadlines",
    "General Communication",
    "Human Resources",
    "Invoices",
    "Legal",
    "Marketing",
    "Meetings",
    "Orders",
    "Payments",
    "Performance Reports",
    "Project Updates",
    "Recruitment",
    "Reminders",
    "Technical Issues",
    "Training",
}

# -------------------------------------------------
# CORS Configuration
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Initialize Database
# -------------------------------------------------
init_db()

# Include Routers
app.include_router(auth.router)
app.include_router(gmail_router)


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.get("/")
def root():
    return {"status": "Smart Email Sorting API is running"}


# =================================================
# Helpers
# =================================================
def _append_correction_to_training_data(email: Email, category: str) -> bool:
    if not email.subject and not email.body:
        return False

    os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)

    file_exists = os.path.exists(DATASET_PATH)
    next_id = int(datetime.utcnow().timestamp() * 1000)

    if file_exists:
        try:
            with open(DATASET_PATH, "r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                max_id = 0
                for row in reader:
                    raw_id = row.get("id")
                    if raw_id and str(raw_id).isdigit():
                        max_id = max(max_id, int(raw_id))
                if max_id:
                    next_id = max_id + 1
        except Exception:
            logger.exception("Unable to read current dataset max ID")

    with open(DATASET_PATH, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["id", "sender", "subject", "body", "label"])

        writer.writerow([
            next_id,
            email.sender or "unknown@manual-correction.local",
            email.subject or "(no subject)",
            email.body or "",
            category,
        ])

    return True


def _record_admin_event(db: Session, event_type: str, level: str, message: str) -> None:
    db.add(
        AdminEventLog(
            event_type=event_type,
            level=level,
            message=message,
        )
    )


def _get_user_reminder_window_hours(db: Session, user_id: int) -> int:
    default_val = max(DEFAULT_REMINDER_WINDOW_HOURS, 1)
    row = (
        db.query(AdminEventLog)
        .filter(
            AdminEventLog.event_type == "user_pref_reminder_window",
            AdminEventLog.message.like(f"user_id={user_id};hours=%"),
        )
        .order_by(AdminEventLog.created_at.desc())
        .first()
    )
    if not row or not row.message:
        return default_val

    marker = "hours="
    idx = row.message.find(marker)
    if idx < 0:
        return default_val
    raw = row.message[idx + len(marker):].strip()
    if not raw.isdigit():
        return default_val
    parsed = int(raw)
    return parsed if parsed > 0 else default_val


def _set_user_reminder_window_hours(db: Session, user_id: int, hours: int) -> None:
    safe_hours = max(int(hours), 1)
    db.add(
        AdminEventLog(
            event_type="user_pref_reminder_window",
            level="info",
            message=f"user_id={user_id};hours={safe_hours}",
        )
    )


def _get_or_create_profile(db: Session, user: User) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        return profile
    default_name = user.email.split("@")[0].replace(".", " ").replace("_", " ").title()
    profile = UserProfile(user_id=user.id, full_name=default_name)
    db.add(profile)
    db.flush()
    return profile


def _deadline_days_remaining(deadline_date: datetime, now: datetime) -> int:
    return (deadline_date.date() - now.date()).days


def _update_deadline_fields(email: Email, now: datetime) -> bool:
    if not email.deadline_date:
        if email.days_remaining is not None:
            email.days_remaining = None
            return True
        return False

    next_days = _deadline_days_remaining(email.deadline_date, now)
    changed = email.days_remaining != next_days
    if changed:
        email.days_remaining = next_days

    # Keep urgency aligned with deadlines for unresolved emails.
    if not email.is_read:
        should_be_urgent = next_days <= 2
        if bool(email.urgent) != should_be_urgent:
            email.urgent = should_be_urgent
            changed = True
    return changed


def _already_notified_today(
    db: Session,
    user_id: int,
    email_id: int,
    notification_type: str,
    now: datetime | None = None,
) -> bool:
    key_prefix = f"user_id={user_id};email_id={email_id};type={notification_type};source="
    query = db.query(AdminEventLog).filter(
        AdminEventLog.event_type == "deadline_notify",
        AdminEventLog.message.like(f"{key_prefix}%"),
    )
    if now is not None:
        day_start = datetime(now.year, now.month, now.day)
        query = query.filter(AdminEventLog.created_at >= day_start)
    row = query.first()
    return row is not None


def _build_deadline_notifications(
    db: Session,
    user: User,
    lookahead_hours: int = 24,
    persist_events: bool = True,
    source: str = "api",
):
    now = datetime.utcnow()
    soon_cutoff = now + timedelta(hours=max(int(lookahead_hours), 1))

    rows = (
        db.query(Email)
        .filter(
            Email.user_id == user.id,
            Email.deadline_date.isnot(None),
            Email.is_read.is_(False),
        )
        .order_by(Email.deadline_date.asc())
        .all()
    )

    notifications = []
    email_state_changed = False
    for email in rows:
        if _update_deadline_fields(email, now):
            email_state_changed = True

        if not email.deadline_date:
            continue

        if email.deadline_date <= now:
            payload = {
                "email_id": email.id,
                "subject": email.subject or "(No Subject)",
                "deadline_date": email.deadline_date.isoformat(),
                "type": "overdue",
                "message": "Deadline reached. Take action now.",
            }
            notifications.append(payload)
            # Overdue notifications are logged once per email to prevent warning spam.
            if persist_events and not _already_notified_today(
                db, user.id, email.id, "overdue", None
            ):
                db.add(
                    AdminEventLog(
                        event_type="deadline_notify",
                        level="warning",
                        message=f"user_id={user.id};email_id={email.id};type=overdue;source={source}",
                    )
                )
            continue

        if email.deadline_date <= soon_cutoff:
            payload = {
                "email_id": email.id,
                "subject": email.subject or "(No Subject)",
                "deadline_date": email.deadline_date.isoformat(),
                "type": "due_soon",
                "message": "Deadline approaching soon.",
            }
            notifications.append(payload)
            # Due soon reminders can repeat once per day until the email is resolved.
            if persist_events and not _already_notified_today(
                db, user.id, email.id, "due_soon", now
            ):
                db.add(
                    AdminEventLog(
                        event_type="deadline_notify",
                        level="info",
                        message=f"user_id={user.id};email_id={email.id};type=due_soon;source={source}",
                    )
                )

    if email_state_changed or persist_events:
        db.commit()

    return notifications


def _run_deadline_notification_worker() -> None:
    while True:
        db = SessionLocal()
        try:
            users = db.query(User).filter(User.is_active.is_(True)).all()
            for user in users:
                profile = _get_or_create_profile(db, user)
                if profile.notification_enabled is False:
                    continue
                user_window = _get_user_reminder_window_hours(db, user.id)
                _build_deadline_notifications(
                    db=db,
                    user=user,
                    lookahead_hours=user_window,
                    persist_events=True,
                    source="scheduler",
                )
        except Exception:
            logger.exception("Deadline reminder worker iteration failed")
        finally:
            db.close()
        time.sleep(max(REMINDER_POLL_SECONDS, 60))


@app.on_event("startup")
def start_background_workers():
    thread = threading.Thread(target=_run_deadline_notification_worker, daemon=True)
    thread.start()


# =================================================
# AUTH HELPER ENDPOINT
# =================================================
@app.get("/auth/me")
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    gmail_connected = bool(
        current_user.gmail_email and current_user.gmail_refresh_token
    )
    profile = _get_or_create_profile(db, current_user)
    reminder_window_hours = _get_user_reminder_window_hours(db, current_user.id)

    total_emails_processed = (
        db.query(func.count(Email.id))
        .filter(Email.user_id == current_user.id)
        .scalar() or 0
    )
    total_urgent_emails = (
        db.query(func.count(Email.id))
        .filter(Email.user_id == current_user.id, Email.urgent.is_(True))
        .scalar() or 0
    )

    admin_extras = {}
    if current_user.role == "admin":
        total_users = db.query(func.count(User.id)).scalar() or 0
        admin_extras = {
            "system_access_level": "full",
            "total_users_managed": max(int(total_users) - 1, 0),
            "model_version_running": MODEL_VERSION,
            "has_retraining_access": True,
        }

    db.commit()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "full_name": profile.full_name,
        "photo_url": profile.photo_url,
        "last_login_at": profile.last_login_at.isoformat() if profile.last_login_at else None,
        "last_sync_at": profile.last_sync_at.isoformat() if profile.last_sync_at else None,
        "default_category_view": profile.default_category_view,
        "notification_enabled": bool(profile.notification_enabled),
        "urgent_alert_enabled": bool(profile.urgent_alert_enabled),
        "theme": profile.theme,
        "language": profile.language,
        "reminder_window_hours": reminder_window_hours,
        "two_factor_enabled": bool(profile.two_factor_enabled),
        "token_expiry": current_user.gmail_token_expiry.isoformat() if current_user.gmail_token_expiry else None,
        "total_emails_processed": int(total_emails_processed),
        "total_urgent_emails": int(total_urgent_emails),
        "avg_response_hours": profile.avg_response_hours,
        "gmail_email": current_user.gmail_email,
        "gmail_connected": gmail_connected,
        **admin_extras,
    }


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    default_category_view: str | None = None
    notification_enabled: bool | None = None
    urgent_alert_enabled: bool | None = None
    theme: str | None = None
    language: str | None = None
    reminder_window_hours: int | None = None


@app.patch("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_or_create_profile(db, current_user)

    if payload.full_name is not None:
        profile.full_name = payload.full_name.strip() or profile.full_name
    if payload.default_category_view is not None:
        profile.default_category_view = payload.default_category_view.strip() or "All"
    if payload.notification_enabled is not None:
        profile.notification_enabled = payload.notification_enabled
    if payload.urgent_alert_enabled is not None:
        profile.urgent_alert_enabled = payload.urgent_alert_enabled
    if payload.theme is not None:
        theme = payload.theme.strip().lower()
        if theme not in ALLOWED_THEMES:
            raise HTTPException(status_code=400, detail="Invalid theme")
        profile.theme = theme
    if payload.language is not None:
        language = payload.language.strip().lower()
        if language not in ALLOWED_LANGUAGES:
            raise HTTPException(status_code=400, detail="Invalid language")
        profile.language = language
    if payload.reminder_window_hours is not None:
        if payload.reminder_window_hours < 1 or payload.reminder_window_hours > 72:
            raise HTTPException(status_code=400, detail="Invalid reminder window")
        _set_user_reminder_window_hours(db, current_user.id, payload.reminder_window_hours)

    db.commit()
    return {"message": "Profile updated successfully"}


# =================================================
# GMAIL CONNECT & SYNC CONTROLLER
# =================================================

class GmailConnect(BaseModel):
    gmail_email: str


@app.post("/connect-gmail")
def connect_gmail(
    data: GmailConnect,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.gmail_email = data.gmail_email
    db.commit()
    db.refresh(current_user)

    try:
        sync_result = run_pipeline(
            user_id=current_user.id,
            limit=20,
            clear_existing=False
        )
        profile = _get_or_create_profile(db, current_user)
        profile.last_sync_at = datetime.utcnow()
        profile.total_syncs = int(profile.total_syncs or 0) + 1
        db.commit()
        return {
            "message": "Gmail connected and initial sync completed!",
            "gmail_email": current_user.gmail_email,
            "sync_stats": sync_result
        }
    except Exception as e:
        logger.exception("Sync failed after Gmail connect")
        return {
            "message": "Gmail connected, but initial sync failed. Try syncing manually.",
            "gmail_email": current_user.gmail_email,
            "error": str(e)
        }


@app.post("/sync-emails")
def sync_emails_endpoint(
    limit: int = 20,
    clear_db: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.gmail_email or not current_user.gmail_refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Gmail OAuth not connected. Please connect Gmail."
        )

    try:
        result = run_pipeline(
            user_id=current_user.id,
            limit=limit,
            clear_existing=clear_db
        )
        if isinstance(result, dict) and result.get("status") == "error":
            logger.error("Sync returned error for user_id=%s: %s", current_user.id, result)
            raise HTTPException(
                status_code=500,
                detail=f"Sync failed: {result.get('message', 'unknown error')}"
            )
        db_profile = _get_or_create_profile(db, current_user)
        db_profile.last_sync_at = datetime.utcnow()
        db_profile.total_syncs = int(db_profile.total_syncs or 0) + 1
        db.commit()

        return {
            "status": "success",
            **(result if isinstance(result, dict) else {"data": result})
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Sync exception for user_id=%s", current_user.id)
        msg = str(e)
        lowered = msg.lower()
        if (
            "invalid_grant" in lowered
            or "token has been expired or revoked" in lowered
            or "refresh token" in lowered
        ):
            current_user.gmail_access_token = None
            current_user.gmail_refresh_token = None
            current_user.gmail_token_expiry = None
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Gmail token expired or revoked. Please reconnect Gmail."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )


# =================================================
# USER EMAIL ENDPOINTS
# =================================================

@app.get("/emails")
def get_emails(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Email)
    if current_user.role != "admin":
        query = query.filter(Email.user_id == current_user.id)

    emails = (
        query
        .order_by(Email.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    now = datetime.utcnow()
    changed = False
    for e in emails:
        if _update_deadline_fields(e, now):
            changed = True
    if changed:
        db.commit()

    return {
        "count": len(emails),
        "data": [
            {
                "id": e.id,
                "email_id": e.email_id,
                "user_id": e.user_id,
                "sender": e.sender,
                "to_email": e.user.gmail_email or e.user.email if e.user else None,
                "subject": e.subject,
                "body": e.body,
                "received_at": e.received_at.isoformat() if e.received_at else None,
                "category": e.category,
                "confidence": e.confidence,
                "urgent": e.urgent,
                "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
                "days_remaining": e.days_remaining,
                "is_read": e.is_read,
                "is_resolved": e.is_read
            }
            for e in emails
        ]
    }


@app.patch("/emails/{email_id}/resolve")
def resolve_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    email = (
        db.query(Email)
        .filter(Email.id == email_id, Email.user_id == current_user.id)
        .first()
    )

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    email.is_read = True
    db.commit()
    db.refresh(email)

    return {
        "message": "Email marked as resolved",
        "id": email.id,
        "is_resolved": True
    }


@app.get("/emails/urgent")
def get_urgent_emails(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    emails = (
        db.query(Email)
        .filter(
            Email.user_id == current_user.id,
            Email.urgent.is_(True)
        )
        .order_by(Email.deadline_date.asc())
        .all()
    )
    now = datetime.utcnow()
    changed = False
    for e in emails:
        if _update_deadline_fields(e, now):
            changed = True
    if changed:
        db.commit()
    return {
        "count": len(emails),
        "data": [
            {
                "id": e.id,
                "subject": e.subject,
                "category": e.category,
                "confidence": e.confidence,
                "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
                "days_remaining": e.days_remaining
            }
            for e in emails
        ]
    }


@app.get("/emails/upcoming")
def get_upcoming_deadlines(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    emails = (
        db.query(Email)
        .filter(
            Email.user_id == current_user.id,
            Email.deadline_date.isnot(None)
        )
        .order_by(Email.deadline_date.asc())
        .all()
    )
    now = datetime.utcnow()
    changed = False
    for e in emails:
        if _update_deadline_fields(e, now):
            changed = True
    if changed:
        db.commit()
    return {
        "count": len(emails),
        "data": [
            {
                "id": e.id,
                "subject": e.subject,
                "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
                "days_remaining": e.days_remaining,
                "urgent": e.urgent
            }
            for e in emails
        ]
    }


@app.get("/notifications/deadlines")
def get_deadline_notifications(
    lookahead_hours: int = 24,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hours = lookahead_hours if lookahead_hours > 0 else _get_user_reminder_window_hours(db, current_user.id)
    notifications = _build_deadline_notifications(
        db,
        current_user,
        lookahead_hours=hours,
        persist_events=False,
        source="api",
    )

    overdue_count = sum(1 for n in notifications if n["type"] == "overdue")
    due_soon_count = sum(1 for n in notifications if n["type"] == "due_soon")

    return {
        "count": len(notifications),
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "lookahead_hours": hours,
        "data": notifications,
    }


# =================================================
# ADMIN ENDPOINTS
# =================================================
class EmailUpdate(BaseModel):
    category: str | None = None
    urgent: bool | None = None


class AdminUserCreate(BaseModel):
    email: str
    password: str
    role: str = "user"


class AdminUserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


@app.get("/stats")
def get_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_emails = db.query(func.count(Email.id)).scalar() or 0
    urgent_count = (
        db.query(func.count(Email.id))
        .filter(Email.urgent.is_(True))
        .scalar() or 0
    )
    category_counts = (
        db.query(Email.category, func.count(Email.category))
        .group_by(Email.category)
        .all()
    )
    return {
        "total_emails": total_emails,
        "urgent_emails": urgent_count,
        "category_distribution": dict(category_counts or [])
    }


@app.get("/admin/monitoring")
def admin_monitoring(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    emails_processed = db.query(func.count(Email.id)).scalar() or 0
    urgent_detection_count = (
        db.query(func.count(Email.id))
        .filter(Email.urgent.is_(True))
        .scalar() or 0
    )
    override_count = db.query(func.count(ModelCorrection.id)).scalar() or 0

    classification_accuracy = None
    if emails_processed > 0:
        classification_accuracy = round(
            ((emails_processed - override_count) / emails_processed) * 100,
            2,
        )

    recent_logs = (
        db.query(AdminEventLog)
        .order_by(AdminEventLog.created_at.desc())
        .limit(30)
        .all()
    )

    last_retrain = (
        db.query(RetrainingRun)
        .order_by(RetrainingRun.started_at.desc())
        .first()
    )

    return {
        "classification_accuracy": classification_accuracy,
        "emails_processed": emails_processed,
        "urgent_detection_count": urgent_detection_count,
        "manual_override_count": override_count,
        "error_logs": [
            {
                "id": log.id,
                "event_type": log.event_type,
                "level": log.level,
                "message": log.message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent_logs
        ],
        "last_retraining": (
            {
                "id": last_retrain.id,
                "status": last_retrain.status,
                "started_at": last_retrain.started_at.isoformat() if last_retrain.started_at else None,
                "completed_at": last_retrain.completed_at.isoformat() if last_retrain.completed_at else None,
                "notes": last_retrain.notes,
            }
            if last_retrain
            else None
        )
    }


@app.put("/admin/emails/{email_id}/override")
def admin_override_email(
    email_id: int,
    update: EmailUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if update.category is None and update.urgent is None:
        raise HTTPException(status_code=400, detail="No override values provided")

    if update.category is not None and update.category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category provided")

    previous_category = email.category
    previous_urgent = email.urgent

    if update.category is not None:
        email.category = update.category
    if update.urgent is not None:
        email.urgent = update.urgent

    category_changed = previous_category != email.category
    urgent_changed = previous_urgent != email.urgent

    if not category_changed and not urgent_changed:
        return {"message": "No changes detected", "id": email.id}

    correction = ModelCorrection(
        email_id=email.id,
        corrected_by=current_user.id,
        previous_category=previous_category,
        new_category=email.category,
        previous_urgent=previous_urgent,
        new_urgent=email.urgent,
    )
    db.add(correction)

    dataset_appended = False
    if category_changed and email.category:
        try:
            dataset_appended = _append_correction_to_training_data(email, email.category)
        except Exception as exc:
            logger.exception("Failed to append correction for email_id=%s", email.id)
            _record_admin_event(
                db,
                event_type="error",
                level="error",
                message=f"Failed to append correction for email_id={email.id}: {exc}",
            )

    _record_admin_event(
        db,
        event_type="override",
        level="info",
        message=(
            f"Admin {current_user.email} corrected email_id={email.id}: "
            f"category {previous_category} -> {email.category}, "
            f"urgent {previous_urgent} -> {email.urgent}"
        ),
    )

    db.commit()
    db.refresh(email)

    return {
        "message": "Email updated and correction saved",
        "id": email.id,
        "dataset_appended": dataset_appended,
    }


# Backward compatibility for existing frontend calls
@app.put("/emails/{email_id}")
def update_email_legacy(
    email_id: int,
    update: EmailUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_override_email(email_id, update, current_user, db)


@app.get("/admin/users")
def admin_list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(User, func.count(Email.id).label("emails_processed"))
        .outerjoin(Email, Email.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .all()
    )

    return {
        "count": len(rows),
        "data": [
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "gmail_connected": bool(user.gmail_email and user.gmail_refresh_token),
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "emails_processed": int(emails_processed or 0),
            }
            for user, emails_processed in rows
        ]
    }


@app.post("/admin/users")
def admin_create_user(
    payload: AdminUserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    role = payload.role.strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(new_user)

    _record_admin_event(
        db,
        event_type="user_mgmt",
        level="info",
        message=f"Admin {current_user.email} created user {email} with role={role}",
    )

    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created",
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
    }


@app.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None:
        role = payload.role.strip().lower()
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = role

    if payload.is_active is not None:
        user.is_active = payload.is_active

    _record_admin_event(
        db,
        event_type="user_mgmt",
        level="info",
        message=(
            f"Admin {current_user.email} updated user_id={user.id}: "
            f"role={user.role}, is_active={user.is_active}"
        ),
    )

    db.commit()
    db.refresh(user)

    return {
        "message": "User updated",
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Admin cannot delete own account")

    deleted_email = user.email
    db.delete(user)

    _record_admin_event(
        db,
        event_type="user_mgmt",
        level="warning",
        message=f"Admin {current_user.email} deleted user {deleted_email}",
    )

    db.commit()
    return {"message": "User removed"}


@app.post("/admin/retrain")
def admin_retrain_model(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    run = RetrainingRun(status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        result = subprocess.run(
            [sys.executable, TFIDF_TRAIN_SCRIPT],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=1800,
        )

        if result.returncode != 0:
            run.status = "failed"
            run.notes = (result.stderr or result.stdout or "Retraining failed")[-3000:]
            run.completed_at = datetime.utcnow()
            _record_admin_event(
                db,
                event_type="retrain",
                level="error",
                message=f"Retraining failed by admin {current_user.email}",
            )
            db.commit()
            raise HTTPException(status_code=500, detail="Retraining failed")

        run.status = "success"
        run.notes = (result.stdout or "Retraining completed")[-3000:]
        run.completed_at = datetime.utcnow()
        _record_admin_event(
            db,
            event_type="retrain",
            level="info",
            message=f"Retraining completed by admin {current_user.email}",
        )
        db.commit()

        return {
            "message": "Retraining completed",
            "run_id": run.id,
            "status": run.status,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        run.status = "failed"
        run.notes = str(exc)
        run.completed_at = datetime.utcnow()
        _record_admin_event(
            db,
            event_type="retrain",
            level="error",
            message=f"Retraining exception by admin {current_user.email}: {exc}",
        )
        db.commit()
        raise HTTPException(status_code=500, detail=f"Retraining failed: {exc}")


@app.post("/admin/notifications/run")
def admin_run_deadline_notifications(
    lookahead_hours: int = DEFAULT_REMINDER_WINDOW_HOURS,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.is_active.is_(True)).all()
    processed = 0
    generated = 0
    for user in users:
        profile = _get_or_create_profile(db, user)
        if profile.notification_enabled is False:
            continue
        notifications = _build_deadline_notifications(
            db=db,
            user=user,
            lookahead_hours=max(int(lookahead_hours), 1),
            persist_events=True,
            source="admin_manual",
        )
        processed += 1
        generated += len(notifications)

    return {
        "message": "Deadline notification run completed",
        "users_processed": processed,
        "notifications_detected": generated,
    }
