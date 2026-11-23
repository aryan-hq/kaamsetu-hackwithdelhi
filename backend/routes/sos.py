import urllib.parse
from datetime import datetime
from flask import Blueprint, jsonify, request
from database import find_nearest_hospital

sos_bp = Blueprint("sos", __name__)


@sos_bp.route("/api/sos", methods=["POST"])
def trigger_sos():
    data = request.get_json(force=True)
    worker_name = (data.get("worker_name") or "User").strip()
    family_phone = (data.get("family_phone") or "9811998877").strip()
    lat = float(data.get("lat") or 28.6304)
    lon = float(data.get("lon") or 77.2772)

    hospital = find_nearest_hospital(lat, lon)
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    maps_link = f"https://www.google.com/maps?q={lat},{lon}"
    sos_text = (
        f"EMERGENCY SOS (KaamSetu): {worker_name} needs help! "
        f"Live Location: {maps_link} | Nearest Govt Hospital: {hospital['name']} ({hospital['distance_km']} km)."
    )

    return jsonify({
        "timestamp": now_str,
        "nearest_hospital": hospital,
        "family_whatsapp_url": f"https://wa.me/91{family_phone}?text={urllib.parse.quote(sos_text)}",
        "hindi_audio": f"आपातकालीन मदद चालू है। सबसे नजदीकी सरकारी अस्पताल {hospital['name']} है।",
    }), 200
