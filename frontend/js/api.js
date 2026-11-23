window.KS = window.KS || {};
KS.AREA_COORDS = {};
KS.SKILLS = [];
KS.PLATFORM_FEE_PERCENT = 5;

KS.api = async function (url, options = {}) {
  const token = localStorage.getItem("kaamsetu_token") || "";
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

KS.loadMeta = async function () {
  const { areas, skills, platform_fee_percent } = await KS.api("/api/meta");
  KS.AREA_COORDS = areas;
  KS.SKILLS = skills;
  KS.PLATFORM_FEE_PERCENT = platform_fee_percent || 5;

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
  ["emp-skill", "prof-skill", "edit-prof-skill"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skillOptions;
  });
  ["emp-area", "prof-area", "edit-prof-area"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = areaOptions;
  });
};

KS.speak = async function (text) {
  const meta = KS.LANG_META[KS.lang] || KS.LANG_META.hi;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: meta.tts }),
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
    u.lang = meta.speech;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
};
