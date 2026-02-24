from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from backend.database import get_db
from backend.models import User
from backend.auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

GOOGLE_CLIENT_SECRET_FILE = "credentials.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
REDIRECT_URI = "http://127.0.0.1:8000/auth/gmail/callback"


class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: str
    username: str | None = None

# -------------------------------------------------
# REGISTER
# -------------------------------------------------
@router.post("/register")
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(User.email == user_data.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered, Please Login with your credentials."
        )

    if user_data.password != user_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role="user"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}


# -------------------------------------------------
# LOGIN
# -------------------------------------------------

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials, Please check your email and password."
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }


# -------------------------------------------------
# CONNECT GMAIL HERE (STEP 1)
# -------------------------------------------------

@router.get("/gmail/connect")
def connect_gmail(
    current_user: User = Depends(get_current_user)
):
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent"
    )

    return {"auth_url": auth_url}


# -------------------------------------------------
# GMAIL CALLBACK (STEP 2)
# -------------------------------------------------
@router.get("/gmail/callback")
def gmail_callback(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    service = build("gmail", "v1", credentials=credentials)
    profile = service.users().getProfile(userId="me").execute()

    current_user.gmail_email = profile.get("emailAddress")
    current_user.gmail_access_token = credentials.token
    current_user.gmail_refresh_token = credentials.refresh_token
    current_user.gmail_token_expiry = credentials.expiry

    db.commit()

    return RedirectResponse(
        url="http://localhost:3000/dashboard"
    )
