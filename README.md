# KaamSetu — Voice-First Hyper-Local Job & Worker Protection Platform

**HackWithDelhi 4.0 | Track 6: Education, Skills & Employment (PS3)**

Zero API keys required. Built with Python Flask, SQLite, Leaflet + OpenStreetMap, Hindi Web Speech API, and gTTS.

## Key Differentiators
1. **Bolti Hui Kaam Parchi & Voice Udhaar Khata:** Locks agreed daily wage & days before work starts with Hindi audio confirmation, logs evening voice payment notes ("Aaj 500 mile, 300 baaki hain"), and generates 2-day payment reminders.
2. **Toli / Jodi Mode:** Mistri + Helpers register as one team (e.g., 1 Rajmistri + 2 Beldar = ₹2,000/day) and employers book the entire crew in 1 click.
3. **Live Geo-Stamped On-Site Proof & 1-Tap SOS:** Displays live proof of active employment with employer details, timestamp, and location, plus an emergency SOS button that locates the nearest East Delhi/Noida government hospital and prepares an instant family alert.
4. **Interactive Map & Google Maps Navigation:** Employers pin exact work spots; workers get 1-tap turn-by-turn Google Maps directions.

## Quick Start (VS Code)
```bash
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
python app.py
```
Open `http://127.0.0.1:5000` in **Google Chrome**.
