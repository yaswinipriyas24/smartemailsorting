import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, UserProfile
from backend.auth_utils import get_current_user
from backend.sync_emails import sync_emails

logger = logging.getLogger(__name__)

# Resolve credentials path relative to this file (works from any CWD)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BASE_DIR)
_CANDIDATE_CREDENTIAL_PATHS = [
    os.path.join(_BASE_DIR, "credentials.json"),
    os.path.join(_PROJECT_ROOT, "credentials.json"),
]

GOOGLE_CLIENT_SECRET_FILE = next(
    (p for p in _CANDIDATE_CREDENTIAL_PATHS if os.path.exists(p)),
    _CANDIDATE_CREDENTIAL_PATHS[0],
)

router = APIRouter(prefix="/gmail", tags=["Gmail"])

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
REDIRECT_URI = f"{BACKEND_BASE_URL}/gmail/callback"


def _get_or_create_profile(db: Session, user: User) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = UserProfile(user_id=user.id)
    db.add(profile)
    db.flush()
    return profile


# -------------------------------------------------
# Step 1 — Start OAuth (user must be logged in; we pass user_id in state)
# -------------------------------------------------
@router.get("/connect")
def connect_gmail(
    current_user: User = Depends(get_current_user),
):
    if not os.path.exists(GOOGLE_CLIENT_SECRET_FILE):
        raise HTTPException(
            status_code=500,
            detail=f"Google OAuth credentials file not found. Expected at: {GOOGLE_CLIENT_SECRET_FILE}"
        )

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
    logger.info(
        "Starting Gmail OAuth for user_id=%s, redirect_uri=%s",
        current_user.id,
        REDIRECT_URI,
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
        logger.warning("Gmail OAuth denied: error=%s desc=%s", error, error_description)
        return RedirectResponse(
            url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=denied"
        )

    if not code or not state:
        logger.error("Gmail OAuth callback missing params: code=%s state=%s", bool(code), state)
        return RedirectResponse(
            url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=missing_params"
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
        gmail_profile = service.users().getProfile(userId="me").execute()
        gmail_email = gmail_profile.get("emailAddress")
        oauth2_service = build("oauth2", "v2", credentials=credentials)
        user_info = oauth2_service.userinfo().get().execute()
    except Exception:
        logger.exception("Gmail OAuth token exchange failed for user_id=%s", user_id)
        return RedirectResponse(
            url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=token_failed"
        )

    refresh_token = credentials.refresh_token or user.gmail_refresh_token
    if not refresh_token:
        logger.error("No refresh token received/saved for user_id=%s", user.id)
        return RedirectResponse(
            url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=no_refresh_token"
        )

    user.gmail_email = gmail_email
    user.gmail_access_token = credentials.token or user.gmail_access_token
    user.gmail_refresh_token = refresh_token
    user.gmail_token_expiry = credentials.expiry
    profile = _get_or_create_profile(db, user)
    profile.full_name = user_info.get("name") or profile.full_name
    profile.photo_url = user_info.get("picture") or profile.photo_url
    db.commit()

    try:
        sync_result = sync_emails(user_id=user.id, limit=20)
        logger.info("Post-OAuth sync result for user_id=%s: %s", user.id, sync_result)
        if isinstance(sync_result, dict) and sync_result.get("status") == "error":
            logger.error("Post-OAuth sync returned error for user_id=%s: %s", user.id, sync_result)
            return RedirectResponse(
                url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=sync_failed"
            )
    except Exception:
        logger.exception("Post-OAuth sync failed for user_id=%s", user.id)
        return RedirectResponse(
            url=f"{FRONTEND_BASE_URL}/dashboard?gmail_error=sync_failed"
        )

    return RedirectResponse(url=f"{FRONTEND_BASE_URL}/dashboard")
