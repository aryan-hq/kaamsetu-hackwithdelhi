import io
import urllib.parse
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, send_file

from ai_parser import VALID_SKILLS, parse_job_speech, parse_khata_speech, parse_worker_speech
from database import AREAS, SKILL_HINDI, find_nearest_hospital, get_conn, haversine_coords_km, init_db

app = Flask(__name__)
init_db()


def build_hindi_job_script(job: dict) -> str:
    skill_hi = SKILL_HINDI.get(job["skill"], job["skill"])
    landmark_part = f" पता: {job['address']}।" if job.get("address") else ""
    return (
        f"आपके पास {job['area']} में {job['employer_name']} पर "
        f"{skill_hi} का काम है।{landmark_part} {job['days']} दिन के लिए "
        f"{job['daily_rate']} रुपये रोज़ मिलेंगे। "
        f"काम शुरू करने के लिए पर्ची लॉक करें या रास्ता देखने के लिए मैप दबाएं।"
    )


def build_parchi_audio(parchi: dict) -> str:
    return (
        f"{parchi['worker_name']} और {parchi['employer_name']} के बीच "
        f"{parchi['agreed_rate']} रुपये रोज़ाना पर {parchi['days']} दिन का काम तय हुआ है। "
        f"डिजिटल काम पर्ची लॉक हो गई है।"
    )


def enrich_job(job: dict) -> dict:
    job["hindi_audio_text"] = build_hindi_job_script(job)
    job["maps_url"] = f"https://www.google.com/maps/dir/?api=1&destination={job['lat']},{job['lon']}"
    return job


def enrich_parchi(parchi: dict, entries: list) -> dict:
    parchi["audio_script"] = build_parchi_audio(parchi)
    parchi["maps_url"] = f"https://www.google.com/maps/dir/?api=1&destination={parchi['lat']},{parchi['lon']}"
    parchi["khata_entries"] = entries
    reminder_msg = (
        f"Namaste {parchi['employer_name']}, KaamSetu Digital Parchi #{parchi['id']} ke anusar "
        f"{parchi['worker_name']} ka ₹{parchi['pending_amount']} udhaar/baaki hai "
        f"(Agreed: ₹{parchi['agreed_rate']}/day, Paid: ₹{parchi['paid_amount']}). Kripya samay par bhugtan karein."
    )
    parchi["reminder_whatsapp_url"] = (
        f"https://wa.me/91{parchi['employer_phone']}?text={urllib.parse.quote(reminder_msg)}"
    )
    return parchi


@app.route("/")
def index():
    return render_template(
        "index.html",
        areas=list(AREAS.keys()),
        areas_coords=AREAS,
        skills=VALID_SKILLS,
    )


# ==================== WORKERS ====================
@app.route("/api/worker/voice-profile", methods=["POST"])
def create_worker_from_voice():
    data = request.get_json(force=True)
    transcript = (data.get("transcript") or "").strip()
    phone = (data.get("phone") or "9811000099").strip()

    if not transcript:
        return jsonify({"error": "Kripya kuch boliye (empty transcript)."}), 400

    parsed = parse_worker_speech(transcript)
    lat, lon = AREAS.get(parsed["area"], (28.6304, 77.2772))
    now = datetime.now().isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO workers
           (name, skill, area, lat, lon, daily_rate, phone, verified_count, last_verifier, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', ?)""",
        (parsed["name"], parsed["skill"], parsed["area"], lat, lon, parsed["daily_rate"], phone, now),
    )
    worker_id = cur.lastrowid
    conn.commit()
    worker = dict(cur.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone())
    conn.close()

    return jsonify({"worker": worker}), 201


@app.route("/api/workers", methods=["GET"])
def list_workers():
    skill = request.args.get("skill", "").strip()
    area = request.args.get("area", "").strip()
    lat_param = request.args.get("lat")
    lon_param = request.args.get("lon")
    max_km = float(request.args.get("max_km", 5.0))

    origin = None
    if lat_param and lon_param:
        origin = (float(lat_param), float(lon_param))
    elif area and area in AREAS:
        origin = AREAS[area]

    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM workers ORDER BY verified_count DESC, id DESC").fetchall()]
    conn.close()

    results = []
    for w in rows:
        if skill and skill != "All" and w["skill"].lower() != skill.lower():
            continue
        if origin:
            dist = haversine_coords_km(origin[0], origin[1], w["lat"], w["lon"])
            if dist > max_km:
                continue
            w["distance_km"] = dist
        else:
            w["distance_km"] = 0.0
        results.append(w)

    if origin:
        results.sort(key=lambda x: (x["distance_km"], -x["verified_count"]))

    return jsonify({"workers": results})


