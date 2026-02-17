import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.auth_utils import get_current_user
from backend.sync_emails import sync_emails

# Resolve credentials path relative to this file (works from any CWD)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GOOGLE_CLIENT_SECRET_FILE = os.path.join(_BASE_DIR, "credentials.json")

router = APIRouter(prefix="/gmail", tags=["Gmail"])

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
REDIRECT_URI = "http://127.0.0.1:8000/gmail/callback"


# -------------------------------------------------
# Step 1 — Start OAuth (user must be logged in; we pass user_id in state)
# -------------------------------------------------
@router.get("/connect")
def connect_gmail(
    current_user: User = Depends(get_current_user),
):
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=str(current_user.id),
    )
    return {"auth_url": auth_url}


# -------------------------------------------------
# Step 2 — Callback (no JWT on redirect; use state to identify user)
# -------------------------------------------------
@router.get("/callback")
def gmail_callback(
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
):
    # Bug 1: User denied permission — Google returns error instead of code
    if error:
        return RedirectResponse(
            url="http://localhost:3000/dashboard?gmail_error=denied"
        )

    if not code or not state:
        return RedirectResponse(
            url="http://localhost:3000/dashboard?gmail_error=missing_params"
        )

    # Bug 2: Validate state is a valid integer (avoid ValueError → 500)
    try:
        user_id = int(state)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid state parameter",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid user state")

    try:
        flow = Flow.from_client_secrets_file(
            GOOGLE_CLIENT_SECRET_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )
        flow.fetch_token(code=code)
        credentials = flow.credentials

        service = build("gmail", "v1", credentials=credentials)
        profile = service.users().getProfile(userId="me").execute()
        gmail_email = profile.get("emailAddress")
    except Exception:
        return RedirectResponse(
            url="http://localhost:3000/dashboard?gmail_error=token_failed"
        )

    user.gmail_email = gmail_email
    user.gmail_access_token = credentials.token
    user.gmail_refresh_token = credentials.refresh_token
    user.gmail_token_expiry = credentials.expiry
    db.commit()

    sync_emails(user_id=user.id, limit=20)

    return RedirectResponse(url="http://localhost:3000/dashboard")
