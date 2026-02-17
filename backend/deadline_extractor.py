import re
from datetime import datetime
import dateparser


def extract_deadline(text: str):
    """
    Extract deadline date from email text using intelligent parsing.
    Supports:
    - 12/02/2026
    - 2026-02-14
    - 11 Feb 2026
    - Feb 11
    - Feb 11 to 13
    """

    if not text:
        return None

    # -----------------------------------------
    # 1️⃣ Try smart parsing using dateparser
    # -----------------------------------------
    parsed_date = dateparser.parse(
        text,
        settings={
            "PREFER_DATES_FROM": "future",
            "RELATIVE_BASE": datetime.utcnow()
        }
    )

    if parsed_date:
        today = datetime.utcnow()
        days_remaining = (parsed_date - today).days

        return {
            "deadline_date": parsed_date,
            "days_remaining": days_remaining,
            "is_overdue": days_remaining < 0
        }

    # -----------------------------------------
    # 2️⃣ Fallback Regex (Manual patterns)
    # -----------------------------------------
    DATE_PATTERNS = [
        r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s?\d{0,4}\b",
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2}\b"
    ]

    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group()

            parsed = dateparser.parse(
                date_str,
                settings={
                    "PREFER_DATES_FROM": "future",
                    "RELATIVE_BASE": datetime.utcnow()
                }
            )

            if parsed:
                today = datetime.utcnow()
                days_remaining = (parsed - today).days

                return {
                    "deadline_date": parsed,
                    "days_remaining": days_remaining,
                    "is_overdue": days_remaining < 0
                }

    return None
