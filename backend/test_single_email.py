from ml_model import classify_email

# 🔴 PASTE YOUR REAL EMAIL HERE
subject = " Few days left: Pay Per Shipment is now unlocked for you"
body = """Dear Seller,


Pay-Per-Shipment is now unlocked for your account, making it easier than ever to start shipping your orders.

What does Pay-Per-Shipment mean for you?

 
With Pay-Per-Shipment, you can:
Add orders and ship without upfront recharge or wallet credits
Pay directly on each shipment you create
Enjoy a smooth and simple shipping experience
No extra setup needed, just add your order and start shipping right away.

 

Few Days Left, Unlock Now & Ship Today"""



result = classify_email(subject, body)

print("\n📧 REAL EMAIL TEST")
print("Subject:", subject)
print("Body:", body.strip())

print("\n🔍 Prediction Result:")
for key, value in result.items():
    print(f"{key}: {value}")
