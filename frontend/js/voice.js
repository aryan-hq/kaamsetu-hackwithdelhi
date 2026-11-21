window.KS = window.KS || {};
KS.isListening = false;

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
  if (!SR) {
    alert("Voice assistant requires Google Chrome.");
    return;
  }

  const btn = document.getElementById("floating-mic-btn");
  const rec = new SR();
  rec.lang = "hi-IN";
  rec.interimResults = false;

  rec.onstart = () => {
    KS.isListening = true;
    btn.classList.add("animate-pulse", "bg-red-600");
    btn.classList.remove("bg-blue-600");
    KS.showVoiceToast("सुन रहे हैं... बोलिए (जैसे: 'पैसे दिखाओ', 'काम सुनाओ', 'मदद')");
  };

  rec.onend = () => {
    KS.isListening = false;
    btn.classList.remove("animate-pulse", "bg-red-600");
    btn.classList.add("bg-blue-600");
  };

  rec.onerror = () => {
    KS.showVoiceToast("आवाज़ साफ़ नहीं आई, कृपया फिर से बोलें।");
  };

  rec.onresult = (e) => {
    const raw = e.results[0][0].transcript.trim();
    const cmd = raw.toLowerCase();
    KS.showVoiceToast(`आपने कहा: "${raw}"`);
    KS.handleVoiceCommand(cmd, raw);
  };

  rec.start();
};

KS.handleVoiceCommand = async function (cmd, raw) {
  // 1. Emergency SOS
  if (cmd.includes("madad") || cmd.includes("मदद") || cmd.includes("sos") || cmd.includes("बचाओ") || cmd.includes("hospital")) {
    KS.triggerSOS();
    return;
  }

  // 2. Wallet / Balance
  if (cmd.includes("wallet") || cmd.includes("वॉलेट") || cmd.includes("paise") || cmd.includes("पैसे") || cmd.includes("balance") || cmd.includes("बैलेंस")) {
    KS.switchPortalView("wallet");
    setTimeout(() => {
      const bal = document.getElementById("wallet-balance-amount")?.textContent || "0";
      KS.speakHindi(`आपका वॉलेट बैलेंस ${bal} है।`);
    }, 600);
    return;
  }

  // 3. Profile
  if (cmd.includes("profile") || cmd.includes("प्रोफाइल")) {
    if (KS.user) {
      KS.openProfileOnboarding(KS.user);
      KS.speakHindi("आपकी प्रोफाइल खुल गई है।");
    }
    return;
  }

  // 4. Worker: Read available jobs aloud
  if (cmd.includes("sunao") || cmd.includes("सुनाओ") || cmd.includes("kaam") || cmd.includes("काम") || cmd.includes("job")) {
    if (KS.user?.role === "worker") {
      KS.switchPortalView("worker-jobs");
      const { jobs } = await KS.api(`/api/jobs?worker_id=${KS.user.id}`);
      if (!jobs.length) {
        KS.speakHindi("अभी आपके काम के लिए कोई नया ऑर्डर नहीं है।");
      } else {
        const j = jobs[0];
        KS.speakHindi(`सबसे नजदीकी काम: ${j.hindi_audio_text} इसे लेने के लिए नीला बटन दबाएं।`);
      }
      return;
    } else if (KS.user?.role === "employer") {
      KS.switchPortalView("employer-dashboard");
      KS.speakHindi("आपका डैशबोर्ड खुल गया है।");
      return;
    }
  }

  // 5. Otherwise, use speech to search jobs by area/name
  const searchBox =
    KS.user?.role === "employer"
      ? document.getElementById("employer-search")
      : document.getElementById("worker-search");

  if (searchBox) {
    searchBox.value = raw;
    if (KS.user?.role === "employer") {
      KS.switchPortalView("employer-dashboard");
      KS.loadEmployerDashboard();
    } else {
      KS.switchPortalView("worker-jobs");
      KS.loadWorkerDashboard();
    }
    KS.speakHindi(`${raw} के लिए काम खोजा जा रहा है।`);
  }
};

// Voice-to-Text inside Private Chat (so workers don't have to type)
KS.startChatVoice = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Voice typing requires Google Chrome.");
  const rec = new SR();
  rec.lang = "hi-IN";
  const input = document.getElementById("chat-input");
  input.placeholder = "बोलिए... (Listening)";
  rec.onresult = (e) => {
    input.value = e.results[0][0].transcript;
    input.placeholder = "Type a private message...";
  };
  rec.onend = () => {
    input.placeholder = "Type a private message...";
  };
  rec.start();
};