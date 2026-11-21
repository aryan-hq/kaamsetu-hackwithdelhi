# KaamSetu — End-to-End Hyper-Local Work Platform

Clean, modular **`backend/`** (Python Flask + SQLite) and **`frontend/`** (HTML/CSS/JS) architecture with separate Worker & Employer portals, password authentication, mandatory profile setup, skill-based job matching, dual-confirmation job completion, and UPI/Cash payment verification.

## Project Structure
```
kaamsetu/
├── backend/
│   ├── app.py                  # Flask server (serves API + frontend)
│   ├── database.py             # SQLite schema, password hashing, seed data
│   ├── requirements.txt        # Python dependencies
│   └── routes/
│       ├── auth.py             # Sign Up / Login (Password) & Profile Onboarding
│       ├── jobs.py             # Skill-filtered feed, Search, 1-Order Lock, Dual End Job, Chat
│       ├── wallet.py           # Wallet, Cash Collected confirmation, Verified UPI Payment
│       └── sos.py              # 1-Tap SOS & local nearest Govt Hospital routing
└── frontend/
    ├── index.html              # Separate Worker & Employer Portals + Auth + Onboarding
    ├── assets/logo.svg         # Custom KaamSetu brand logo & favicon
    ├── css/style.css           # Clean Porter/Rapido-inspired styling
    └── js/
        ├── api.js              # Fetch helper & Hindi voice readout
        ├── auth.js             # Sign Up, Login (Password), Profile Setup
        ├── map.js              # Leaflet map + Google Maps turn-by-turn navigation
        ├── worker.js           # Worker Portal (Skill-only jobs, Search, Active Order, Cash Collected)
        ├── employer.js         # Employer Portal (Dashboard, Search, Post Job, UPI Pay, End Job)
        ├── wallet.js           # Wallet Balance, Top-up, UPI Withdraw, Ledger
        ├── chat.js             # Order-scoped Private Chat
        └── sos.js              # 1-Tap SOS modal
```

## Quick Start
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```
Open `http://127.0.0.1:5000` in **Google Chrome**.

### Pre-Seeded Demo Accounts
- **Worker:** Phone `9811000099` | Password `password123` (Skill: Electrician)
- **Employer:** Phone `9810011221` | Password `password123` (Gupta Kirana Store, Wallet: ₹2,500)