# ==================== TOLI / JODI MODE ====================
@app.route("/api/tolis", methods=["GET"])
def list_tolis():
    skill = request.args.get("skill", "").strip()
    area = request.args.get("area", "").strip()
    origin = AREAS.get(area) if area in AREAS else None

    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM tolis ORDER BY verified_count DESC, id DESC").fetchall()]
    conn.close()

    results = []
    for t in rows:
        if skill and skill != "All" and t["skill"].lower() != skill.lower():
            continue
        t["distance_km"] = haversine_coords_km(origin[0], origin[1], t["lat"], t["lon"]) if origin else 0.0
        results.append(t)

    if origin:
        results.sort(key=lambda x: x["distance_km"])
    return jsonify({"tolis": results})


@app.route("/api/tolis", methods=["POST"])
def create_toli():
    data = request.get_json(force=True)
    leader_name = (data.get("leader_name") or "Raju Mistri Toli").strip()
    skill = (data.get("skill") or "Mason").strip()
    helper_count = max(1, min(6, int(data.get("helper_count", 2))))
    member_phones = (data.get("member_phones") or "9811445501, 9811445502").strip()
    area = (data.get("area") or "Laxmi Nagar").strip()
    team_rate = int(data.get("team_rate", 2000))
    leader_phone = (data.get("leader_phone") or "9811000099").strip()

    lat, lon = AREAS.get(area, (28.6304, 77.2772))
    team_size = 1 + helper_count
    composition = f"1 {skill} + {helper_count} Helper"
    now = datetime.now().isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO tolis
           (leader_name, skill, composition, team_size, member_phones, area, lat, lon, team_rate, leader_phone, verified_count, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'available', ?)""",
        (leader_name, skill, composition, team_size, member_phones, area, lat, lon, team_rate, leader_phone, now),
    )
    toli_id = cur.lastrowid
    conn.commit()
    toli = dict(cur.execute("SELECT * FROM tolis WHERE id = ?", (toli_id,)).fetchone())
    conn.close()
    return jsonify({"toli": toli}), 201


@app.route("/api/tolis/<int:toli_id>/book", methods=["POST"])
def book_toli(toli_id: int):
    """1-Click Team Booking: books the entire Toli and locks a Team Digital Kaam Parchi."""
    data = request.get_json(force=True)
    employer_name = (data.get("employer_name") or "Local Employer").strip()
    employer_phone = (data.get("employer_phone") or "9810011221").strip()
    address = (data.get("address") or "Near Main Market").strip()
    days = max(1, int(data.get("days", 2)))

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM tolis WHERE id = ?", (toli_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Toli not found"}), 404
    toli = dict(row)

    cur.execute("UPDATE tolis SET status = 'booked' WHERE id = ?", (toli_id,))
    now = datetime.now()
    reminder_dt = (now + timedelta(days=2)).strftime("%d %b %Y")
    total_agreed = toli["team_rate"] * days

    cur.execute(
        """INSERT INTO parchis
           (job_id, worker_name, worker_phone, employer_name, employer_phone, skill, area, address, lat, lon,
            days, agreed_rate, total_agreed, paid_amount, pending_amount, reminder_date, started_at, status)
           VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active')""",
        (
            f"{toli['leader_name']} ({toli['composition']})",
            toli["leader_phone"],
            employer_name,
            employer_phone,
            toli["skill"],
            toli["area"],
            address,
            toli["lat"],
            toli["lon"],
            days,
            toli["team_rate"],
            total_agreed,
            total_agreed,
            reminder_dt,
            now.strftime("%d %b %Y, %I:%M %p"),
        ),
    )
    parchi_id = cur.lastrowid
    conn.commit()
    parchi = dict(cur.execute("SELECT * FROM parchis WHERE id = ?", (parchi_id,)).fetchone())
    conn.close()

    return jsonify({"toli": toli, "parchi": enrich_parchi(parchi, [])}), 201


