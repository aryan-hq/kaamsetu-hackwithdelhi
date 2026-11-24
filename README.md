# Shramvani — Voice-First Hyper-Local Work & Escrow Platform

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-CDN-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

**Built by Team VYNTRIX for HackWithDelhi 4.0**

**Shramvani** is a mobile-first, voice-enabled, multi-lingual web platform designed to bridge the digital divide for India’s blue-collar and daily-wage workforce. It connects skilled local workers (electricians, plumbers, carpenters, painters, helpers) with nearby employers (shops, homeowners, contractors) through zero-typing voice workflows, live map navigation, emergency safety tools, and an automated **Escrow payment system** that guarantees fair, on-time wages.

---

## Table of Contents
- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Key Features](#key-features)
- [How the Escrow System Works](#how-the-escrow-system-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Setup & Installation](#local-setup--installation)
- [Deployment (Render)](#deployment-render)
- [Future Roadmap](#future-roadmap)
- [Team VYNTRIX](#team-vyntrix)

---

## The Problem
Millions of daily-wage workers across India still depend on informal labour chowks and word-of-mouth to find work. Existing digital job platforms fail this demographic due to:
1. **Literacy & Language Barriers:** English-heavy interfaces that require typing exclude workers who are more comfortable speaking in their native language.
2. **Wage Theft & Payment Delays:** Without formal agreements or payment guarantees, workers frequently face delayed, reduced, or disputed payouts after completing a shift.
3. **Lack of On-Site Safety & Privacy:** Workers share personal phone numbers publicly and have no quick emergency assistance when working at unfamiliar locations.

---

## Our Solution
**Shramvani** removes friction for both workers and employers:
- **Zero-Typing Accessibility:** Workers can listen to job details read aloud in their native language, navigate the app using voice commands, and reply in chat using voice-to-text.
- **Guaranteed Payouts via Escrow:** Employers fund jobs upfront. Money stays locked in Shramvani Escrow until both parties confirm completion.
- **Hyper-Local & Safe:** Skill-matched jobs appear on an interactive map with turn-by-turn navigation, masked phone numbers until acceptance, and a 1-tap Emergency SOS system.

---

## Key Features

### 1. Voice-First Accessibility & 6 Indian Languages
- **Multi-Language Support:** Full interface and audio support for **English (`en`)**, **Hindi (`hi`)**, **Marathi (`mr`)**, **Bengali (`bn`)**, **Tamil (`ta`)**, and **Punjabi (`pa`)**.
- **Full-Page Auto-Translation:** Seamless integration with Google Translate ensures every dynamic job card, wallet entry, and form translates automatically when switching languages.
- **Native Audio Job Briefs:** Workers can tap **Audio** on any job card to hear the skill, shop name, area, duration, and exact payout spoken in their selected language, plus automated voice confirmation upon accepting a job.
- **Voice Control & Voice Chat:** Floating **Voice Control** assistant (Web Speech API) for hands-free navigation and a built-in **Mic** button inside private job chats for voice-to-text messaging.

### 2. Escrow Mediator & Wallet System
- **Upfront Funding:** Employers fund the job amount via their **Shramvani Escrow Wallet** or **UPI Gateway** when posting a job.
- **Dual Confirmation Release:** Funds remain safely locked in escrow until **both** the worker and the employer click **End Job**.
- **Transparent 95/5 Split:** Upon dual confirmation, **95%** of the job amount is instantly credited to the worker's withdrawable wallet, and **5%** is retained as the Shramvani platform mediator fee.
- **Ledger & Instant Withdrawal:** Both portals include a real-time transaction ledger. Workers can withdraw earnings to their UPI ID, and employers can top up their escrow wallet.

### 3. Hyper-Local Job Matching & Live Navigation
- **Interactive Maps (Leaflet.js + OpenStreetMap):** Employers can pin the exact work location using their GPS or by tapping the map. Workers see nearby skill-matched jobs plotted on a live map.
- **1-Active-Job Lock:** Prevents workers from overbooking multiple overlapping shifts at the same time.
- **Turn-by-Turn Navigation:** 1-tap **Route / Navigate** opens direct Google Maps directions to the employer's pinned coordinates.

### 4. Privacy & 1-Tap Emergency SOS
- **Masked Contact Info:** Employer phone numbers remain masked (`98XXXXXX21`) until a worker officially accepts the job.
- **Emergency SOS Modal:** Accessible from the sticky header at all times. Features:
  - Nearest Government Hospital finder with 1-tap navigation.
  - Direct **Alert Family** button (sends live GPS coordinates via WhatsApp).
  - Direct **Call 108** ambulance dialer.

### 5. Secure Authentication & Profile Management
- **Role-Based Portals:** Dedicated **Worker Portal** (`My Jobs`, `Wallet`, `Profile`) and **Employer Portal** (`Dashboard`, `Post Job`, `Wallet`, `Profile`).
- **Cryptographic Security:** Passwords are secured using salted **PBKDF2-SHA256** hashing, paired with **HMAC-signed** session tokens.
- **Streamlined Onboarding & Locked Identity:** Fast account creation via Phone, Email, or Google Account. Once profile setup is complete, the user's name is locked to prevent impersonation while phone, skill, and primary area remain editable in-app.

---

## How the Escrow System Works

```text
[Employer Posts Job] 
        │
        ▼ (Funds Locked Upfront via Wallet / UPI)
[Shramvani Escrow Vault] ──► Status: ESCROW PAID
        │
        ▼ (Worker Accepts Job — 1-Active-Job Lock Enabled)
[Work in Progress] ──► Private Chat, Call & Live Map Unlocked
        │
        ▼ (Dual Confirmation: Worker clicks "End Job" + Employer clicks "End Job")
[Automated Settlement]
   ├──► 95% Credited Instantly to Worker's Withdrawable Wallet
   └──►  5% Shramvani Mediator Fee
```

---

## Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Backend** | Python 3, Flask, SQLite3, Gunicorn |
| **Frontend** | HTML5, Tailwind CSS, Vanilla JavaScript |
| **Maps & Geo** | Leaflet.js, OpenStreetMap, Browser Geolocation API, Google Maps Deep Links |
| **Voice & i18n** | Web Speech API (`SpeechRecognition` & `SpeechSynthesis`), gTTS, Google Translate Element |
| **Security** | Salted PBKDF2-SHA256 Password Hashing, HMAC-Signed Auth Tokens |
| **Deployment** | Render (Web Service) |

---

## Project Structure

```text
shramvani-hackwithdelhi/
├── backend/
│   ├── app.py                 # Flask entry point & static frontend serving
│   ├── database.py            # SQLite schema initialization & seed data
│   ├── requirements.txt       # Python dependencies (Flask, gTTS, Gunicorn)
│   └── routes/
│       ├── auth.py            # Register, login, token auth, profile updates
│       ├── jobs.py            # Job posting, matching, accept, dual-confirm end job
│       └── wallet.py          # Escrow ledger, top-up, and worker UPI withdrawals
├── frontend/
│   ├── index.html             # Single-page app shell (Auth, Onboarding, Portals, Modals)
│   ├── assets/
│   │   └── logo.svg           # Shramvani voice-wave emblem
│   ├── css/
│   │   └── style.css          # Custom styling & Google Translate bar overrides
│   └── js/
│       ├── api.js             # Fetch wrapper & metadata loader
│       ├── auth.js            # Auth flows, session persistence, in-app profile editing
│       ├── chat.js            # Private job chat modal
│       ├── employer.js        # Employer dashboard, job posting, escrow calculator
│       ├── i18n.js            # 6-language dictionary & auto-translation trigger
│       ├── map.js             # Leaflet maps for worker jobs & employer location pin
│       ├── sos.js             # Emergency SOS modal, hospital routing & WhatsApp alert
│       ├── voice.js           # Voice assistant commands, TTS & chat voice-to-text
│       ├── wallet.js          # Wallet UI, top-ups, withdrawals & transaction ledger
│       └── worker.js          # Worker job feed, multi-language audio briefs & active job banner
├── Procfile                   # Process file for deployment
├── render.yaml                # Render Blueprint configuration
└── README.md
```

---

## Local Setup & Installation

### Prerequisites
- Python 3.9 or higher
- Modern browser (Google Chrome recommended for Web Speech API voice features)

### Steps
1. **Clone the repository**
   ```bash
   git clone [https://github.com/aryan-hq/shramvani-hackwithdelhi.git](https://github.com/aryan-hq/shramvani-hackwithdelhi.git)
   cd shramvani-hackwithdelhi
   ```

2. **Create and activate a virtual environment (optional but recommended)**
   ```bash
   python -m venv venv
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # macOS / Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Run the application**
   ```bash
   cd backend
   python app.py
   ```

5. **Open in browser**
   Visit `http://127.0.0.1:5000` in Google Chrome.

---

## Deployment (Render)

Shramvani is configured for zero-cost deployment on **Render**:
- **Runtime:** Python 3
- **Root Directory:** *(leave blank)*
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT`

---

## Future Roadmap
- **Live UPI & Banking Integration:** Connect RazorpayX / Cashfree Payouts for real-time escrow settlement and bank transfers.
- **Verified Digital Identity:** Integrate DigiLocker / official eKYC APIs once licensed for production.
- **PostgreSQL Migration:** Move from SQLite to managed PostgreSQL for high-concurrency production scale.
- **Worker Ratings & Skill Badges:** Build portable digital work histories and credit-worthiness scores for daily-wage workers.

---

## Team VYNTRIX
Built with purpose for **HackWithDelhi 4.0**.
Team Members : Aryan Yadav, Aayush, Rounak Sharma, Saurabh Sharma

- **Repository:** [github.com/aryan-hq/shramvani-hackwithdelhi](https://github.com/aryan-hq/shramvani-hackwithdelhi)
- **Live Prototype:** https://shramvani-hackwithdelhi.onrender.com/