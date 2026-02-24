import json
import os
import base64
import re
from datetime import datetime

from bs4 import BeautifulSoup
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

from backend.database import SessionLocal
from backend.models import User


# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


# -------------------------------------------------
# Gmail Service (legacy: uses token.json for CLI/scripts)
# -------------------------------------------------
def get_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    else:
        flow = InstalledAppFlow.from_client_secrets_file(
            CREDENTIALS_FILE, SCOPES
        )
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


# -------------------------------------------------
# Build Gmail service from user's stored OAuth tokens (multi-user)
# -------------------------------------------------
def get_service_for_user(user: User):
    if not user.gmail_refresh_token:
        raise ValueError(f"User {user.email} has no Gmail refresh token; connect Gmail first")
    
    with open(CREDENTIALS_FILE, "r") as f:
        client_config = json.load(f)
    
    client = client_config.get("installed") or client_config.get("web", {})
    client_id = client.get("client_id")
    client_secret = client.get("client_secret")
    token_uri = client.get("token_uri", "https://oauth2.googleapis.com/token")
    
    print(f"    Building Gmail service for {user.email}")
    print(f"   Access Token: {bool(user.gmail_access_token)}")
    print(f"   Refresh Token: {bool(user.gmail_refresh_token)}")
    
    creds = Credentials(
        token=user.gmail_access_token or "",
        refresh_token=user.gmail_refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )
    
    service = build("gmail", "v1", credentials=creds)
    print(f"Gmail service built successfully")
    return service


# -------------------------------------------------
# HTML Cleaning
# -------------------------------------------------
def _clean_html(raw_html: str) -> str:
    soup = BeautifulSoup(raw_html, "html.parser")

    for tag in soup(["script", "style"]):
        tag.decompose()

    return soup.get_text(separator="\n")


# -------------------------------------------------
# Post-process text (normalize + remove duplicates + trim footer)
# -------------------------------------------------
def _post_process_text(text: str) -> str:
    # Normalize line breaks
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n+', '\n', text)

    lines = []
    seen = set()

    for line in text.split("\n"):
        clean_line = line.strip()
        if not clean_line:
            continue

        # remove duplicate lines
        if clean_line not in seen:
            lines.append(clean_line)
            seen.add(clean_line)

    cleaned_text = "\n".join(lines)

    # Remove common footer junk
    footer_markers = [
        "DOCUMENTATION",
        "SUPPORT",
        "Was this information helpful?",
        "Visit Google Cloud",
        "©",
        "Unsubscribe",
        "Privacy Policy"
    ]

    for marker in footer_markers:
        if marker in cleaned_text:
            cleaned_text = cleaned_text.split(marker)[0]
            break

    return cleaned_text.strip()


# -------------------------------------------------
# Extract body (handles multipart properly)
# -------------------------------------------------
def _extract_body(payload):
    plain_text = None
    html_text = None

    def extract_parts(parts):
        nonlocal plain_text, html_text

        for part in parts:
            mime_type = part.get("mimeType")
            body = part.get("body", {})
            data = body.get("data")

            # Recursive handling for nested parts
            if "parts" in part:
                extract_parts(part["parts"])

            if not data:
                continue

            decoded = base64.urlsafe_b64decode(data).decode(
                "utf-8", errors="ignore"
            )

            if mime_type == "text/plain" and not plain_text:
                plain_text = decoded

            if mime_type == "text/html" and not html_text:
                html_text = decoded

    if "parts" in payload:
        extract_parts(payload["parts"])
    else:
        data = payload.get("body", {}).get("data")
        if data:
            plain_text = base64.urlsafe_b64decode(data).decode(
                "utf-8", errors="ignore"
            )

    # Prefer plain text
    if plain_text:
        return _post_process_text(plain_text)

    # Otherwise use cleaned HTML
    if html_text:
        cleaned_html = _clean_html(html_text)
        return _post_process_text(cleaned_html)

    return ""


# -------------------------------------------------
# Fetch Emails (pagination supported) — uses token.json (single-user/CLI)
# -------------------------------------------------

def fetch_emails(max_emails=100):
    service = get_service()
    return _fetch_emails_with_service(service, max_emails)


# -------------------------------------------------
# Fetch Emails for a specific user (uses DB-stored OAuth tokens)
# -------------------------------------------------

def fetch_emails_for_user(user_id: int, max_emails: int = 100):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User id {user_id} not found")
        service = get_service_for_user(user)
        return _fetch_emails_with_service(service, max_emails)
    finally:
        db.close()


def _fetch_emails_with_service(service, max_emails=100):
    emails = []
    response = service.users().messages().list(
        userId="me",
        q="in:inbox"
    ).execute()

    while response:
        for msg in response.get("messages", []):
            message = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="full"
            ).execute()

            headers = message["payload"]["headers"]
            subject = sender = ""

            for h in headers:
                if h["name"] == "Subject":
                    subject = h["value"]
                elif h["name"] == "From":
                    sender = h["value"]

            body = _extract_body(message["payload"])

            emails.append({
                "email_id": message["id"],
                "sender": sender,
                "subject": subject,
                "body": body,
                "received_at": datetime.utcnow()
            })

            if max_emails and len(emails) >= max_emails:
                return emails

        if "nextPageToken" in response:
            response = service.users().messages().list(
                userId="me",
                q="in:inbox",
                pageToken=response["nextPageToken"]
            ).execute()
        else:
            break

    return emails
