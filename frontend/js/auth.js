window.KS = window.KS || {};
KS.user = null;
KS.authMode = "login";
KS.authRole = "worker";
KS.cameraStream = null;
KS.liveFaceCaptured = false;
KS.docUploaded = false;
KS.docImageData = "";
KS.selfieImageData = "";

KS.setAuthMode = function (mode) {
  KS.authMode = mode;
  ["login", "signup"].forEach((m) => {
    const btn = document.getElementById(`mode-btn-${m}`);
    btn.className =
      m === mode
        ? "py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm"
        : "py-2 rounded-xl text-xs font-semibold text-slate-500";
  });
  document.getElementById("auth-submit-btn").textContent =
    mode === "login" ? "Log In with Password" : "Create Account & Verify KYC";
};

KS.selectAuthRole = function (role) {
  KS.authRole = role;
  ["worker", "employer"].forEach((r) => {
    const btn = document.getElementById(`auth-role-${r}`);
    btn.className =
      r === role
        ? "py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm transition"
        : "py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition";
  });
};

KS.submitAuthForm = async function (e) {
  e.preventDefault();
  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  const isEmail = identifier.includes("@");

  try {
    const endpoint = KS.authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      KS.authMode === "signup"
        ? { auth_method: isEmail ? "email" : "phone", role: KS.authRole, phone: isEmail ? "" : identifier, email: isEmail ? identifier : "", password }
        : { auth_method: isEmail ? "email" : "phone", role: KS.authRole, identifier, password };

    const data = await KS.api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    if (data.token) localStorage.setItem("kaamsetu_token", data.token);
    KS.handleAuthenticatedUser(data.user);
  } catch (err) {
    alert(err.message);
  }
};

KS.continueWithGoogle = async function () {
  const email = prompt("Enter your Google email to continue:", "user@gmail.com");
  if (!email) return;
  try {
    let data;
    try {
      data = await KS.api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ auth_method: "google", role: KS.authRole, identifier: email }),
      });
    } catch {
      data = await KS.api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ auth_method: "google", role: KS.authRole, email }),
      });
    }
    if (data.token) localStorage.setItem("kaamsetu_token", data.token);
    KS.handleAuthenticatedUser(data.user);
  } catch (err) {
    alert(err.message);
  }
};

KS.handleAuthenticatedUser = function (user) {
  KS.user = user;
  localStorage.setItem("kaamsetu_user", JSON.stringify(user));
  document.getElementById("auth-screen").classList.add("hidden");

  if (!user.profile_completed) {
    KS.openProfileOnboarding(user);
    return;
  }

  KS.stopCamera();
  document.getElementById("profile-setup-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  document.getElementById("header-user-name").textContent = user.name;
  document.getElementById("header-user-badge").textContent =
    (user.role === "worker" ? `${user.skill}` : `${user.employer_type}`) + (user.kyc_verified ? " · KYC Verified" : "");

  const isWorker = user.role === "worker";
  document.getElementById("worker-nav").classList.toggle("hidden", !isWorker);
  document.getElementById("employer-nav").classList.toggle("hidden", isWorker);

  if (isWorker) {
    KS.switchPortalView("worker-jobs");
  } else {
    document.getElementById("emp-name").value = user.name;
    document.getElementById("emp-phone").value = user.phone;
    document.getElementById("emp-type").value = user.employer_type || "Shop";
    KS.switchPortalView("employer-dashboard");
  }
};

KS.openProfileOnboarding = function (user) {
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("profile-setup-screen").classList.remove("hidden");
  document.getElementById("prof-role-label").textContent =
    user.role === "worker" ? "Worker Profile & Aadhaar KYC" : "Employer Profile & Aadhaar KYC";
  document.getElementById("prof-name").value = user.name || "";
  document.getElementById("prof-phone").value = user.phone || "";
  document.getElementById("prof-skill-wrap").classList.toggle("hidden", user.role !== "worker");
  document.getElementById("prof-emptype-wrap").classList.toggle("hidden", user.role !== "employer");
  document.getElementById("kyc-section").classList.toggle("hidden", Boolean(user.kyc_verified));
  if (user.skill) document.getElementById("prof-skill").value = user.skill;
  if (user.area) document.getElementById("prof-area").value = user.area;
};

KS.handleDocUpload = function (input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    KS.docImageData = e.target.result;
    KS.docUploaded = true;
    const img = document.getElementById("kyc-doc-preview");
    if (img) {
      img.src = KS.docImageData;
      img.classList.remove("hidden");
    }
    const status = document.getElementById("kyc-doc-status");
    status.textContent = `ID photo attached: ${file.name}`;
    status.className = "text-[11px] text-emerald-700 font-semibold mt-0.5";
  };
  reader.readAsDataURL(file);
};

KS.startLiveCamera = async function () {
  const video = document.getElementById("kyc-video");
  try {
    KS.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = KS.cameraStream;
    video.classList.remove("hidden");
    document.getElementById("kyc-capture-btn").classList.remove("hidden");
  } catch {
    alert("Camera blocked or unavailable. Allow camera permission in browser to capture live selfie.");
  }
};

KS.captureLiveSelfie = function () {
  const video = document.getElementById("kyc-video");
  const canvas = document.getElementById("kyc-canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.classList.remove("hidden");
  video.classList.add("hidden");
  KS.stopCamera();

  KS.selfieImageData = canvas.toDataURL("image/jpeg", 0.7);
  KS.liveFaceCaptured = true;
  const status = document.getElementById("kyc-face-status");
  status.textContent = "Live selfie captured and ready to save.";
  status.className = "text-[11px] font-bold text-emerald-700";
};

KS.stopCamera = function () {
  if (KS.cameraStream) {
    KS.cameraStream.getTracks().forEach((t) => t.stop());
    KS.cameraStream = null;
  }
};

KS.saveProfile = async function (e) {
  e.preventDefault();
  try {
    const { user } = await KS.api(`/api/auth/profile/${KS.user.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("prof-name").value.trim(),
        phone: document.getElementById("prof-phone").value.trim(),
        skill: document.getElementById("prof-skill").value,
        employer_type: document.getElementById("prof-emptype").value,
        area: document.getElementById("prof-area").value,
        id_number: (document.getElementById("kyc-id-number")?.value || "").trim(),
        doc_uploaded: KS.docUploaded,
        live_face_captured: KS.liveFaceCaptured,
        doc_photo: KS.docImageData,
        selfie_photo: KS.selfieImageData,
      }),
    });
    KS.handleAuthenticatedUser(user);
  } catch (err) {
    alert(err.message);
  }
};

KS.logout = function () {
  KS.stopCamera();
  KS.docUploaded = false;
  KS.liveFaceCaptured = false;
  KS.docImageData = "";
  KS.selfieImageData = "";
  localStorage.removeItem("kaamsetu_user");
  localStorage.removeItem("kaamsetu_token");
  KS.user = null;
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("profile-setup-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
};

KS.initAuth = async function () {
  await KS.loadMeta();
  KS.setLanguage(KS.lang);
  const saved = localStorage.getItem("kaamsetu_user");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const { user } = await KS.api(`/api/auth/me/${parsed.id}`);
      KS.handleAuthenticatedUser(user);
      return;
    } catch {
      localStorage.removeItem("kaamsetu_user");
    }
  }
  document.getElementById("auth-screen").classList.remove("hidden");
};