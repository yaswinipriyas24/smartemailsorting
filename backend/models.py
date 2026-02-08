from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    DateTime
)
from datetime import datetime
from database import Base   # ✅ correct import


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)

    email_id = Column(String(120), unique=True, index=True, nullable=False)
    sender = Column(Text)
    subject = Column(Text)
    body = Column(Text)
    received_at = Column(DateTime)

    category = Column(String(50))
    confidence = Column(Float)
    urgent = Column(Boolean, default=False)
    deadlines = Column(Text)

    is_read = Column(Boolean, default=False)
    is_processed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
