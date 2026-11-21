import secrets
from datetime import datetime
from flask import Blueprint, jsonify, request
from database import get_conn
from routes.jobs import enrich_job, try_finalize_job

wallet_bp = Blueprint("wallet", __name__)


@wallet_bp.route("/api/wallet/<int:user_id>", methods=["GET"])
def get_wallet_summary(user_id: int):
    conn = get_conn()
    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user_row:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    user = dict(user_row)

    txs = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 30", (user_id,)
        ).fetchall()
    ]
    conn.close()

    cash_total = sum(t["amount"] for t in txs if t["payment_method"] == "Cash" and t["tx_type"] in ("cash_earned", "cash_paid"))
    online_total = sum(t["amount"] for t in txs if t["payment_method"] == "UPI" and t["tx_type"] in ("credit", "debit"))

    return jsonify({
        "wallet_balance": user["wallet_balance"],
        "role": user["role"],
        "cash_total": cash_total,
        "online_total": online_total,
        "transactions": txs,
    }), 200


@wallet_bp.route("/api/wallet/add-money", methods=["POST"])
def add_money():
    data = request.get_json(force=True)
    user_id = int(data.get("user_id", 0) or 0)
    amount = int(data.get("amount", 0) or 0)
    if amount < 100 or amount > 50000:
        return jsonify({"error": "Enter an amount between ₹100 and ₹50,000."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    now_str = datetime.now().strftime("%d %b, %I:%M %p")
    cur.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", (amount, user_id))
    cur.execute(
        """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
           VALUES (?, 0, 'topup', 'UPI', ?, 'Added to KaamSetu Wallet', 'Instant UPI Top-up', ?)""",
        (user_id, amount, now_str),
    )
    conn.commit()
    new_bal = cur.execute("SELECT wallet_balance FROM users WHERE id = ?", (user_id,)).fetchone()["wallet_balance"]
    conn.close()
    return jsonify({"wallet_balance": new_bal, "message": f"₹{amount} added to wallet."}), 200


@wallet_bp.route("/api/wallet/withdraw", methods=["POST"])
def withdraw_money():
    data = request.get_json(force=True)
    user_id = int(data.get("user_id", 0) or 0)
    amount = int(data.get("amount", 0) or 0)
    upi_id = (data.get("upi_id") or "worker@upi").strip()

    if amount < 50:
        return jsonify({"error": "Minimum withdrawal amount is ₹50."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    if row["wallet_balance"] < amount:
        conn.close()
        return jsonify({"error": f"Insufficient wallet balance (Available: ₹{row['wallet_balance']})."}), 400

    now_str = datetime.now().strftime("%d %b, %I:%M %p")
    cur.execute("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", (amount, user_id))
    cur.execute(
        """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
           VALUES (?, 0, 'withdraw', 'UPI', ?, 'Withdrawn to Bank / UPI', ?, ?)""",
        (user_id, amount, f"Sent to {upi_id}", now_str),
    )
    conn.commit()
    new_bal = cur.execute("SELECT wallet_balance FROM users WHERE id = ?", (user_id,)).fetchone()["wallet_balance"]
    conn.close()
    return jsonify({"wallet_balance": new_bal, "message": f"₹{amount} transferred to {upi_id}."}), 200


@wallet_bp.route("/api/jobs/<int:job_id>/confirm-cash", methods=["POST"])
def confirm_cash_collected(job_id: int):
    """Worker confirms they physically collected Cash from the employer."""
    data = request.get_json(force=True)
    worker_id = int(data.get("worker_id", 0) or 0)

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row or row["status"] != "accepted":
        conn.close()
        return jsonify({"error": "Active order not found."}), 404
    job = dict(row)

    if worker_id and job["accepted_worker_id"] != worker_id:
        conn.close()
        return jsonify({"error": "Only the assigned worker can confirm cash collection."}), 403
    if job["payment_verified"] == 1:
        conn.close()
        return jsonify({"error": "Payment is already verified for this order."}), 400

    amount = job["pay_amount"]
    now_str = datetime.now().strftime("%d %b, %I:%M %p")

    cur.execute(
        "UPDATE jobs SET payment_verified = 1, payment_method_used = 'Cash' WHERE id = ?",
        (job_id,),
    )
    cur.execute(
        """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
           VALUES (?, ?, 'cash_earned', 'Cash', ?, ?, 'Confirmed collected in Cash', ?)""",
        (job["accepted_worker_id"], job_id, amount, f"Cash from {job['employer_name']}", now_str),
    )
    if job["employer_id"]:
        cur.execute(
            """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
               VALUES (?, ?, 'cash_paid', 'Cash', ?, ?, 'Worker confirmed Cash receipt', ?)""",
            (job["employer_id"], job_id, amount, f"Paid Cash to {job['accepted_worker_name']}", now_str),
        )

    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, 'system', 'KaamSetu', ?, ?)""",
        (job_id, f"Worker confirmed Cash payment of ₹{amount} collected.", datetime.now().strftime("%I:%M %p")),
    )
    finalized = try_finalize_job(cur, job_id)
    conn.commit()
    updated = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    msg = f"Cash ₹{amount} verified! Order completed." if finalized else f"Cash ₹{amount} confirmed! Both parties must click End Job to close the order."
    return jsonify({"job": updated, "completed": finalized, "message": msg}), 200


@wallet_bp.route("/api/jobs/<int:job_id>/pay-upi", methods=["POST"])
def verify_upi_payment(job_id: int):
    """Employer pays via UPI/Wallet; app verifies UPI transaction & credits Worker's Wallet."""
    data = request.get_json(force=True)
    employer_id = int(data.get("employer_id", 0) or 0)
    upi_id = (data.get("upi_id") or "employer@upi").strip()

    if "@" not in upi_id:
        return jsonify({"error": "Enter a valid UPI ID (e.g. name@upi)."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row or row["status"] != "accepted":
        conn.close()
        return jsonify({"error": "Active order not found."}), 404
    job = dict(row)

    if job["payment_verified"] == 1:
        conn.close()
        return jsonify({"error": "Payment is already verified for this order."}), 400

    emp_id = job["employer_id"] or employer_id
    amount = job["pay_amount"]
    emp = cur.execute("SELECT * FROM users WHERE id = ?", (emp_id,)).fetchone()
    if not emp or emp["wallet_balance"] < amount:
        bal = emp["wallet_balance"] if emp else 0
        conn.close()
        return jsonify({
            "error": f"Insufficient Wallet/UPI balance (₹{bal}). Add money in Wallet tab first."
        }), 400

    utr = "UPI" + secrets.token_hex(4).upper()
    now_str = datetime.now().strftime("%d %b, %I:%M %p")

    # Deduct employer, credit worker
    cur.execute("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", (amount, emp_id))
    if job["accepted_worker_id"]:
        cur.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", (amount, job["accepted_worker_id"]))

    cur.execute(
        "UPDATE jobs SET payment_verified = 1, payment_method_used = 'UPI', upi_ref_id = ? WHERE id = ?",
        (utr, job_id),
    )

    cur.execute(
        """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
           VALUES (?, ?, 'debit', 'UPI', ?, ?, ?, ?)""",
        (emp_id, job_id, amount, f"Paid {job['accepted_worker_name']}", f"Verified UPI ({utr}) · {upi_id}", now_str),
    )
    if job["accepted_worker_id"]:
        cur.execute(
            """INSERT INTO transactions (user_id, job_id, tx_type, payment_method, amount, title, note, created_at)
               VALUES (?, ?, 'credit', 'UPI', ?, ?, ?, ?)""",
            (job["accepted_worker_id"], job_id, amount, f"Received from {job['employer_name']}", f"Verified UPI ({utr}) · Credited to Wallet", now_str),
        )

    cur.execute(
        """INSERT INTO job_messages (job_id, sender_role, sender_name, message, created_at)
           VALUES (?, 'system', 'KaamSetu', ?, ?)""",
        (job_id, f"UPI Payment of ₹{amount} verified by KaamSetu (Ref: {utr}).", datetime.now().strftime("%I:%M %p")),
    )
    finalized = try_finalize_job(cur, job_id)
    conn.commit()
    updated = enrich_job(dict(cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()), reveal_phone=True)
    conn.close()

    msg = f"UPI Verified ({utr})! Order completed." if finalized else f"UPI Verified ({utr})! Both parties must click End Job to close the order."
    return jsonify({"job": updated, "upi_ref_id": utr, "completed": finalized, "message": msg}), 200
