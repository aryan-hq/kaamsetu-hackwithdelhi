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

KS.speakJob = function (j) {
  const templates = {
    en: `${j.skill} job at ${j.employer_name} in ${j.area}. Duration: ${j.duration_label}. You will receive ${j.worker_payout} rupees.`,
    hi: `${j.area} में ${j.employer_name} पर ${j.skill} का काम है। समय: ${j.duration_label}। आपको ${j.worker_payout} रुपये मिलेंगे।`,
    mr: `${j.area} मध्ये ${j.employer_name} येथे ${j.skill} चे काम आहे. वेळ: ${j.duration_label}. तुम्हाला ${j.worker_payout} रुपये मिळतील.`,
    bn: `${j.area} তে ${j.employer_name} এ ${j.skill} এর কাজ আছে। সময়: ${j.duration_label}। আপনি ${j.worker_payout} টাকা পাবেন।`,
    ta: `${j.area} பகுதியில் ${j.employer_name} இடத்தில் ${j.skill} வேலை உள்ளது. நேரம்: ${j.duration_label}. உங்களுக்கு ${j.worker_payout} ரூபாய் கிடைக்கும்.`,
    pa: `${j.area} ਵਿੱਚ ${j.employer_name} ਵਿਖੇ ${j.skill} ਦਾ ਕੰਮ ਹੈ। ਸਮਾਂ: ${j.duration_label}। ਤੁਹਾਨੂੰ ${j.worker_payout} ਰੁਪਏ ਮਿਲਣਗੇ।`,
  };
  KS.speak(templates[KS.lang] || templates.en);
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
    const j = res.job;
    const confirmTemplates = {
      en: `Job accepted! ${j.worker_payout} rupees from ${j.employer_name} is safely locked in Shramvani Escrow.`,
      hi: `काम स्वीकार हो गया है। ${j.employer_name} के ${j.worker_payout} रुपये श्रमवाणी एस्क्रो में सुरक्षित हैं।`,
      mr: `काम स्वीकारले आहे. ${j.employer_name} चे ${j.worker_payout} रुपये श्रमवाणी एस्क्रो मध्ये सुरक्षित आहेत.`,
      bn: `কাজ গৃহীত হয়েছে। ${j.employer_name} এর ${j.worker_payout} টাকা শ্রমবাণী এসক্রোতে সুরক্ষিত আছে।`,
      ta: `வேலை ஏற்கப்பட்டது. ${j.employer_name} இன் ${j.worker_payout} ரூபாய் ஸ்ரம்வானி எஸ்க்ரோவில் பாதுகாப்பாக உள்ளது.`,
      pa: `ਕੰਮ ਸਵੀਕਾਰ ਹੋ ਗਿਆ ਹੈ। ${j.employer_name} ਦੇ ${j.worker_payout} ਰੁਪਏ ਸ਼੍ਰਮਵਾਣੀ ਐਸਕ੍ਰੋ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਹਨ।`,
    };
    KS.speak(confirmTemplates[KS.lang] || confirmTemplates.en);
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