# ==================== JOBS ====================
@app.route("/api/jobs", methods=["GET"])
def list_jobs():
    skill = request.args.get("skill", "").strip()
    area = request.args.get("area", "").strip()
    include_closed = request.args.get("include_closed", "0") == "1"
    max_km = float(request.args.get("max_km", 6.0))
    origin = AREAS.get(area) if area in AREAS else None

    conn = get_conn()
    if include_closed:
        rows = [dict(r) for r in conn.execute("SELECT * FROM jobs ORDER BY id DESC").fetchall()]
    else:
        rows = [dict(r) for r in conn.execute("SELECT * FROM jobs WHERE status = 'open' ORDER BY id DESC").fetchall()]
    conn.close()

    results = []
    for j in rows:
        if skill and skill != "All" and j["skill"].lower() != skill.lower():
            continue
        if origin:
            dist = haversine_coords_km(origin[0], origin[1], j["lat"], j["lon"])
            if dist > max_km:
                continue
            j["distance_km"] = dist
        else:
            j["distance_km"] = 0.0
        results.append(enrich_job(j))

    if origin:
        results.sort(key=lambda x: x["distance_km"])
    return jsonify({"jobs": results})


@app.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.get_json(force=True)
    transcript = (data.get("transcript") or "").strip()

    if transcript:
        parsed = parse_job_speech(transcript)
        skill = data.get("skill") or parsed["skill"]
        area = data.get("area") or parsed["area"]
        days = int(data.get("days") or parsed["days"])
        daily_rate = int(data.get("daily_rate") or parsed["daily_rate"])
    else:
        skill = data.get("skill", "Electrician")
        area = data.get("area", "Laxmi Nagar")
        days = int(data.get("days", 2))
        daily_rate = int(data.get("daily_rate", 700))

    employer_name = (data.get("employer_name") or "Local Employer").strip()
    employer_type = (data.get("employer_type") or "Shop").strip()
    address = (data.get("address") or f"Near Main Market, {area}").strip()
    phone = (data.get("phone") or "9810099887").strip()

    default_lat, default_lon = AREAS.get(area, (28.6304, 77.2772))
    lat = float(data.get("lat") or default_lat)
    lon = float(data.get("lon") or default_lon)
    now = datetime.now().isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO jobs
           (employer_name, employer_type, skill, area, address, lat, lon, days, daily_rate, phone, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
        (employer_name, employer_type, skill, area, address, lat, lon, days, daily_rate, phone, now),
    )
    job_id = cur.lastrowid
    conn.commit()
    job = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()))

    all_workers = [dict(r) for r in conn.execute("SELECT * FROM workers").fetchall()]
    conn.close()

    matching = []
    for w in all_workers:
        if w["skill"].lower() != skill.lower():
            continue
        dist = haversine_coords_km(lat, lon, w["lat"], w["lon"])
        if dist <= 4.0:
            w["distance_km"] = dist
            matching.append(w)

    matching.sort(key=lambda x: (x["distance_km"], -x["verified_count"]))
    return jsonify({"job": job, "matching_workers": matching}), 201


@app.route("/api/jobs/<int:job_id>/close", methods=["POST"])
def close_job(job_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE jobs SET status = 'completed' WHERE id = ?", (job_id,))
    conn.commit()
    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"job": enrich_job(dict(row))}), 200


# ==================== BOLTI HUI KAAM PARCHI & VOICE KHATA ====================
@app.route("/api/parchis", methods=["GET"])
def list_parchis():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM parchis ORDER BY id DESC").fetchall()]
    result = []
    for p in rows:
        entries = [
            dict(e)
            for e in conn.execute(
                "SELECT * FROM khata_entries WHERE parchi_id = ? ORDER BY id DESC", (p["id"],)
            ).fetchall()
        ]
        result.append(enrich_parchi(p, entries))
    conn.close()
    return jsonify({"parchis": result})


