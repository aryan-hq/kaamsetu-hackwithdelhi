window.KS = window.KS || {};

KS.loadWorkerDashboard = async function () {
  if (!KS.user) return;
  const q = encodeURIComponent((document.getElementById("worker-search")?.value || "").trim());
  const { jobs, active_job, matched_skill } = await KS.api(`/api/jobs?worker_id=${KS.user.id}&q=${q}`);

  document.getElementById("worker-skill-banner").textContent =
    `Showing ${matched_skill || KS.user.skill} jobs matched to your profile (Escrow Protected)`;

  KS.updateWorkerMapPins(active_job ? [active_job] : jobs);

  const activeBox = document.getElementById("active-job-banner");
  if (active_job) {
    activeBox.classList.remove("hidden");
    activeBox.innerHTML = `
      <div class="active-order-card text-white rounded-3xl p-5 shadow-lg space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full">
            Escrow Locked · #${active_job.id}
          </span>
          <span class="text-xs font-bold text-amber-300">${active_job.duration_label}</span>
        </div>

        <div>
          <h3 class="text-lg font-extrabold">${active_job.employer_name}</h3>
          <p class="text-xs text-slate-300 mt-0.5">${active_job.address} (${active_job.area})</p>
          <p class="text-xs font-semibold text-emerald-300 mt-1">Your Payout: ₹${active_job.worker_payout} (after 5% fee) · Ph: ${active_job.display_phone}</p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <a href="${active_job.maps_url}" target="_blank" rel="noopener" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs text-center">Navigate</a>
          <button onclick="KS.openChat(${active_job.id}, '${active_job.employer_name.replace(/'/g, "")}', '${active_job.display_phone}')" class="bg-white/15 hover:bg-white/25 text-white font-bold py-2.5 rounded-xl text-xs">Chat</button>
          <a href="tel:${active_job.display_phone}" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs text-center">Call</a>
        </div>

        <div class="bg-white/10 rounded-2xl p-3 space-y-1.5 text-[11px]">
          <p class="font-bold uppercase text-slate-300 text-[10px]">Dual Confirmation (Releases ₹${active_job.worker_payout} to your Wallet)</p>
          <div class="flex justify-between"><span>1. You clicked End Job</span><span class="font-bold ${active_job.worker_ended ? "text-emerald-300" : "text-amber-300"}">${active_job.worker_ended ? "Done" : "Pending"}</span></div>
          <div class="flex justify-between"><span>2. Employer clicked End Job</span><span class="font-bold ${active_job.employer_ended ? "text-emerald-300" : "text-amber-300"}">${active_job.employer_ended ? "Done" : "Waiting"}</span></div>
        </div>

        <button onclick="KS.workerEndJob(${active_job.id})" ${active_job.worker_ended ? "disabled" : ""}
          class="w-full ${active_job.worker_ended ? "bg-emerald-500/30 text-emerald-200 cursor-not-allowed" : "bg-white text-slate-900 hover:bg-slate-100"} font-extrabold py-2.5 rounded-xl text-xs">
          ${active_job.worker_ended ? "Ended by You (Waiting for Employer)" : KS.t("end_job")}
        </button>
      </div>
    `;
  } else {
    activeBox.classList.add("hidden");
    activeBox.innerHTML = "";
  }

  const list = document.getElementById("jobs-list");
  if (!jobs.length) {
    list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">No open ${KS.user.skill} jobs match your search right now.</div>`;
    return;
  }

  list.innerHTML = jobs
    .map(
      (j) => `
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-sm text-slate-900">${j.employer_name}</h4>
              <span class="text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Escrow Paid</span>
            </div>
            <p class="text-xs text-slate-600 mt-1">${j.address}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">${j.area} · ${j.distance_km} km · Ph: ${j.display_phone}</p>
          </div>
          <span class="bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">${j.skill}</span>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span class="bg-slate-900 text-white px-2.5 py-1 rounded-lg">You Get ₹${j.worker_payout}</span>
          <span class="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-amber-800">${j.duration_label}</span>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-3.5">
          <button onclick='KS.speakJob(${JSON.stringify(j)})' class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs">Audio</button>          <a href="${j.maps_url}" target="_blank" rel="noopener" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs text-center">Route</a>
          <button onclick="KS.acceptJob(${j.id})" ${active_job ? "disabled" : ""}
            class="${active_job ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"} font-bold py-2.5 rounded-xl text-xs transition">
            ${active_job ? "Finish Current" : KS.t("accept_job")}
          </button>
        </div>
      </div>
    `
    )
    .join("");
};

KS.acceptJob = async function (jobId) {
  try {
    const res = await KS.api(`/api/jobs/${jobId}/accept`, {
      method: "POST",
      body: JSON.stringify({
        worker_id: KS.user.id,
        worker_name: KS.user.name,
        worker_phone: KS.user.phone,
      }),
    });
    KS.speak(res.hindi_confirm);
    KS.loadWorkerDashboard();
  } catch (err) {
    alert(err.message);
  }
};

KS.workerEndJob = async function (jobId) {
  try {
    const res = await KS.api(`/api/jobs/${jobId}/end`, {
      method: "POST",
      body: JSON.stringify({ role: "worker" }),
    });
    alert(res.message);
    KS.loadWorkerDashboard();
  } catch (err) {
    alert(err.message);
  }
};

KS.speakJob = function (j) {
  if (KS.lang === "en") {
    KS.speak(`${j.skill} job at ${j.employer_name} in ${j.area}. Duration: ${j.duration_label}. You will receive ${j.worker_payout} rupees.`);
  } else {
    KS.speak(j.hindi_audio_text);
  }
};