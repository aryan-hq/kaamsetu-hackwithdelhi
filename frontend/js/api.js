window.KS = window.KS || {};
KS.AREA_COORDS = {};
KS.SKILLS = [];
KS.currentAudio = null;

KS.escapeHtml = function (str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

KS.api = async function (url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Server error (${res.status}). Please try again.`);
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

KS.loadMeta = async function () {
  const { areas, skills } = await KS.api("/api/meta");
  KS.AREA_COORDS = areas;
  KS.SKILLS = skills;

  const skillOptions = skills.map((s) => `<option value="${s}">${s}</option>`).join("");
  const areaOptions = Object.keys(areas).map((a) => `<option value="${a}">${a}</option>`).join("");

  ["emp-skill", "prof-skill"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skillOptions;
  });
  ["emp-area", "prof-area"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = areaOptions;
  });
};

KS.speakHindi = async function (text) {
  // Stop any currently playing voice readout so voices never overlap
  if (KS.currentAudio) {
    KS.currentAudio.pause();
    KS.currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const audio = new Audio(objUrl);
      KS.currentAudio = audio;
      audio.onended = () => URL.revokeObjectURL(objUrl);
      await audio.play();
      return;
    }
  } catch (e) {}

  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hi-IN";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
};