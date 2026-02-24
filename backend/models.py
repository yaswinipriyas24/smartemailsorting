from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


# -------------------------------------------------
# Email Model
# -------------------------------------------------
class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)

    # Gmail message ID (unique per user)
    email_id = Column(String(120), nullable=False, index=True)

    # Multi-user isolation
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    sender = Column(Text)
    subject = Column(Text)
    body = Column(Text)
    received_at = Column(DateTime)

    category = Column(String(50), index=True)
    confidence = Column(Float)
    urgent = Column(Boolean, default=False, index=True)

    # Structured Deadline Intelligence
    deadline_date = Column(DateTime, nullable=True, index=True)
    days_remaining = Column(Integer, nullable=True)

    # Optional legacy support
    deadlines = Column(Text)

    is_read = Column(Boolean, default=False, index=True)
    is_processed = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Prevent duplicate Gmail message for same user
    __table_args__ = (
        UniqueConstraint("email_id", "user_id", name="unique_email_per_user"),
    )

    # Relationship
    user = relationship("User", back_populates="emails")


# -------------------------------------------------
# User Model
# -------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Gmail OAuth Storage
    gmail_email = Column(String(255), nullable=True)
    gmail_access_token = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_token_expiry = Column(DateTime, nullable=True)

    role = Column(String(20), default="user")  # "user" or "admin"
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    emails = relationship(
        "Email",
        back_populates="user",
        cascade="all, delete-orphan"
    )
