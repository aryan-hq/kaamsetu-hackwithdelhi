import hashlib
from datetime import datetime
from flask import Blueprint, jsonify, request
from database import (
    create_session_token,
    get_conn,
    hash_password,
    is_valid_verhoeff_12,
    safe_user,
    verify_password,
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    method = (data.get("auth_method") or "phone").strip().lower()
    role = (data.get("role") or "worker").strip().lower()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if role not in ("worker", "employer"):
        return jsonify({"error": "Invalid role selected."}), 400
    if method == "phone" and len(phone) < 10:
        return jsonify({"error": "Enter a valid 10-digit phone number."}), 400
    if method in ("email", "google") and "@" not in email:
        return jsonify({"error": "Enter a valid email address."}), 400
    if method != "google" and len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    conn = get_conn()
    cur = conn.cursor()

    if method == "phone":
        if cur.execute("SELECT id FROM users WHERE phone = ? AND role = ?", (phone, role)).fetchone():
            conn.close()
            return jsonify({"error": f"A {role} account with this phone already exists. Please Log In."}), 409
    else:
        if cur.execute("SELECT id FROM users WHERE email = ? AND role = ?", (email, role)).fetchone():
            conn.close()
            return jsonify({"error": f"A {role} account with this email already exists. Please Log In."}), 409

    pw_hash = hash_password(password or "google_oauth_demo")
    starting_balance = 2500 if role == "employer" else 0

    cur.execute(
        """INSERT INTO users
           (name, role, auth_method, phone, email, password_hash, skill, employer_type, area,
            kyc_verified, face_match_score, profile_completed, wallet_balance, created_at)
           VALUES ('', ?, ?, ?, ?, ?, '', 'Shop', 'Laxmi Nagar', 0, 0, 0, ?, ?)""",
        (role, method, phone, email, pw_hash, starting_balance, datetime.now().isoformat()),
    )
    uid = cur.lastrowid
    conn.commit()
    user = safe_user(cur.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone())
    conn.close()
    token = create_session_token(user["id"], user["role"])
    return jsonify({"user": user, "token": token}), 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    method = (data.get("auth_method") or "phone").strip().lower()
    role = (data.get("role") or "worker").strip().lower()
    identifier = (data.get("identifier") or "").strip()
    password = (data.get("password") or "").strip()

    if not identifier:
        return jsonify({"error": "Enter your phone number or email."}), 400

    conn = get_conn()
    cur = conn.cursor()
    if "@" in identifier:
        row = cur.execute("SELECT * FROM users WHERE email = ? AND role = ?", (identifier.lower(), role)).fetchone()
    else:
        row = cur.execute("SELECT * FROM users WHERE phone = ? AND role = ?", (identifier, role)).fetchone()

    if not row:
        conn.close()
        return jsonify({"error": f"No {role} account found. Please Create Account first."}), 404

    if method != "google":
        if not password or not verify_password(password, row["password_hash"]):
            conn.close()
            return jsonify({"error": "Incorrect password. Please try again."}), 401

    user = safe_user(row)
    conn.close()
    token = create_session_token(user["id"], user["role"])
    return jsonify({"user": user, "token": token}), 200


@auth_bp.route("/api/auth/profile/<int:user_id>", methods=["POST"])
def save_profile_and_kyc(user_id: int):
    """Saves profile + verifies 12-digit ID (Verhoeff checksum) + Photo + Live Face Match."""
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    skill = (data.get("skill") or "").strip()
    employer_type = (data.get("employer_type") or "Shop").strip()
    area = (data.get("area") or "Laxmi Nagar").strip()
    id_number = (data.get("id_number") or "").strip()
    doc_uploaded = bool(data.get("doc_uploaded", False))
    live_face_captured = bool(data.get("live_face_captured", False))

    if not name or len(phone) < 10:
        return jsonify({"error": "Full Name and 10-digit Phone Number are required."}), 400

    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found."}), 404

    if row["role"] == "worker" and not skill:
        conn.close()
        return jsonify({"error": "Workers must select their primary skill."}), 400

    kyc_verified = row["kyc_verified"]
    kyc_hash = row["kyc_id_hash"]
    face_score = row["face_match_score"]

    # If user is not yet KYC verified, require ID/photo + live selfie
    if not kyc_verified:
        if not doc_uploaded and not id_number:
            conn.close()
            return jsonify({"error": "Please upload your Aadhaar photo or enter a valid 12-digit number."}), 400
        if id_number and not is_valid_verhoeff_12(id_number):
            conn.close()
            return jsonify({"error": "Invalid 12-digit ID checksum. Please check the number and try again."}), 400
        if not live_face_captured:
            conn.close()
            return jsonify({"error": "Please capture a live selfie to match your face with your ID."}), 400

        # Store only one-way SHA-256 hash — never raw ID digits
        kyc_hash = hashlib.sha256((id_number or f"doc_{user_id}").encode("utf-8")).hexdigest()
        kyc_verified = 1
        face_score = int(data.get("face_match_score", 0) or 0)
        if face_score < 40:
            conn.close()
            return jsonify({"error": "Face match failed. Please capture a clear live selfie matching your ID."}), 400

    cur.execute(
        """UPDATE users
           SET name = ?, phone = ?, skill = ?, employer_type = ?, area = ?,
               kyc_verified = ?, kyc_id_hash = ?, face_match_score = ?, profile_completed = 1
           WHERE id = ?""",
        (name, phone, skill if row["role"] == "worker" else "", employer_type, area,
         kyc_verified, kyc_hash, face_score, user_id),
    )
    conn.commit()
    user = safe_user(cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())
    conn.close()
    return jsonify({"user": user, "face_match_score": face_score}), 200


@auth_bp.route("/api/auth/me/<int:user_id>", methods=["GET"])
def get_me(user_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": safe_user(row)}), 200
