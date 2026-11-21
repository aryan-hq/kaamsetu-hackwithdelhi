import hashlib
import hmac
import math
import os
import secrets
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kaamsetu.db")

AREAS = {
    "Laxmi Nagar": (28.6304, 77.2772),
    "Shakarpur": (28.6279, 77.2815),
    "Preet Vihar": (28.6415, 77.2950),
    "Nirman Vihar": (28.6368, 77.2869),
    "Mayur Vihar": (28.6075, 77.2940),
    "Patparganj": (28.6245, 77.2975),
    "Vasundhara Enclave": (28.5992, 77.3175),
    "Sector 15 Noida": (28.5847, 77.3116),
    "Sector 18 Noida": (28.5708, 77.3261),
    "Pandav Nagar": (28.6152, 77.2845),
    "Mandawali": (28.6258, 77.3025),
    "Karkardooma": (28.6485, 77.3046),
    "Anand Vihar": (28.6469, 77.3160),
    "IP Extension": (28.6285, 77.3082),
    "New Ashok Nagar": (28.5892, 77.3022),
}

SKILLS = ["Electrician", "Plumber", "Helper", "Painter", "Carpenter", "Mason"]

SKILL_HINDI = {
    "Electrician": "इलेक्ट्रीशियन",
    "Plumber": "प्लंबर",
    "Helper": "हेल्पर",
    "Painter": "पेंटर",
    "Carpenter": "कारपेंटर",
    "Mason": "राजमिस्त्री",
}

GOVT_HOSPITALS = [
    {"name": "Lal Bahadur Shastri Hospital (Khichripur)", "lat": 28.6177, "lon": 77.3156, "phone": "011-22774145"},
    {"name": "Dr. Hedgewar Arogya Sansthan (Karkardooma)", "lat": 28.6542, "lon": 77.2977, "phone": "011-22393155"},
    {"name": "Swami Dayanand Hospital (Dilshad Garden)", "lat": 28.6788, "lon": 77.3085, "phone": "011-22588585"},
    {"name": "District Hospital (Sector 30, Noida)", "lat": 28.5754, "lon": 77.3422, "phone": "0120-2450111"},
]


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, expected_hex = stored_hash.split("$", 1)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return hmac.compare_digest(dk.hex(), expected_hex)


