from datetime import datetime
from flask import Blueprint, jsonify, request
from database import get_conn

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

    if user["role"] == "employer":
        escrow_held = conn.execute(
            "SELECT COALESCE(SUM(pay_amount), 0) FROM jobs WHERE employer_id = ? AND escrow_status = 'held'",
            (user_id,),
        ).fetchone()[0]
    else:
        escrow_held = conn.execute(
            "SELECT COALESCE(SUM(worker_payout), 0) FROM jobs WHERE accepted_worker_id = ? AND escrow_status = 'held'",
            (user_id,),
        ).fetchone()[0]
    conn.close()

    total_earned_or_paid = sum(t["amount"] for t in txs if t["tx_type"] in ("credit", "escrow_lock"))

    return jsonify({
        "wallet_balance": user["wallet_balance"],
        "role": user["role"],
        "escrow_held": escrow_held,
        "total_volume": total_earned_or_paid,
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
    if not cur.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone():
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
        return jsonify({"error": "Minimum withdrawal is ₹50."}), 400

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