@app.route("/api/parchi/start", methods=["POST"])
def start_parchi():
    """Locks a Digital Kaam Parchi between Worker & Employer with timestamp + GPS proof."""
    data = request.get_json(force=True)
    job_id = int(data.get("job_id", 0))
    worker_name = (data.get("worker_name") or "Raju").strip()
    worker_phone = (data.get("worker_phone") or "9811000099").strip()

    conn = get_conn()
    cur = conn.cursor()
    if job_id:
        job_row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not job_row:
            conn.close()
            return jsonify({"error": "Job not found"}), 404
        j = dict(job_row)
        employer_name = j["employer_name"]
        employer_phone = j["phone"]
        skill = j["skill"]
        area = j["area"]
        address = j["address"]
        lat = j["lat"]
        lon = j["lon"]
        days = j["days"]
        agreed_rate = j["daily_rate"]
    else:
        employer_name = (data.get("employer_name") or "Sharma Kirana").strip()
        employer_phone = (data.get("employer_phone") or "9810011221").strip()
        skill = (data.get("skill") or "Electrician").strip()
        area = (data.get("area") or "Laxmi Nagar").strip()
        address = (data.get("address") or f"Main Market, {area}").strip()
        lat, lon = AREAS.get(area, (28.6304, 77.2772))
        days = int(data.get("days", 2))
        agreed_rate = int(data.get("agreed_rate", 800))

    now = datetime.now()
    reminder_dt = (now + timedelta(days=2)).strftime("%d %b %Y")
    total_agreed = agreed_rate * days

    cur.execute(
        """INSERT INTO parchis
           (job_id, worker_name, worker_phone, employer_name, employer_phone, skill, area, address, lat, lon,
            days, agreed_rate, total_agreed, paid_amount, pending_amount, reminder_date, started_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'active')""",
        (
            job_id, worker_name, worker_phone, employer_name, employer_phone,
            skill, area, address, lat, lon, days, agreed_rate, total_agreed,
            reminder_dt, now.strftime("%d %b %Y, %I:%M %p"),
        ),
    )
    parchi_id = cur.lastrowid
    conn.commit()
    parchi = dict(cur.execute("SELECT * FROM parchis WHERE id = ?", (parchi_id,)).fetchone())
    conn.close()
    return jsonify({"parchi": enrich_parchi(parchi, [])}), 201


