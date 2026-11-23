import secrets
from datetime import datetime
from flask import Blueprint, jsonify, request
from database import (
    AREAS,
    PLATFORM_FEE_PERCENT,
    SKILL_HINDI,
    get_conn,
    haversine_coords_km,
    mask_phone,
)

jobs_bp = Blueprint("jobs", __name__)


def enrich_job(job: dict, reveal_phone: bool = False) -> dict:
    skill_hi = SKILL_HINDI.get(job["skill"], job["skill"])
    job["maps_url"] = (
        f"https://www.google.com/maps/dir/?api=1&destination={job['lat']},{job['lon']}&travelmode=driving"
    )
    job["hindi_audio_text"] = (
        f"{job['area']} में {job['employer_name']} पर {skill_hi} का काम है। "
        f"समय: {job['duration_label']}। आपको {job['worker_payout']} रुपये मिलेंगे।"
    )
    if reveal_phone or job["status"] in ("accepted", "completed"):
        job["display_phone"] = job["phone"]
        job["phone_unlocked"] = True
    else:
        job["display_phone"] = mask_phone(job["phone"])
        job["phone_unlocked"] = False
    return job


def try_release_escrow_and_complete(cur, job_id: int) -> bool:
    """
    Mediator Escrow Release:
    When BOTH worker_ended=1 and employer_ended=1:
    - Releases worker_payout (95%) from KaamSetu Escrow to Worker's Wallet.
    - Retains platform_fee (5%) as KaamSetu mediator cut.
    - Marks job completed and unlocks worker for next order.
    """
    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row or row["status"] != "accepted":
        return False
    if row["worker_ended"] == 1 and row["employer_ended"] == 1:
        now_str = datetime.now().strftime("%d %b, %I:%M %p")
        payout = row["worker_payout"]
        fee = row["platform_fee"]
        wid = row["accepted_worker_id"]

        if wid and row["escrow_status"] == "held":
            cur.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", (payout, wid))
            cur.execute(
                """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
                   VALUES (?, ?, 'credit', 'Escrow', ?, ?, ?, ?)""",
                (
                    wid,
                    job_id,
                    payout,
                    f"Escrow Released · {row['employer_name']}",
                    f"Job ₹{row['pay_amount']} - ₹{fee} ({PLATFORM_FEE_PERCENT}% KaamSetu fee)",
                    now_str,
                ),
            )

        cur.execute(
            "UPDATE jobs SET status = 'completed', escrow_status = 'released', completed_at = ? WHERE id = ?",
            (now_str, job_id),
        )
        cur.execute(
            """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
               VALUES (?, 'system', 'KaamSetu Escrow', ?, ?)""",
            (
                job_id,
                f"Both parties ended the job! ₹{payout} transferred from KaamSetu Escrow to {row['accepted_worker_name']}'s Wallet (Platform fee: ₹{fee}).",
                datetime.now().strftime("%I:%M %p"),
            ),
        )
        return True
    return False


