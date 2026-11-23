window.KS = window.KS || {};

KS.showVoiceToast = function (text) {
  const toast = document.getElementById("voice-toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(KS.voiceToastTimer);
  KS.voiceToastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);
};

KS.startVoiceAssistant = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Voice assistant requires Google Chrome.");

  const meta = KS.LANG_META[KS.lang] || KS.LANG_META.hi;
  const btn = document.getElementById("floating-mic-btn");
  const rec = new SR();
  rec.lang = meta.speech;
  rec.interimResults = false;

  rec.onstart = () => {
    btn.classList.add("animate-pulse", "bg-red-600");
    btn.classList.remove("bg-blue-600");
    KS.showVoiceToast(`Listening (${meta.name})...`);
  };

  rec.onend = () => {
    btn.classList.remove("animate-pulse", "bg-red-600");
    btn.classList.add("bg-blue-600");
  };

  rec.onresult = (e) => {
    const raw = e.results[0][0].transcript.trim();
    const cmd = raw.toLowerCase();
    KS.showVoiceToast(`"${raw}"`);
    KS.handleVoiceCommand(cmd, raw);
  };

  rec.start();
};

KS.handleVoiceCommand = async function (cmd, raw) {
  if (cmd.includes("madad") || cmd.includes("मदद") || cmd.includes("sos") || cmd.includes("help") || cmd.includes("hospital")) {
    KS.triggerSOS();
    return;
  }
  if (cmd.includes("wallet") || cmd.includes("वॉलेट") || cmd.includes("paise") || cmd.includes("पैसे") || cmd.includes("balance")) {
    KS.switchPortalView("wallet");
    setTimeout(() => {
      const bal = document.getElementById("wallet-balance-amount")?.textContent || "0";
      KS.speak(`Your wallet balance is ${bal}`);
    }, 600);
    return;
  }
  if (cmd.includes("kaam") || cmd.includes("काम") || cmd.includes("job") || cmd.includes("sunao") || cmd.includes("सुनाओ")) {
    if (KS.user?.role === "worker") {
      KS.switchPortalView("worker-jobs");
      const { jobs } = await KS.api(`/api/jobs?worker_id=${KS.user.id}`);
      if (jobs.length) KS.speak(jobs[0].hindi_audio_text);
      return;
    }
  }
  const searchBox = KS.user?.role === "employer" ? document.getElementById("employer-search") : document.getElementById("worker-search");
  if (searchBox) {
    searchBox.value = raw;
    if (KS.user?.role === "employer") KS.loadEmployerDashboard();
    else KS.loadWorkerDashboard();
  }
};

KS.startChatVoice = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Voice typing requires Google Chrome.");
  const meta = KS.LANG_META[KS.lang] || KS.LANG_META.hi;
  const rec = new SR();
  rec.lang = meta.speech;
  const input = document.getElementById("chat-input");
  input.placeholder = "Listening...";
  rec.onresult = (e) => {
    input.value = e.results[0][0].transcript;
    input.placeholder = "Type or speak...";
  };
  rec.onend = () => {
    input.placeholder = "Type or speak...";
  };
  rec.start();
};
