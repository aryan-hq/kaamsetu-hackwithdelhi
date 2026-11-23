import io
import os
from flask import Flask, jsonify, request, send_file, send_from_directory

from database import AREAS, PLATFORM_FEE_PERCENT, SKILLS, init_db
from routes.auth import auth_bp
from routes.jobs import jobs_bp
from routes.sos import sos_bp
from routes.wallet import wallet_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
init_db()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


app.register_blueprint(auth_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(wallet_bp)
app.register_blueprint(sos_bp)


@app.route("/")
def serve_frontend():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/meta", methods=["GET"])
def get_meta():
    return jsonify({
        "areas": AREAS,
        "skills": SKILLS,
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
    }), 200


@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    try:
        from gtts import gTTS
    except ImportError:
        return jsonify({"error": "gTTS not installed"}), 503

    payload = request.get_json(force=True) or {}
    text = (payload.get("text") or "").strip()
    lang = (payload.get("lang") or "hi").strip().lower()
    if lang not in ("en", "hi", "mr", "bn", "ta", "pa"):
        lang = "hi"
    if not text:
        return jsonify({"error": "Empty text"}), 400
    try:
        buf = io.BytesIO()
        gTTS(text=text, lang=lang, slow=False).write_to_fp(buf)
        buf.seek(0)
        return send_file(buf, mimetype="audio/mpeg")
    except Exception:
        return jsonify({"error": "TTS offline"}), 503


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
