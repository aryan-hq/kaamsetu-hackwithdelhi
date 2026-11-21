window.KS = window.KS || {};
KS.user = null;
KS.authMode = "login"; // 'login' | 'signup'
KS.authRole = "worker"; // 'worker' | 'employer'

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
    mode === "login" ? "Log In with Password" : "Create Account & Set Profile";
  document.getElementById("signup-extra-hint").classList.toggle("hidden", mode === "login");
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
    let data;
    if (KS.authMode === "signup") {
      data = await KS.api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          auth_method: isEmail ? "email" : "phone",
          role: KS.authRole,
          phone: isEmail ? "" : identifier,
          email: isEmail ? identifier : "",
          password,
        }),
      });
    } else {
      data = await KS.api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          auth_method: isEmail ? "email" : "phone",
          role: KS.authRole,
          identifier,
          password,
        }),
      });
    }
    KS.handleAuthenticatedUser(data.user);
  } catch (err) {
    alert(err.message);
  }
};

KS.continueWithGoogle = async function () {
  const email = KS.authRole === "worker" ? "raju.worker@gmail.com" : "gupta.store@gmail.com";
  try {
    const { user } = await KS.api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ auth_method: "google", role: KS.authRole, identifier: email }),
    });
    KS.handleAuthenticatedUser(user);
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

  document.getElementById("profile-setup-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  document.getElementById("header-user-name").textContent = user.name;
  document.getElementById("header-user-badge").textContent =
    user.role === "worker" ? `Worker · ${user.skill}` : `Employer · ${user.employer_type}`;

  // Show ONLY the user's dedicated portal nav
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
    user.role === "worker" ? "Complete Your Worker Profile" : "Complete Your Employer Profile";
  document.getElementById("prof-name").value = user.name || "";
  document.getElementById("prof-phone").value = user.phone || "";
  document.getElementById("prof-skill-wrap").classList.toggle("hidden", user.role !== "worker");
  document.getElementById("prof-emptype-wrap").classList.toggle("hidden", user.role !== "employer");
  if (user.skill) document.getElementById("prof-skill").value = user.skill;
  if (user.area) document.getElementById("prof-area").value = user.area;
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
  localStorage.removeItem("kaamsetu_user");
  KS.user = null;
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("profile-setup-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
};

KS.initAuth = async function () {
  await KS.loadMeta();
  const saved = localStorage.getItem("kaamsetu_user");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const { user } = await KS.api(`/api/auth/me/${parsed.id}`);
      KS.handleAuthenticatedUser(user);
      return;
    } catch (e) {
      localStorage.removeItem("kaamsetu_user");
    }
  }
  document.getElementById("auth-screen").classList.remove("hidden");
};
