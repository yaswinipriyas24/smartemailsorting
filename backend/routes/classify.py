from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from backend.ml_model import classify_email
from backend.store_email import store_email

router = APIRouter()

# -----------------------------
# Request schema
# -----------------------------
class EmailRequest(BaseModel):
    email_id: str
    sender: str | None = None
    subject: str
    body: str
    received_at: datetime | None = None


# -----------------------------
# Classify Email API
# -----------------------------
@router.post("/classify")
def classify_email_api(request: EmailRequest):

    # 1️⃣ Run ML classification
    prediction = classify_email(
        subject=request.subject,
        body=request.body
    )

    # 2️⃣ Prepare data for DB
    email_data = {
        "email_id": request.email_id,
        "sender": request.sender,
        "subject": request.subject,
        "body": request.body,
        "received_at": request.received_at,

        "category": prediction["category"],
        "confidence": prediction["confidence"],
        "urgent": prediction["urgent"],
        "deadlines": prediction["deadlines"]
    }

    # 3️⃣ Store in database
    store_email(email_data)

    # 4️⃣ Return response to frontend
    return {
        "status": "success",
        "result": prediction
    }