@jobs_bp.route("/api/jobs", methods=["GET"])
def list_jobs():
    skill = request.args.get("skill", "").strip()
    area = request.args.get("area", "").strip()
    query = request.args.get("q", "").strip().lower()
    worker_id = int(request.args.get("worker_id", 0) or 0)
    employer_id = int(request.args.get("employer_id", 0) or 0)
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
def create_job_with_escrow():
    """
    Employer pays upfront when posting a job.
    KaamSetu holds the amount in Escrow until both parties click End Job.
    """
    data = request.get_json(force=True)
    employer_id = int(data.get("employer_id", 1) or 1)
    employer_name = (data.get("employer_name") or "Local Employer").strip()
    employer_type = (data.get("employer_type") or "Shop").strip()
    skill = (data.get("skill") or "Electrician").strip()
    area = (data.get("area") or "Laxmi Nagar").strip()
    address = (data.get("address") or f"Near Main Market, {area}").strip()
    duration_label = (data.get("duration_label") or "Full Day (8 hrs)").strip()
    days = max(1, int(data.get("days", 1) or 1))
    pay_amount = max(100, int(data.get("pay_amount", 700) or 700))
    pay_source = (data.get("pay_source") or "wallet").strip().lower()  # 'wallet' or 'upi_gateway'
    phone = (data.get("phone") or "9810011221").strip()

    platform_fee = max(10, round(pay_amount * PLATFORM_FEE_PERCENT / 100))
    worker_payout = pay_amount - platform_fee
    escrow_ref = "ESC-" + secrets.token_hex(4).upper()

    default_lat, default_lon = AREAS.get(area, (28.6304, 77.2772))
    lat = float(data.get("lat") or default_lat)
    lon = float(data.get("lon") or default_lon)

    conn = get_conn()
    cur = conn.cursor()

    emp = cur.execute("SELECT * FROM users WHERE id = ?", (employer_id,)).fetchone()
    if pay_source == "wallet":
        if not emp or emp["wallet_balance"] < pay_amount:
            bal = emp["wallet_balance"] if emp else 0
            conn.close()
            return jsonify({
                "error": f"Insufficient Wallet balance (₹{bal}) to fund ₹{pay_amount} Escrow. Top up Wallet or pay via UPI Gateway."
            }), 400
        cur.execute("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", (pay_amount, employer_id))

    now_str = datetime.now().strftime("%d %b, %I:%M %p")
    cur.execute(
        """INSERT INTO jobs
           (employer_id, employer_name, employer_type, skill, area, address, lat, lon,
            duration_label, days, pay_amount, platform_fee, worker_payout, escrow_status, escrow_ref, phone, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'held', ?, ?, 'open', ?)""",
        (employer_id, employer_name, employer_type, skill, area, address, lat, lon,
         duration_label, days, pay_amount, platform_fee, worker_payout, escrow_ref, phone, datetime.now().isoformat()),
    )
    job_id = cur.lastrowid

    cur.execute(
        """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
           VALUES (?, ?, 'escrow_lock', ?, ?, ?, ?, ?)""",
        (
            employer_id,
            job_id,
            "Wallet" if pay_source == "wallet" else "UPI",
            pay_amount,
            f"Escrow Held · {skill} Job #{job_id}",
            f"Ref: {escrow_ref} (Held safely by KaamSetu)",
            now_str,
        ),
    )

    conn.commit()
    job = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()
    return jsonify({"job": job, "escrow_ref": escrow_ref}), 201


@jobs_bp.route("/api/jobs/<int:job_id>/accept", methods=["POST"])
def accept_job(job_id: int):
    data = request.get_json(force=True)
    worker_id = int(data.get("worker_id", 0) or 0)
    worker_name = (data.get("worker_name") or "Worker").strip()
    worker_phone = (data.get("worker_phone") or "9811000099").strip()

    conn = get_conn()
    cur = conn.cursor()

    existing = cur.execute(
        "SELECT id, employer_name FROM jobs WHERE accepted_worker_id = ? AND status = 'accepted'",
        (worker_id,),
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({
            "error": f"You already have an active order with {existing['employer_name']} (#{existing['id']}). Both parties must end it first."
        }), 409

    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Job not found."}), 404
    job = dict(row)
    if job["status"] != "open":
        conn.close()
        return jsonify({"error": "This job has already been accepted."}), 409

    now = datetime.now()
    now_str = now.strftime("%d %b %Y, %I:%M %p")
    cur.execute(
        """UPDATE jobs
           SET status = 'accepted', accepted_worker_id = ?, accepted_worker_name = ?,
               accepted_worker_phone = ?, accepted_at = ?
           WHERE id = ?""",
        (worker_id, worker_name, worker_phone, now_str, job_id),
    )
    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, 'system', 'KaamSetu Escrow', ?, ?)""",
        (
            job_id,
            f"Order accepted by {worker_name}! ₹{job['pay_amount']} is safely held in KaamSetu Escrow ({job['escrow_ref']}). Phone numbers are unlocked.",
            now.strftime("%I:%M %p"),
        ),
    )
    conn.commit()
    updated_job = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    hindi_confirm = (
        f"काम स्वीकार हो गया है। {job['employer_name']} के {job['worker_payout']} रुपये कामसेतु एस्क्रो में सुरक्षित हैं।"
    )
    return jsonify({"job": updated_job, "hindi_confirm": hindi_confirm}), 200


@jobs_bp.route("/api/jobs/<int:job_id>/end", methods=["POST"])
def end_job(job_id: int):
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
        cur.execute("UPDATE jobs SET worker_ended = 1 WHERE id = ?", (job_id,))
        note = "Worker clicked End Job."
    else:
        cur.execute("UPDATE jobs SET employer_ended = 1 WHERE id = ?", (job_id,))
        note = "Employer clicked End Job."

    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, 'system', 'KaamSetu', ?, ?)""",
        (job_id, note, datetime.now().strftime("%I:%M %p")),
    )
    finalized = try_release_escrow_and_complete(cur, job_id)
    conn.commit()
    updated = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    msg = (
        f"Job Completed! ₹{updated['worker_payout']} released from Escrow to worker's Wallet (5% platform fee: ₹{updated['platform_fee']})."
        if finalized
        else f"{note} Waiting for the other party to click End Job to auto-release Escrow."
    )
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
