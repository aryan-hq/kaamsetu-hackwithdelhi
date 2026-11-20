import re
from database import AREAS

VALID_SKILLS = ["Electrician", "Plumber", "Helper", "Painter", "Carpenter", "Mason"]

SKILL_KEYWORDS = {
    "Electrician": ["electrician", "bijli", "बिजली", "इलेक्ट्रीशियन", "wire", "wiring", "light", "fan"],
    "Plumber": ["plumber", "प्लंबर", "nal", "नल", "pipe", "पाइप", "pani", "पानी", "motor"],
    "Helper": ["helper", "हेल्पर", "dukaan", "दुकान", "kirana", "किराना", "mazdoor", "मजदूर", "labour", "madad", "loading", "beldar", "बेलदार"],
    "Painter": ["painter", "पेंटर", "paint", "पेंट", "rang", "रंग", "putty"],
    "Carpenter": ["carpenter", "कारपेंटर", "badhai", "बढ़ई", "lakdi", "लकड़ी", "furniture", "wood"],
    "Mason": ["mason", "mistri", "मिस्त्री", "राजमिस्त्री", "rajmistri", "cement", "wall"],
}

AREA_ALIASES = {
    "Laxmi Nagar": ["laxmi nagar", "lakshmi nagar", "लक्ष्मी नगर", "लक्ष्मीनगर"],
    "Shakarpur": ["shakarpur", "शकरपुर"],
    "Preet Vihar": ["preet vihar", "प्रीत विहार"],
    "Nirman Vihar": ["nirman vihar", "निर्माण विहार"],
    "Mayur Vihar": ["mayur vihar", "मयूर विहार"],
    "Patparganj": ["patparganj", "पटपड़गंज"],
    "Vasundhara Enclave": ["vasundhara", "वसुंधरा", "vasundhara enclave"],
    "Sector 15 Noida": ["sector 15", "सेक्टर 15", "सेक्टर १५", "sec 15"],
    "Sector 18 Noida": ["sector 18", "सेक्टर 18", "सेक्टर १८", "sec 18"],
    "Pandav Nagar": ["pandav nagar", "पांडव नगर"],
    "Mandawali": ["mandawali", "मंडावली"],
    "Karkardooma": ["karkardooma", "कड़कड़डूमा"],
    "Anand Vihar": ["anand vihar", "आनंद विहार"],
    "IP Extension": ["ip extension", "आईपी एक्सटेंशन"],
    "New Ashok Nagar": ["ashok nagar", "अशोक नगर", "new ashok nagar"],
}

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def _normalize_digits(text: str) -> str:
    return text.translate(DEVANAGARI_DIGITS)


def _match_skill(text_lower: str) -> str:
    for skill, keywords in SKILL_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return skill
    return "Helper"


def _match_area(text_lower: str) -> str:
    for area, aliases in AREA_ALIASES.items():
        if any(a in text_lower for a in aliases):
            return area
    return "Laxmi Nagar"


def _extract_name(text: str) -> str:
    patterns = [
        r"(?:mera naam|my name is|naam)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)",
        r"(?:मेरा नाम|नाम)\s+([\u0900-\u097F]+(?:\s+[\u0900-\u097F]+)?)",
    ]
    stop_words = {"hai", "hoon", "hu", "main", "mein", "है", "हूँ", "हूं", "मैं"}
    for pat in patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            words = [w for w in m.group(1).strip().split() if w.lower() not in stop_words]
            if words:
                return " ".join(words[:2]).title()
    return "Raju"


def _extract_rate(text: str, default: int = 650) -> int:
    norm = _normalize_digits(text)
    nums = [int(n) for n in re.findall(r"\b(\d{3,4})\b", norm)]
    for n in nums:
        if 200 <= n <= 5000:
            return n
    return default


def _extract_days(text: str, default: int = 2) -> int:
    norm = _normalize_digits(text)
    m = re.search(r"\b(\d{1,2})\s*(?:din|day|days|दिन)\b", norm, flags=re.IGNORECASE)
    if m:
        return max(1, min(30, int(m.group(1))))
    return default


def parse_worker_speech(transcript: str) -> dict:
    """Extracts structured Digital Kaam Card fields from Hindi/Hinglish speech (100% local, zero API key)."""
    lower = transcript.lower()
    return {
        "name": _extract_name(transcript),
        "skill": _match_skill(lower),
        "area": _match_area(lower),
        "daily_rate": _extract_rate(transcript),
    }


def parse_job_speech(transcript: str) -> dict:
    """Extracts structured job posting from Employer Hindi/Hinglish speech."""
    lower = transcript.lower()
    return {
        "skill": _match_skill(lower),
        "area": _match_area(lower),
        "days": _extract_days(transcript),
        "daily_rate": _extract_rate(transcript, default=700),
    }


def parse_khata_speech(transcript: str, agreed_daily_rate: int = 800) -> dict:
    """
    Parses Hindi/Hinglish wage ledger voice notes like:
    'Aaj 500 mile, 300 baaki hain' or 'आज 600 रुपये मिले, 200 बाकी हैं'
    """
    norm = _normalize_digits(transcript)
    lower = norm.lower()

    received = 0
    pending = None

    # Look for received amount near mile / mil / diye / paid / मिले / दिए
    m_rec = re.search(r"(\d{2,5})\s*(?:rupaye|rupees|rs|₹|रुपये)?\s*(?:mile|mil|diye|aaye|paid|मिले|दिए|आए)", lower)
    if not m_rec:
        m_rec = re.search(r"(?:mile|mil|diye|paid|मिले|दिए)\s*(?:₹|rs\.?)?\s*(\d{2,5})", lower)
    if m_rec:
        received = int(m_rec.group(1))

    # Look for pending amount near baaki / baki / udhaar / bacha / बाकी / उधार / बचा
    m_pen = re.search(r"(\d{2,5})\s*(?:rupaye|rupees|rs|₹|रुपये)?\s*(?:baaki|baki|udhaar|udhar|bacha|bache|बाकी|उधार|बचा|बचे)", lower)
    if not m_pen:
        m_pen = re.search(r"(?:baaki|baki|udhaar|udhar|बाकी|उधार)\s*(?:₹|rs\.?)?\s*(\d{2,5})", lower)
    if m_pen:
        pending = int(m_pen.group(1))

    # Fallback: if two numbers exist in order (e.g. "500 ... 300")
    all_nums = [int(n) for n in re.findall(r"\b(\d{2,5})\b", norm)]
    if received == 0 and len(all_nums) >= 1:
        received = all_nums[0]
    if pending is None:
        if len(all_nums) >= 2 and all_nums[1] != received:
            pending = all_nums[1]
        else:
            pending = max(0, agreed_daily_rate - received)

    return {"received": received, "pending": pending}
