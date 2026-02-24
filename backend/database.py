# backend/database.py

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in .env file")

# Create engine (SSL only for PostgreSQL)
connect_args = {}
if DATABASE_URL.startswith("postgresql"):
    connect_args["sslmode"] = "require"
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

# Create session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class
Base = declarative_base()


# -------------------------------------------------
# Create tables automatically
# -------------------------------------------------

def init_db():
    from backend import models  # import models so SQLAlchemy registers them
    Base.metadata.create_all(bind=engine)


# -------------------------------------------------
# Dependency for FastAPI (optional but clean)
# -------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
