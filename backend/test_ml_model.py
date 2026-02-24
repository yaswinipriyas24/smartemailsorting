from ml_model import classify_email

def run_tests():
    test_emails = [
        # 1. Invoices
        {
            "subject": "Invoice generated for March",
            "body": "Please find attached invoice #3245 for March billing."
        },

        # 2. Orders
        {
            "subject": "Order Confirmation",
            "body": "Your order #9823 has been successfully placed."
        },

        # 3. Customer Support
        {
            "subject": "Support ticket update",
            "body": "Your complaint ticket #5567 is under review."
        },

        # 4. Legal
        {
            "subject": "Contract renewal notice",
            "body": "Please review and sign the legal agreement before Friday."
        },

        # 5. Human Resources
        {
            "subject": "Leave application approved",
            "body": "Your leave from March 10 to March 15 has been approved."
        },

        # 6. Meetings
        {
            "subject": "Meeting reminder",
            "body": "Project review meeting scheduled tomorrow at 10 AM."
        },

        # 7. Recruitment
        {
            "subject": "Job Interview Invitation",
            "body": "You are shortlisted for the AI Engineer position."
        },

        # 8. Payments
        {
            "subject": "Pending payment reminder",
            "body": "Your payment of ₹2,500 is due today. Please pay now."
        },

        # 9. Project Updates
        {
            "subject": "Weekly project update",
            "body": "Please submit this week’s progress report by EOD."
        },

        # 10. Technical Issues
        {
            "subject": "Server downtime alert",
            "body": "The application is currently unavailable due to maintenance."
        },

        # 11. Marketing
        {
            "subject": "Few days left: Unlock Pay Per Shipment",
            "body": "Limited time offer. Unlock now and start shipping today."
        },

        # 12. Training
        {
            "subject": "Training schedule announced",
            "body": "Your AI/ML workshop is scheduled for April 10."
        },

        # 13. Announcements
        {
            "subject": "Office closure notice",
            "body": "The company will be closed on March 28 for maintenance."
        },

        # 14. Performance Reports
        {
            "subject": "Performance review meeting",
            "body": "Your quarterly performance review is scheduled next week."
        },

        # 15. Reminders
        {
            "subject": "Reminder: Submit document",
            "body": "Please submit your design document by today."
        },

        # 16. Deadlines / Urgent
        {
            "subject": "URGENT: Deadline extended",
            "body": "Final submission deadline is tomorrow. Action required."
        },

        # 17. General Communication
        {
            "subject": "Welcome to our platform",
            "body": "Thank you for joining our mailing list."
        }
    ]

    for i, email in enumerate(test_emails, start=1):
        print(f"\n TEST EMAIL {i}")
        print("Subject:", email["subject"])
        print("Body:", email["body"])

        result = classify_email(email["subject"], email["body"])

        print("Prediction Result:")
        for key, value in result.items():
            print(f"  {key}: {value}")

if __name__ == "__main__":
    run_tests()
