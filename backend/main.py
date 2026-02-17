# -------------------------------------------------
# Smart Email Sorting System - Main Application
# Version: 3.3 (Final Architecture with Gmail Connect)
# -------------------------------------------------

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import init_db, get_db
from backend.models import Email, User
from backend.routes import auth
from backend.auth_utils import get_current_user, require_admin
# 🔥 FIXED IMPORT: Using your actual pipeline file
from backend.pipeline import run_pipeline 
from backend.gmail_oauth import router as gmail_router

# -------------------------------------------------
# Create FastAPI App
# -------------------------------------------------
app = FastAPI(
    title="Smart Email Sorting System",
    version="3.3"
)

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
    return {"status": "Smart Email Sorting API is running 🚀"}

# =================================================
# AUTH HELPER ENDPOINT
# =================================================
@app.get("/auth/me")
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "gmail_email": current_user.gmail_email
    }

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
    """
    1. Links a Gmail address to the current user.
    2. Immediately triggers the first sync.
    """
    # 1. Update User Record
    current_user.gmail_email = data.gmail_email
    db.commit()
    db.refresh(current_user)

    # 2. Trigger Auto-Sync
    print(f"🔗 Gmail Connected for {current_user.email}. Starting Pipeline...")
    try:
        # 🔥 Using your pipeline.py logic
        sync_result = run_pipeline(
            user_id=current_user.id,
            limit=20,
            clear_existing=False
        )
        return {
            "message": "Gmail connected and initial sync completed!",
            "gmail_email": current_user.gmail_email,
            "sync_stats": sync_result
        }
    except Exception as e:
        print(f"⚠️ Sync failed after connect: {e}")
        return {
            "message": "Gmail connected, but initial sync failed. Try syncing manually.",
            "gmail_email": current_user.gmail_email,
            "error": str(e)
        }

@app.post("/sync-emails")
def sync_emails_endpoint(
    limit: int = 20,
    clear_db: bool = False,
    current_user: User = Depends(get_current_user)
):
    if not current_user.gmail_email:
        raise HTTPException(
            status_code=400,
            detail="Connect Gmail before syncing emails"
        )

    try:
        # 🔥 Using your pipeline.py logic
        result = run_pipeline(
            user_id=current_user.id,
            limit=limit,
            clear_existing=clear_db
        )
        return result
    except Exception as e:
        print(f"❌ Sync error: {str(e)}")
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
    emails = (
        db.query(Email)
        .filter(Email.user_id == current_user.id)
        .order_by(Email.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return {
        "count": len(emails),
        "data": [
            {
                "id": e.id,
                "subject": e.subject,
                "category": e.category,
                "confidence": e.confidence,
                "urgent": e.urgent,
                "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
                "days_remaining": e.days_remaining,
                "is_read": e.is_read
            }
            for e in emails
        ]
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

# =================================================
# ADMIN ENDPOINTS
# =================================================

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

class EmailUpdate(BaseModel):
    category: str | None = None
    urgent: bool | None = None

@app.put("/emails/{email_id}")
def update_email(
    email_id: int,
    update: EmailUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if update.category is not None:
        email.category = update.category
    if update.urgent is not None:
        email.urgent = update.urgent
        
    db.commit()
    db.refresh(email)
    
    return {"message": "Email updated", "id": email.id}