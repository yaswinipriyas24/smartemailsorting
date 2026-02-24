# backend/routes/gmail.py

import os
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.auth_utils import get_current_user
from backend.sync_emails import sync_emails


router = APIRouter(prefix="/gmail", tags=["Gmail"])

GOOGLE_CLIENT_SECRET_FILE = "credentials.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

REDIRECT_URI = "http://127.0.0.1:8000/gmail/callback"


# -------------------------------------------------
# STEP 1 — Generate OAuth URL
# -------------------------------------------------
@router.get("/connect")
def connect_gmail(current_user: User = Depends(get_current_user)):
    """
    Returns Google OAuth URL.
    """

    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # Store user_id inside state (secure linking)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=str(current_user.id),
    )

    return {"auth_url": auth_url}


# -------------------------------------------------
# STEP 2 — Callback from Google
# -------------------------------------------------
@router.get("/callback")
def gmail_callback(
    code: str,
    state: str,  # contains user_id
    db: Session = Depends(get_db),
):
    """
    Google redirects here after user grants permission.
    """

    try:
        flow = Flow.from_client_secrets_file(
            GOOGLE_CLIENT_SECRET_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )

        flow.fetch_token(code=code)
        credentials = flow.credentials

        print(f" Credentials Info:")
        print(f"   Token type: {type(credentials.token)}")
        print(f"   Token value: {credentials.token is not None}")
        print(f"   Refresh token type: {type(credentials.refresh_token)}")
        print(f"   Refresh token value: {credentials.refresh_token is not None}")

        # Get user using state (user_id)
        user = db.query(User).filter(User.id == int(state)).first()

        if not user:
            raise HTTPException(
                status_code=400,
                detail="Invalid user state"
            )

        # Fetch Gmail profile
        service = build("gmail", "v1", credentials=credentials)
        profile = service.users().getProfile(userId="me").execute()

        gmail_email = profile.get("emailAddress")

        # Save Gmail tokens - Convert to JSON to preserve all credential data
        user.gmail_email = gmail_email
        user.gmail_access_token = credentials.token or ""
        user.gmail_refresh_token = credentials.refresh_token or ""
        user.gmail_token_expiry = credentials.expiry

        # Also store full credentials as JSON for future refresh
        credentials_json = credentials.to_json()
        print(f"Full credentials saved: {len(credentials_json)} bytes")

        db.commit()
        db.refresh(user)

        print(f"Gmail OAuth successful for user {user.email}")
        print(f"   Gmail Email: {gmail_email}")
        print(f"   Access Token saved: {bool(user.gmail_access_token)}")
        print(f"   Refresh Token saved: {bool(user.gmail_refresh_token)}")

        # Auto sync emails after connection
        try:
            sync_result = sync_emails(user_id=user.id, limit=20)
            print(f"Auto-sync completed: {sync_result}")
        except Exception as sync_error:
            print(f"Auto-sync failed: {sync_error}")

        return RedirectResponse(
            url="http://localhost:3000/dashboard"
        )

    except Exception as e:
        print(f"Gmail callback error: {str(e)}")
        import traceback
        traceback.print_exc()
        return RedirectResponse(
            url=f"http://localhost:3000/dashboard?error={str(e)}"
        )
