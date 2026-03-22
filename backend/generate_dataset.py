import csv
import os
import random
from datetime import datetime, timedelta

# -----------------------------
# Categories (FINAL – clean)
# -----------------------------
categories = {
    "Invoices": ["Invoice #{n} generated", "Invoice #{n} due by {d}", "Billing invoice #{n}"],
    "Orders": ["Order #{n} confirmed", "Order #{n} shipped", "Order #{n} delivery update"],
    "Customer Support": ["Support ticket #{n} update", "Issue #{n} resolved", "Support request #{n}"],
    "Legal": ["Contract review required", "Legal notice issued", "Agreement approval pending"],
    "Human Resources": ["Leave request update", "HR policy update", "Attendance confirmation"],
    "Meetings": ["Meeting scheduled on {d}", "Team meeting reminder", "Project review meeting"],
    "Recruitment": ["Interview scheduled", "Job application received", "Recruitment status update"],
    "Payments": ["Payment of INR {a} received", "Pending payment reminder", "Refund processed"],
    "Project Updates": ["Weekly project update", "Sprint progress report", "Project timeline update"],
    "Technical Issues": ["Server downtime alert", "System bug detected", "Maintenance scheduled"],
    "Marketing": ["Campaign launch update", "Marketing promotion", "Brand campaign announcement"],
    "Training": ["Training session scheduled", "Workshop reminder", "Skill development program"],
    "Announcements": ["Company announcement", "Office notice", "Holiday announcement"],
    "Performance Reports": ["Performance review scheduled", "Evaluation report attached", "Quarterly report"],
    "Reminders": ["Task reminder", "Submission reminder", "Follow-up reminder"],
    "Deadlines": ["Urgent deadline today", "Submission deadline approaching", "Immediate action required"],
    "General Communication": ["General update", "Information message", "Welcome email"]
}

TOTAL_PER_CATEGORY = 900  # 17 × 900 ≈ 15,300
start_date = datetime.now()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "..", "dataset", "emails.csv")

with open(DATASET_PATH, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "sender", "subject", "body", "label"])

    email_id = 1

    for label, subjects in categories.items():
        for _ in range(TOTAL_PER_CATEGORY):
            subject = random.choice(subjects).format(
                n=random.randint(1000, 9999),
                d=(start_date + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                a=random.randint(1000, 50000)
            )

            body = f"This email relates to {label.lower()} and requires appropriate action."
            sender = f"{label.replace(' ', '').lower()}@company.com"

            writer.writerow([email_id, sender, subject, body, label])
            email_id += 1

print("✅ FINAL DATASET GENERATED SUCCESSFULLY")