@app.route("/api/parchi/<int:parchi_id>/khata", methods=["POST"])
def add_khata_entry(parchi_id: int):
    """Logs worker's evening Hindi voice note into Udhaar Khata and updates pending balance."""
    data = request.get_json(force=True)
    transcript = (data.get("transcript") or "").strip()
    if not transcript:
        return jsonify({"error": "Empty khata voice note."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM parchis WHERE id = ?", (parchi_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Parchi not found"}), 404
    parchi = dict(row)

    parsed = parse_khata_speech(transcript, agreed_daily_rate=parchi["agreed_rate"])
    now_str = datetime.now().strftime("%d %b, %I:%M %p")
    reminder_dt = (datetime.now() + timedelta(days=2)).strftime("%d %b %Y")

    cur.execute(
        """INSERT INTO khata_entries (parchi_id, transcript, received_amount, pending_amount, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (parchi_id, transcript, parsed["received"], parsed["pending"], now_str),
    )

    new_paid = parchi["paid_amount"] + parsed["received"]
    new_pending = parchi["pending_amount"] + parsed["pending"]
    cur.execute(
        """UPDATE parchis SET paid_amount = ?, pending_amount = ?, reminder_date = ? WHERE id = ?""",
        (new_paid, new_pending, reminder_dt, parchi_id),
    )
    conn.commit()

    updated = dict(cur.execute("SELECT * FROM parchis WHERE id = ?", (parchi_id,)).fetchone())
    entries = [
        dict(e)
        for e in cur.execute("SELECT * FROM khata_entries WHERE parchi_id = ? ORDER BY id DESC", (parchi_id,)).fetchall()
    ]
    conn.close()

    hindi_ack = (
        f"हिसाब दर्ज हो गया। {parsed['received']} रुपये मिले और {parsed['pending']} रुपये बाकी लिखे गए हैं। "
        f"दो दिन बाद मालिक को अपने आप रिमाइंडर भेजा जाएगा।"
    )
    return jsonify({"parchi": enrich_parchi(updated, entries), "hindi_ack": hindi_ack, "parsed": parsed}), 200


# ==================== ON-SITE PROOF & 1-TAP SOS ====================
@app.route("/api/sos", methods=["POST"])
def trigger_sos():
    """Logs emergency SOS with live geo-stamped proof + nearest East Delhi Govt Hospital."""
    data = request.get_json(force=True)
    parchi_id = int(data.get("parchi_id", 0))
    family_phone = (data.get("family_phone") or "9811998877").strip()
    live_lat = data.get("lat")
    live_lon = data.get("lon")

    conn = get_conn()
    cur = conn.cursor()
    parchi = None
    if parchi_id:
        row = cur.execute("SELECT * FROM parchis WHERE id = ?", (parchi_id,)).fetchone()
        if row:
            parchi = dict(row)

    worker_name = parchi["worker_name"] if parchi else (data.get("worker_name") or "Raju")
    employer_name = parchi["employer_name"] if parchi else "Active Work Site"
    employer_phone = parchi["employer_phone"] if parchi else "9810011221"
    address = parchi["address"] if parchi else "Laxmi Nagar, East Delhi"
    lat = float(live_lat) if live_lat else (parchi["lat"] if parchi else 28.6304)
    lon = float(live_lon) if live_lon else (parchi["lon"] if parchi else 77.2772)

    hospital = find_nearest_hospital(lat, lon)
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

    cur.execute(
        """INSERT INTO sos_alerts
           (parchi_id, worker_name, employer_name, address, lat, lon, family_phone, nearest_hospital, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (parchi_id, worker_name, employer_name, address, lat, lon, family_phone, hospital["name"], now_str),
    )
    alert_id = cur.lastrowid
    conn.commit()
    conn.close()

    maps_link = f"https://www.google.com/maps?q={lat},{lon}"
    sos_text = (
        f"EMERGENCY SOS (KaamSetu Proof #{parchi_id or alert_id}): "
        f"{worker_name} ko kaam par madad chahiye! "
        f"Employer: {employer_name} ({employer_phone}). "
        f"Site: {address}. Live Location: {maps_link} | "
        f"Nearest Govt Hospital: {hospital['name']} ({hospital['distance_km']} km)."
    )

    return jsonify({
        "alert_id": alert_id,
        "timestamp": now_str,
        "worker_name": worker_name,
        "employer_name": employer_name,
        "employer_phone": employer_phone,
        "address": address,
        "maps_link": maps_link,
        "nearest_hospital": hospital,
        "family_whatsapp_url": f"https://wa.me/91{family_phone}?text={urllib.parse.quote(sos_text)}",
        "hindi_audio": (
            f"आपातकालीन मदद अलर्ट चालू हो गया है। आपकी लोकेशन और मालिक की जानकारी परिवार को भेजने के लिए तैयार है। "
            f"सबसे नजदीकी सरकारी अस्पताल {hospital['name']} है।"
        ),
    }), 201


# ==================== TRUST BADGE & TTS ====================
@app.route("/api/verify", methods=["POST"])
def verify_worker():
    data = request.get_json(force=True)
    job_id = int(data.get("job_id", 0))
    worker_id = int(data.get("worker_id", 0))
    employer_name = (data.get("employer_name") or "Verified Employer").strip()

    if not job_id or not worker_id:
        return jsonify({"error": "job_id and worker_id are required."}), 400

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            """INSERT INTO verifications (job_id, worker_id, employer_name, created_at)
               VALUES (?, ?, ?, ?)""",
            (job_id, worker_id, employer_name, datetime.now().isoformat()),
        )
        cur.execute(
            """UPDATE workers
               SET verified_count = verified_count + 1, last_verifier = ?
               WHERE id = ?""",
            (employer_name, worker_id),
        )
        conn.commit()
        worker = dict(cur.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone())
        conn.close()
        return jsonify({"message": "Kaam Verified!", "worker": worker}), 200
    except Exception:
        conn.close()
        return jsonify({"error": "Already verified for this job."}), 409


@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    try:
        from gtts import gTTS
    except ImportError:
        return jsonify({"error": "gTTS not installed"}), 503

    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Empty text"}), 400

    try:
        buf = io.BytesIO()
        tts = gTTS(text=text, lang="hi", slow=False)
        tts.write_to_fp(buf)
        buf.seek(0)
        return send_file(buf, mimetype="audio/mpeg")
    except Exception:
        return jsonify({"error": "TTS offline"}), 503


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
