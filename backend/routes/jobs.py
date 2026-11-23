from datetime import datetime
from flask import Blueprint, jsonify, request
from database import AREAS, SKILL_HINDI, get_conn, haversine_coords_km, mask_phone

jobs_bp = Blueprint("jobs", __name__)


def _to_int(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _to_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def enrich_job(job: dict, reveal_phone: bool = False) -> dict:
    skill_hi = SKILL_HINDI.get(job["skill"], job["skill"])
    job["maps_url"] = (
        f"https://www.google.com/maps/dir/?api=1&destination={job['lat']},{job['lon']}&travelmode=driving"
    )
    job["hindi_audio_text"] = (
        f"{job['area']} में {job['employer_name']} पर {skill_hi} का काम है। "
        f"समय: {job['duration_label']}। भुगतान {job['pay_amount']} रुपये।"
    )
    if reveal_phone or job["status"] in ("accepted", "completed"):
        job["display_phone"] = job["phone"]
        job["phone_unlocked"] = True
    else:
        job["display_phone"] = mask_phone(job["phone"])
        job["phone_unlocked"] = False
    return job


def try_finalize_job(cur, job_id: int) -> bool:
    """Atomically completes the job ONLY when worker_ended=1, employer_ended=1, AND payment_verified=1."""
    now_str = datetime.now().strftime("%d %b, %I:%M %p")
    cur.execute(
        """UPDATE jobs
           SET status = 'completed', completed_at = ?
           WHERE id = ? AND status = 'accepted'
             AND worker_ended = 1 AND employer_ended = 1 AND payment_verified = 1""",
        (now_str, job_id),
    )
    if cur.rowcount == 1:
        cur.execute(
            """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
               VALUES (?, 'system', 'KaamSetu', ?, ?)""",
            (
                job_id,
                "Job Completed! Both parties ended the job and payment is verified. Worker is now free for new orders.",
                datetime.now().strftime("%I:%M %p"),
            ),
        )
        return True
    return False


@jobs_bp.route("/api/jobs", methods=["GET"])
def list_jobs():
    """
    Worker portal: filters open jobs strictly by worker's skill + optional search query.
    Employer portal: passes employer_id to see their own posted/active/completed orders + optional search query.
    """
    skill = request.args.get("skill", "").strip()
    area = request.args.get("area", "").strip()
    query = request.args.get("q", "").strip().lower()
    worker_id = _to_int(request.args.get("worker_id"), 0)
    employer_id = _to_int(request.args.get("employer_id"), 0)
    origin = AREAS.get(area) if area in AREAS else None

    conn = get_conn()
    if employer_id:
        rows = [
            dict(r)
            for r in conn.execute("SELECT * FROM jobs WHERE employer_id = ? ORDER BY id DESC", (employer_id,)).fetchall()
        ]
        active_job = None
    else:
        if worker_id and not skill:
            w = conn.execute("SELECT skill, area FROM users WHERE id = ?", (worker_id,)).fetchone()
            if w:
                skill = w["skill"] or ""
                if not origin and w["area"] in AREAS:
                    origin = AREAS[w["area"]]

        rows = [dict(r) for r in conn.execute("SELECT * FROM jobs WHERE status = 'open' ORDER BY id DESC").fetchall()]
        active_job = None
        if worker_id:
            aj = conn.execute(
                "SELECT * FROM jobs WHERE accepted_worker_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1",
                (worker_id,),
            ).fetchone()
            if aj:
                active_job = enrich_job(dict(aj), reveal_phone=True)
    conn.close()

    results = []
    for j in rows:
        if not employer_id and skill and j["skill"].lower() != skill.lower():
            continue
        if query:
            haystack = f"{j['employer_name']} {j['skill']} {j['area']} {j['address']} {j['duration_label']} {j['accepted_worker_name']}".lower()
            if query not in haystack:
                continue
        j["distance_km"] = haversine_coords_km(origin[0], origin[1], j["lat"], j["lon"]) if origin else 0.0
        results.append(enrich_job(j, reveal_phone=bool(employer_id)))

    if origin and not employer_id:
        results.sort(key=lambda x: x["distance_km"])

    return jsonify({"jobs": results, "active_job": active_job, "matched_skill": skill}), 200


@jobs_bp.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.get_json(force=True)
    employer_id = _to_int(data.get("employer_id"), 1)
    employer_name = (data.get("employer_name") or "Local Employer").strip()
    employer_type = (data.get("employer_type") or "Shop").strip()
    skill = (data.get("skill") or "Electrician").strip()
    area = (data.get("area") or "Laxmi Nagar").strip()
    address = (data.get("address") or f"Near Main Market, {area}").strip()
    duration_label = (data.get("duration_label") or "Full Day (8 hrs)").strip()
    days = max(1, _to_int(data.get("days"), 1))
    pay_amount = max(100, _to_int(data.get("pay_amount"), 700))
    payment_mode = (data.get("payment_mode") or "Cash").strip()
    phone = (data.get("phone") or "9810011221").strip()

    default_lat, default_lon = AREAS.get(area, (28.6304, 77.2772))
    lat = _to_float(data.get("lat"), default_lat)
    lon = _to_float(data.get("lon"), default_lon)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO jobs
           (employer_id, employer_name, employer_type, skill, area, address, lat, lon,
            duration_label, days, pay_amount, payment_mode, phone, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
        (
            employer_id, employer_name, employer_type, skill, area, address, lat, lon,
            duration_label, days, pay_amount, payment_mode, phone, datetime.now().isoformat(),
        ),
    )
    job_id = cur.lastrowid
    conn.commit()
    job = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()
    return jsonify({"job": job}), 201


@jobs_bp.route("/api/jobs/<int:job_id>/accept", methods=["POST"])
def accept_job(job_id: int):
    data = request.get_json(force=True)
    worker_id = _to_int(data.get("worker_id"), 0)
    worker_name = (data.get("worker_name") or "Worker").strip()
    worker_phone = (data.get("worker_phone") or "9811000099").strip()

    if worker_id <= 0:
        return jsonify({"error": "Invalid worker account. Please log in again."}), 400

    conn = get_conn()
    cur = conn.cursor()

    existing = cur.execute(
        "SELECT id, employer_name FROM jobs WHERE accepted_worker_id = ? AND status = 'accepted'",
        (worker_id,),
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({
            "error": f"You already have an active order with {existing['employer_name']} (#{existing['id']}). Both parties must end it and verify payment first."
        }), 409

    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Job not found."}), 404
    job = dict(row)

    now = datetime.now()
    now_str = now.strftime("%d %b %Y, %I:%M %p")

    # Atomic guard: succeeds ONLY if job is still 'open'
    cur.execute(
        """UPDATE jobs
           SET status = 'accepted', accepted_worker_id = ?, accepted_worker_name = ?,
               accepted_worker_phone = ?, accepted_at = ?
           WHERE id = ? AND status = 'open'""",
        (worker_id, worker_name, worker_phone, now_str, job_id),
    )
    if cur.rowcount == 0:
        conn.rollback()
        conn.close()
        return jsonify({"error": "This job has already been accepted."}), 409

    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, 'system', 'KaamSetu', ?, ?)""",
        (
            job_id,
            f"Order accepted by {worker_name} for {job['duration_label']} (₹{job['pay_amount']} · {job['payment_mode']}). Phone numbers are now unlocked.",
            now.strftime("%I:%M %p"),
        ),
    )
    conn.commit()
    updated_job = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    hindi_confirm = (
        f"काम स्वीकार हो गया है। {job['employer_name']} पर {job['duration_label']} के लिए "
        f"{job['pay_amount']} रुपये तय हैं।"
    )
    return jsonify({"job": updated_job, "hindi_confirm": hindi_confirm}), 200


@jobs_bp.route("/api/jobs/<int:job_id>/end", methods=["POST"])
def end_job(job_id: int):
    """Dual confirmation: both worker and employer must click End Job."""
    data = request.get_json(force=True)
    role = (data.get("role") or "").strip().lower()
    if role not in ("worker", "employer"):
        return jsonify({"error": "Invalid role."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row or row["status"] != "accepted":
        conn.close()
        return jsonify({"error": "Active order not found."}), 404

    if role == "worker":
        cur.execute("UPDATE jobs SET worker_ended = 1 WHERE id = ? AND status = 'accepted' AND worker_ended = 0", (job_id,))
        note = "Worker clicked End Job."
    else:
        cur.execute("UPDATE jobs SET employer_ended = 1 WHERE id = ? AND status = 'accepted' AND employer_ended = 0", (job_id,))
        note = "Employer clicked End Job."

    if cur.rowcount == 1:
        cur.execute(
            """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
               VALUES (?, 'system', 'KaamSetu', ?, ?)""",
            (job_id, note, datetime.now().strftime("%I:%M %p")),
        )

    finalized = try_finalize_job(cur, job_id)
    conn.commit()
    updated = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    msg = "Order completed & unlocked!" if finalized else f"{note} Waiting for remaining confirmation/payment verification."
    return jsonify({"job": updated, "completed": finalized, "message": msg}), 200


@jobs_bp.route("/api/jobs/<int:job_id>/messages", methods=["GET"])
def get_job_messages(job_id: int):
    conn = get_conn()
    msgs = [
        dict(r)
        for r in conn.execute("SELECT * FROM job_messages WHERE job_id = ? ORDER BY id ASC", (job_id,)).fetchall()
    ]
    conn.close()
    return jsonify({"messages": msgs}), 200


@jobs_bp.route("/api/jobs/<int:job_id>/messages", methods=["POST"])
def send_job_message(job_id: int):
    data = request.get_json(force=True)
    sender_role = (data.get("sender_role") or "worker").strip()
    sender_name = (data.get("sender_name") or "User").strip()
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Empty message"}), 400

    conn = get_conn()
    cur = conn.cursor()
    now_str = datetime.now().strftime("%I:%M %p")
    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (job_id, sender_role, sender_name, message, now_str),
    )
    msg_id = cur.lastrowid
    conn.commit()
    msg = dict(cur.execute("SELECT * FROM job_messages WHERE id = ?", (msg_id,)).fetchone())
    conn.close()
    return jsonify({"message": msg}), 201