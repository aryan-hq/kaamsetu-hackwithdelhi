window.KS = window.KS || {};
KS.user = null;
KS.authMode = "login";
KS.authRole = "worker";
KS.cameraStream = null;
KS.liveFaceCaptured = false;
KS.docUploaded = false;
KS.faceModelsLoaded = false;
KS.docDescriptor = null;
KS.faceMatchScore = 0;

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
    mode === "login" ? "Log In with Password" : "Create Account";
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
    user.role === "worker" ? "Complete Worker Profile" : "Complete Employer Profile";
  document.getElementById("prof-name").value = user.name || "";
  document.getElementById("prof-phone").value = user.phone || "";
  document.getElementById("prof-skill-wrap").classList.toggle("hidden", user.role !== "worker");
  document.getElementById("prof-emptype-wrap").classList.toggle("hidden", user.role !== "employer");
  document.getElementById("kyc-section").classList.toggle("hidden", Boolean(user.kyc_verified));
  if (user.skill) document.getElementById("prof-skill").value = user.skill;
  if (user.area) document.getElementById("prof-area").value = user.area;
};

// In-App Profile Tab (Name is locked, header stays visible)
KS.loadProfileView = function () {
  if (!KS.user) return;
  const isWorker = KS.user.role === "worker";
  document.getElementById("edit-prof-role").textContent = isWorker ? "Worker" : "Employer";
  document.getElementById("edit-prof-badge").textContent = KS.user.kyc_verified
    ? `KYC Verified · Face Match ${KS.user.face_match_score || 95}%`
    : "KYC Pending";
  document.getElementById("edit-prof-name").value = KS.user.name || "";
  document.getElementById("edit-prof-phone").value = KS.user.phone || "";
  document.getElementById("edit-prof-skill-wrap").classList.toggle("hidden", !isWorker);
  document.getElementById("edit-prof-emptype-wrap").classList.toggle("hidden", isWorker);
  if (KS.user.skill) document.getElementById("edit-prof-skill").value = KS.user.skill;
  if (KS.user.employer_type) document.getElementById("edit-prof-emptype").value = KS.user.employer_type;
  if (KS.user.area) document.getElementById("edit-prof-area").value = KS.user.area;
};

KS.updateProfileDetails = async function (e) {
  e.preventDefault();
  try {
    const { user } = await KS.api(`/api/auth/profile/${KS.user.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: KS.user.name, // Locked
        phone: document.getElementById("edit-prof-phone").value.trim(),
        skill: document.getElementById("edit-prof-skill").value,
        employer_type: document.getElementById("edit-prof-emptype").value,
        area: document.getElementById("edit-prof-area").value,
      }),
    });
    KS.user = user;
    localStorage.setItem("kaamsetu_user", JSON.stringify(user));
    document.getElementById("header-user-badge").textContent =
      (user.role === "worker" ? `${user.skill}` : `${user.employer_type}`) + (user.kyc_verified ? " · KYC Verified" : "");
    alert("Profile updated!");
  } catch (err) {
    alert(err.message);
  }
};

KS.loadFaceModels = async function () {
  if (KS.faceModelsLoaded) return;
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  KS.faceModelsLoaded = true;
};

KS.handleDocUpload = async function (input) {
  if (!input.files || !input.files[0]) return;
  const status = document.getElementById("kyc-doc-status");
  const img = document.getElementById("kyc-doc-preview");
  status.textContent = "Scanning upright ID photo for face...";
  status.className = "text-[11px] text-blue-600 font-semibold mt-0.5";

  img.src = URL.createObjectURL(input.files[0]);
  img.classList.remove("hidden");

  img.onload = async () => {
    try {
      await KS.loadFaceModels();
      const det = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (!det) {
        KS.docUploaded = false;
        KS.docDescriptor = null;
        status.textContent = "No clear upright face found. Upload a straight, well-lit ID photo.";
        status.className = "text-[11px] text-red-600 font-semibold mt-0.5";
        return;
      }
      KS.docUploaded = true;
      KS.docDescriptor = det.descriptor;
      status.textContent = "Face detected on ID photo! Now capture your live selfie.";
      status.className = "text-[11px] text-emerald-700 font-semibold mt-0.5";
    } catch {
      status.textContent = "Face model failed to load. Check internet.";
      status.className = "text-[11px] text-red-600 font-semibold mt-0.5";
    }
  };
};

KS.startLiveCamera = async function () {
  const video = document.getElementById("kyc-video");
  try {
    KS.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = KS.cameraStream;
    video.classList.remove("hidden");
    document.getElementById("kyc-capture-btn").classList.remove("hidden");
  } catch {
    alert("Allow camera permission in browser to capture live selfie.");
  }
};

KS.captureLiveSelfie = async function () {
  const status = document.getElementById("kyc-face-status");
  if (!KS.docDescriptor) {
    return alert("Upload a clear upright ID photo first.");
  }

  const video = document.getElementById("kyc-video");
  const canvas = document.getElementById("kyc-canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.classList.remove("hidden");
  video.classList.add("hidden");
  KS.stopCamera();

  status.textContent = "Matching live face with ID photo...";
  status.className = "text-[11px] font-bold text-blue-600";

  try {
    await KS.loadFaceModels();
    const liveDet = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
    if (!liveDet) {
      KS.liveFaceCaptured = false;
      KS.faceMatchScore = 0;
      status.textContent = "No face detected in selfie. Look straight at the camera and retry.";
      status.className = "text-[11px] font-bold text-red-600";
      return;
    }

    const distance = faceapi.euclideanDistance(KS.docDescriptor, liveDet.descriptor);
    const similarity = Math.max(0, Math.min(99, Math.round((1 - distance) * 100)));

    // Strict threshold: 0.50 rejects different people reliably
    if (distance < 0.50) {
      KS.liveFaceCaptured = true;
      KS.faceMatchScore = similarity;
      status.textContent = `Face Matched! (${similarity}% similarity)`;
      status.className = "text-[11px] font-bold text-emerald-700";
    } else {
      KS.liveFaceCaptured = false;
      KS.faceMatchScore = 0;
      status.textContent = `Face Mismatch (${similarity}%). Different person detected — verification blocked.`;
      status.className = "text-[11px] font-bold text-red-600";
    }
  } catch {
    KS.liveFaceCaptured = false;
    status.textContent = "Face comparison failed. Please retry.";
    status.className = "text-[11px] font-bold text-red-600";
  }
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
  KS.docDescriptor = null;
  KS.faceMatchScore = 0;
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