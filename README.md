# KaamSetu — Live Multi-Language, Voice-Enabled Hyper-Local Work Platform

Full-stack **Python Flask + SQLite** backend and modular **HTML/CSS/JS** frontend with:
- **6 Indian Languages** (English, Hindi, Marathi, Bengali, Tamil, Punjabi) + **Multi-Language Voice Assistant**
- **Salted PBKDF2-SHA256 Password Auth** + **HMAC-Signed Session Tokens**
- **Aadhaar KYC (Verhoeff 12-Digit Validation + Photo Upload + Live Webcam Face Match)**
- **Escrow Mediator Payments** (Employer pays upfront on job post -> KaamSetu holds in Escrow -> Dual End Job -> Auto-payout to Worker minus 5% platform fee)
- **Live Turn-by-Turn Google Maps Navigation**, **Private Chat**, **1-Order-at-a-Time Lock**, and **1-Tap SOS**

## Local Run
```powershell
cd backend
pip install -r requirements.txt
python app.py
```

## Free Live Deployment (Render.com)
Push this repo to GitHub -> New Web Service on [Render.com](https://render.com) -> Connect repo -> Render auto-detects `render.yaml` and deploys your live HTTPS URL.
