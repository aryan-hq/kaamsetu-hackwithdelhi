window.KS = window.KS || {};
KS.user = null;
KS.authMode = "login";
KS.authRole = "worker";

KS.setAuthMode = function (mode) {
  KS.authMode = mode;
  ["login", "signup"].forEach((m) => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (!btn) return;
    btn.className =
      m === mode
        ? "py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm"
        : "py-2 rounded-xl text-xs font-semibold text-slate-500";
  });
  const submitBtn = document.getElementById("auth-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = mode === "login" ? "Log In with Password" : "Create Account";
  }
};

KS.selectAuthRole = function (role) {
  KS.authRole = role;
  ["worker", "employer"].forEach((r) => {
    const btn = document.getElementById(`auth-role-${r}`);
    if (!btn) return;
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
        ? {
            auth_method: isEmail ? "email" : "phone",
            role: KS.authRole,
            phone: isEmail ? "" : identifier,
            email: isEmail ? identifier : "",
            password,
          }
        : {
            auth_method: isEmail ? "email" : "phone",
            role: KS.authRole,
            identifier,
            password,
          };

    const data = await KS.api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    if (data.token) localStorage.setItem("kaamsetu_token", data.token);
    KS.handleAuthenticatedUser(data.user);
  } catch (err) {
    alert(err.message || "Authentication failed. Please try again.");
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
    alert(err.message || "Google sign-in failed.");
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

  document.getElementById("profile-setup-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  document.getElementById("header-user-name").textContent = user.name || "User";
  document.getElementById("header-user-badge").textContent =
    user.role === "worker" ? `${user.skill || "Worker"} · Verified` : `${user.employer_type || "Employer"} · Verified`;

  const isWorker = user.role === "worker";
  document.getElementById("worker-nav").classList.toggle("hidden", !isWorker);
  document.getElementById("employer-nav").classList.toggle("hidden", isWorker);

  if (isWorker) {
    KS.switchPortalView("worker-jobs");
  } else {
    document.getElementById("emp-name").value = user.name || "";
    document.getElementById("emp-phone").value = user.phone || "";
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
  if (user.skill) document.getElementById("prof-skill").value = user.skill;
  if (user.area) document.getElementById("prof-area").value = user.area;
};

KS.saveProfile = async function (e) {
  e.preventDefault();
  if (!KS.user) return alert("Session expired. Please log in again.");

  const name = (document.getElementById("prof-name")?.value || "").trim();
  const phone = (document.getElementById("prof-phone")?.value || "").trim();
  if (!name || phone.length < 10) {
    return alert("Please enter your Full Name and a 10-digit Phone Number.");
  }

  try {
    const { user } = await KS.api(`/api/auth/profile/${KS.user.id}`, {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        skill: document.getElementById("prof-skill")?.value || "Electrician",
        employer_type: document.getElementById("prof-emptype")?.value || "Shop",
        area: document.getElementById("prof-area")?.value || "Laxmi Nagar",
      }),
    });
    KS.handleAuthenticatedUser(user);
  } catch (err) {
    console.error("saveProfile error:", err);
    alert(err.message || "Failed to save profile.");
  }
};

KS.loadProfileView = function () {
  if (!KS.user) return;
  const isWorker = KS.user.role === "worker";
  document.getElementById("edit-prof-role").textContent = isWorker ? "Worker" : "Employer";
  document.getElementById("edit-prof-badge").textContent = "Verified Shramvani Account";
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
        name: KS.user.name,
        phone: document.getElementById("edit-prof-phone").value.trim(),
        skill: document.getElementById("edit-prof-skill").value,
        employer_type: document.getElementById("edit-prof-emptype").value,
        area: document.getElementById("edit-prof-area").value,
      }),
    });
    KS.user = user;
    localStorage.setItem("kaamsetu_user", JSON.stringify(user));
    document.getElementById("header-user-badge").textContent =
      user.role === "worker" ? `${user.skill} · Verified` : `${user.employer_type} · Verified`;
    alert("Profile updated!");
  } catch (err) {
    alert(err.message || "Failed to update profile.");
  }
};

KS.logout = function () {
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