def safe_user(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def haversine_coords_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(2 * 6371.0 * math.asin(math.sqrt(a)), 2)


def find_nearest_hospital(lat: float, lon: float) -> dict:
    best = None
    best_dist = 999.0
    for h in GOVT_HOSPITALS:
        d = haversine_coords_km(lat, lon, h["lat"], h["lon"])
        if d < best_dist:
            best_dist = d
            best = dict(h)
            best["distance_km"] = d
            best["maps_url"] = (
                f"https://www.google.com/maps/dir/?api=1&destination={h['lat']},{h['lon']}&travelmode=driving"
            )
    return best


def mask_phone(phone: str) -> str:
    s = str(phone or "")
    if len(s) >= 10:
        return s[:2] + "XXXXXX" + s[-2:]
    return "XXXXXXXXXX"


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'worker',
            auth_method TEXT NOT NULL DEFAULT 'phone',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            password_hash TEXT NOT NULL DEFAULT '',
            skill TEXT DEFAULT '',
            employer_type TEXT DEFAULT 'Shop',
            area TEXT DEFAULT 'Laxmi Nagar',
            profile_completed INTEGER NOT NULL DEFAULT 0,
            wallet_balance INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employer_id INTEGER DEFAULT 0,
            employer_name TEXT NOT NULL,
            employer_type TEXT NOT NULL DEFAULT 'Shop',
            skill TEXT NOT NULL,
            area TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            duration_label TEXT NOT NULL DEFAULT 'Full Day (8 hrs)',
            days INTEGER NOT NULL DEFAULT 1,
            pay_amount INTEGER NOT NULL,
            payment_mode TEXT NOT NULL DEFAULT 'Cash',
            payment_verified INTEGER NOT NULL DEFAULT 0,
            payment_method_used TEXT NOT NULL DEFAULT '',
            upi_ref_id TEXT NOT NULL DEFAULT '',
            worker_ended INTEGER NOT NULL DEFAULT 0,
            employer_ended INTEGER NOT NULL DEFAULT 0,
            phone TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            accepted_worker_id INTEGER DEFAULT 0,
            accepted_worker_name TEXT DEFAULT '',
            accepted_worker_phone TEXT DEFAULT '',
            accepted_at TEXT DEFAULT '',
            completed_at TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS job_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            sender_role TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            job_id INTEGER DEFAULT 0,
            tx_type TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            amount INTEGER NOT NULL,
            title TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
    """)

    if cur.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        now_iso = datetime.now().isoformat()
        demo_pw = hash_password("password123")

        cur.execute(
            """INSERT INTO users
               (name, role, auth_method, phone, email, password_hash, skill, employer_type, area, profile_completed, wallet_balance, created_at)
               VALUES (?, 'employer', 'phone', '9810011221', 'gupta.store@gmail.com', ?, '', 'Shop', 'Laxmi Nagar', 1, 2500, ?)""",
            ("Gupta Kirana Store", demo_pw, now_iso),
        )
        emp_id = cur.lastrowid

        cur.execute(
            """INSERT INTO users
               (name, role, auth_method, phone, email, password_hash, skill, employer_type, area, profile_completed, wallet_balance, created_at)
               VALUES (?, 'worker', 'phone', '9811000099', 'raju.worker@gmail.com', ?, 'Electrician', '', 'Laxmi Nagar', 1, 450, ?)""",
            ("Raju Kumar", demo_pw, now_iso),
        )

        # Seed open jobs across all skills so any worker gets skill-matched suggestions immediately
        seed_jobs = [
            (emp_id, "Verma Electronics", "Shop", "Electrician", "Shakarpur", "B-22, Vikas Marg, Opp. Axis Bank", 28.6285, 77.2821, "4 Hours (Half Day)", 1, 550, "UPI", "9810011221", now_iso),
            (emp_id, "Gupta Kirana Store", "Shop", "Electrician", "Laxmi Nagar", "Shop 14, Main Market, Near Metro Gate 3", 28.6311, 77.2779, "Full Day (8 hrs)", 1, 850, "Cash", "9810011221", now_iso),
            (emp_id, "Sharma Ji", "Homeowner", "Plumber", "Preet Vihar", "Flat 302, C-Block, Near Community Park", 28.6420, 77.2958, "2 Hours (Quick Fix)", 1, 450, "Cash", "9810011221", now_iso),
            (emp_id, "Noida Fresh Mart", "Shop", "Helper", "Sector 15 Noida", "G-8, Naya Bans Market, Near Sector 15 Metro", 28.5852, 77.3122, "Full Day (8 hrs)", 1, 650, "UPI", "9810011221", now_iso),
            (emp_id, "Bhatia Furniture", "Contractor", "Carpenter", "Vasundhara Enclave", "Plot 9, Main Road, Near Dharamshila Hospital", 28.5998, 77.3182, "2 Days", 2, 1600, "Cash", "9810011221", now_iso),
            (emp_id, "RWA Block C", "Homeowner", "Painter", "Mayur Vihar", "House 18, Pocket B, Phase 1", 28.6079, 77.2945, "Full Day (8 hrs)", 1, 750, "UPI", "9810011221", now_iso),
            (emp_id, "Mehta Builders", "Contractor", "Mason", "Nirman Vihar", "Site 4, Near V3S Mall", 28.6371, 77.2875, "2 Days", 2, 1800, "Cash", "9810011221", now_iso),
        ]
        cur.executemany(
            """INSERT INTO jobs
               (employer_id, employer_name, employer_type, skill, area, address, lat, lon,
                duration_label, days, pay_amount, payment_mode, phone, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            seed_jobs,
        )

    conn.commit()
    conn.close()
