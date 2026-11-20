import math
import sqlite3
from datetime import datetime, timedelta

DB_PATH = "kaam.db"

# Real coordinates for East Delhi & Noida neighborhoods (zero Maps API cost)
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

# Real Government Hospitals in East Delhi & Noida for 1-Tap SOS
GOVT_HOSPITALS = [
    {"name": "Lal Bahadur Shastri Hospital (Khichripur)", "lat": 28.6177, "lon": 77.3156, "phone": "011-22774145"},
    {"name": "Dr. Hedgewar Arogya Sansthan (Karkardooma)", "lat": 28.6542, "lon": 77.2977, "phone": "011-22393155"},
    {"name": "Swami Dayanand Hospital (Dilshad Garden)", "lat": 28.6788, "lon": 77.3085, "phone": "011-22588585"},
    {"name": "District Hospital (Sector 30, Noida)", "lat": 28.5754, "lon": 77.3422, "phone": "0120-2450111"},
]

SKILL_HINDI = {
    "Electrician": "इलेक्ट्रीशियन",
    "Plumber": "प्लंबर",
    "Helper": "हेल्पर",
    "Painter": "पेंटर",
    "Carpenter": "कारपेंटर",
    "Mason": "राजमिस्त्री",
}


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
            best["maps_url"] = f"https://www.google.com/maps/dir/?api=1&destination={h['lat']},{h['lon']}"
    return best


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            skill TEXT NOT NULL,
            area TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            daily_rate INTEGER NOT NULL,
            phone TEXT NOT NULL,
            verified_count INTEGER DEFAULT 0,
            last_verifier TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tolis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leader_name TEXT NOT NULL,
            skill TEXT NOT NULL,
            composition TEXT NOT NULL,
            team_size INTEGER NOT NULL,
            member_phones TEXT NOT NULL,
            area TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            team_rate INTEGER NOT NULL,
            leader_phone TEXT NOT NULL,
            verified_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'available',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employer_name TEXT NOT NULL,
            employer_type TEXT NOT NULL DEFAULT 'Shop',
            skill TEXT NOT NULL,
            area TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            days INTEGER NOT NULL,
            daily_rate INTEGER NOT NULL,
            phone TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS parchis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER DEFAULT 0,
            worker_name TEXT NOT NULL,
            worker_phone TEXT NOT NULL,
            employer_name TEXT NOT NULL,
            employer_phone TEXT NOT NULL,
            skill TEXT NOT NULL,
            area TEXT NOT NULL,
            address TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            days INTEGER NOT NULL,
            agreed_rate INTEGER NOT NULL,
            total_agreed INTEGER NOT NULL,
            paid_amount INTEGER DEFAULT 0,
            pending_amount INTEGER DEFAULT 0,
            reminder_date TEXT NOT NULL,
            started_at TEXT NOT NULL,
            status TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS khata_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parchi_id INTEGER NOT NULL,
            transcript TEXT NOT NULL,
            received_amount INTEGER DEFAULT 0,
            pending_amount INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parchi_id INTEGER DEFAULT 0,
            worker_name TEXT NOT NULL,
            employer_name TEXT NOT NULL,
            address TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            family_phone TEXT NOT NULL,
            nearest_hospital TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            worker_id INTEGER NOT NULL,
            employer_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(job_id, worker_id)
        );
    """)

    count = cur.execute("SELECT COUNT(*) FROM workers").fetchone()[0]
    if count == 0:
        now = datetime.now()
        now_iso = now.isoformat()

        seed_workers = [
            ("Ramesh Kumar", "Electrician", "Shakarpur", 28.6279, 77.2815, 700, "9811223301", 4, "Gupta Kirana Store", now_iso),
            ("Suresh Yadav", "Plumber", "Laxmi Nagar", 28.6304, 77.2772, 650, "9811223302", 6, "Sharma Hardware", now_iso),
            ("Mohan Lal", "Helper", "Pandav Nagar", 28.6152, 77.2845, 550, "9811223303", 3, "Aggarwal Sweets", now_iso),
            ("Imran Ansari", "Electrician", "Preet Vihar", 28.6415, 77.2950, 750, "9811223304", 5, "Verma Electronics", now_iso),
            ("Deepak Verma", "Carpenter", "Vasundhara Enclave", 28.5992, 77.3175, 800, "9811223305", 2, "Bhatia Furniture", now_iso),
            ("Sunil Paswan", "Helper", "Sector 15 Noida", 28.5847, 77.3116, 600, "9811223306", 7, "Noida Fresh Mart", now_iso),
            ("Vikram Singh", "Painter", "Mayur Vihar", 28.6075, 77.2940, 700, "9811223307", 4, "RWA Block C", now_iso),
            ("Kamlesh Sahu", "Electrician", "Nirman Vihar", 28.6368, 77.2869, 680, "9811223308", 3, "Jain Medical Store", now_iso),
        ]
        cur.executemany(
            """INSERT INTO workers
               (name, skill, area, lat, lon, daily_rate, phone, verified_count, last_verifier, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            seed_workers,
        )

        seed_tolis = [
            ("Rajesh Mistri Toli", "Mason", "1 Rajmistri + 2 Beldar", 3, "9811334401, 9811334402", "Laxmi Nagar", 28.6304, 77.2772, 2000, "9811334400", 8, "available", now_iso),
            ("Anil Painter Jodi", "Painter", "1 Senior Painter + 1 Helper", 2, "9811334411", "Preet Vihar", 28.6415, 77.2950, 1350, "9811334410", 5, "available", now_iso),
            ("Imran Wiring Team", "Electrician", "1 Electrician + 1 Helper", 2, "9811334421", "Shakarpur", 28.6279, 77.2815, 1300, "9811334420", 6, "available", now_iso),
        ]
        cur.executemany(
            """INSERT INTO tolis
               (leader_name, skill, composition, team_size, member_phones, area, lat, lon, team_rate, leader_phone, verified_count, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            seed_tolis,
        )

        seed_jobs = [
            ("Gupta Kirana Store", "Shop", "Helper", "Laxmi Nagar", "Shop 14, Main Market, Near Metro Gate 3", 28.6311, 77.2779, 3, 600, "9810011221", "open", now_iso),
            ("Verma Electronics", "Shop", "Electrician", "Shakarpur", "B-22, Vikas Marg, Opp. Axis Bank", 28.6285, 77.2821, 2, 800, "9810011222", "open", now_iso),
            ("Sharma Ji", "Homeowner", "Plumber", "Preet Vihar", "Flat 302, C-Block, Near Community Park", 28.6420, 77.2958, 1, 700, "9810011223", "open", now_iso),
            ("Noida Fresh Mart", "Shop", "Helper", "Sector 15 Noida", "G-8, Naya Bans Market, Near Sector 15 Metro", 28.5852, 77.3122, 5, 650, "9810011224", "open", now_iso),
            ("Bhatia Furniture", "Contractor", "Carpenter", "Vasundhara Enclave", "Plot 9, Main Road, Near Dharamshila Hospital", 28.5998, 77.3182, 4, 850, "9810011225", "open", now_iso),
            ("Jain Medical Store", "Shop", "Electrician", "Nirman Vihar", "Shop 4, V3S Mall Lane, Nirman Vihar", 28.6373, 77.2874, 1, 700, "9810011226", "open", now_iso),
        ]
        cur.executemany(
            """INSERT INTO jobs
               (employer_name, employer_type, skill, area, address, lat, lon, days, daily_rate, phone, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            seed_jobs,
        )

        # Seed 1 live active Digital Kaam Parchi so Parchi & SOS tab is immediately rich
        reminder_dt = (now + timedelta(days=2)).strftime("%d %b %Y")
        cur.execute(
            """INSERT INTO parchis
               (job_id, worker_name, worker_phone, employer_name, employer_phone, skill, area, address, lat, lon,
                days, agreed_rate, total_agreed, paid_amount, pending_amount, reminder_date, started_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                2, "Raju", "9811000099", "Sharma Kirana Store", "9810011221",
                "Electrician", "Laxmi Nagar", "Shop 14, Main Market, Near Metro Gate 3",
                28.6311, 77.2779, 2, 800, 1600, 500, 300,
                reminder_dt, now.strftime("%d %b %Y, %I:%M %p"), "active",
            ),
        )
        parchi_id = cur.lastrowid
        cur.execute(
            """INSERT INTO khata_entries (parchi_id, transcript, received_amount, pending_amount, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (parchi_id, "Aaj 500 mile, 300 baaki hain", 500, 300, now.strftime("%d %b, %I:%M %p")),
        )

    conn.commit()
    conn.close()
