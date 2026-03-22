from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.models import UserFeedback, User
from backend.auth_utils import get_current_user, require_admin

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    message: constr(min_length=1, max_length=2000)


class AdminReply(BaseModel):
    admin_reply: constr(min_length=1, max_length=2000)
    status: str = "resolved"


# -------------------------------------------------
# User: submit feedback
# -------------------------------------------------
@router.post("", status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = UserFeedback(
        user_id=current_user.id,
        message=payload.message.strip(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"id": feedback.id, "message": "Feedback submitted successfully"}


# -------------------------------------------------
# User: view own feedback + admin replies
# -------------------------------------------------
@router.get("/my")
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedbacks = (
        db.query(UserFeedback)
        .filter(UserFeedback.user_id == current_user.id)
        .order_by(UserFeedback.created_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": f.id,
                "message": f.message,
                "status": f.status,
                "admin_reply": f.admin_reply,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
            }
            for f in feedbacks
        ]
    }


# -------------------------------------------------
# Admin: view all feedback
# -------------------------------------------------
@router.get("/admin/all")
def get_all_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    feedbacks = (
        db.query(UserFeedback)
        .order_by(UserFeedback.created_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": f.id,
                "user_id": f.user_id,
                "user_email": f.user.email if f.user else None,
                "message": f.message,
                "status": f.status,
                "admin_reply": f.admin_reply,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
            }
            for f in feedbacks
        ]
    }


# -------------------------------------------------
# Admin: reply + resolve feedback
# -------------------------------------------------
@router.patch("/{feedback_id}/resolve")
def resolve_feedback(
    feedback_id: int,
    payload: AdminReply,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.status not in ("pending", "resolved"):
        raise HTTPException(status_code=400, detail="status must be 'pending' or 'resolved'")

    feedback = db.query(UserFeedback).filter(UserFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback.admin_reply = payload.admin_reply.strip()
    feedback.status = payload.status
    if payload.status == "resolved":
        feedback.resolved_at = datetime.utcnow()
    else:
        feedback.resolved_at = None

    db.commit()
    db.refresh(feedback)
    return {
        "id": feedback.id,
        "status": feedback.status,
        "admin_reply": feedback.admin_reply,
    }

