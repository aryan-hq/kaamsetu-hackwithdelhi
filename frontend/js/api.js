window.KS = window.KS || {};
KS.AREA_COORDS = {};
KS.SKILLS = [];

KS.api = async function (url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
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
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
      return;
    }
  } catch (e) {}
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hi-IN";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
};
