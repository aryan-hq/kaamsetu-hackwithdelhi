window.KS = window.KS || {};

KS.updateEscrowBreakdown = function () {
  const amt = parseInt(document.getElementById("emp-rate").value, 10) || 0;
  const fee = Math.max(10, Math.round((amt * KS.PLATFORM_FEE_PERCENT) / 100));
  const net = Math.max(0, amt - fee);
  const el = document.getElementById("escrow-fee-preview");
  if (el) el.textContent = `Escrow Total: ₹${amt} -> Worker receives ₹${net} (KaamSetu ${KS.PLATFORM_FEE_PERCENT}% mediator fee: ₹${fee})`;
};

KS.postJob = async function (e) {
  e.preventDefault();
  const durationSelect = document.getElementById("emp-duration");
  const durationLabel = durationSelect.options[durationSelect.selectedIndex].text;
  const days = parseInt(durationSelect.value, 10) || 1;
  const payAmount = parseInt(document.getElementById("emp-rate").value, 10) || 700;
  const paySource = document.getElementById("emp-pay-source").value;

  try {
    const res = await KS.api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        employer_id: KS.user.id,
        employer_name: document.getElementById("emp-name").value,
        employer_type: document.getElementById("emp-type").value,
        phone: document.getElementById("emp-phone").value,
        skill: document.getElementById("emp-skill").value,
        area: document.getElementById("emp-area").value,
        address: document.getElementById("emp-address").value,
        lat: document.getElementById("emp-lat").value,
        lon: document.getElementById("emp-lon").value,
        duration_label: durationLabel,
        days: days,
        pay_amount: payAmount,
        pay_source: paySource,
      }),
    });
    alert(`₹${payAmount} locked in KaamSetu Escrow (${res.escrow_ref})! Your job is now live.`);
    KS.switchPortalView("employer-dashboard");
  } catch (err) {
    alert(err.message);
  }
};

KS.loadEmployerDashboard = async function () {
  if (!KS.user) return;
  const q = encodeURIComponent((document.getElementById("employer-search")?.value || "").trim());
  const { jobs } = await KS.api(`/api/jobs?employer_id=${KS.user.id}&q=${q}`);
  const list = document.getElementById("employer-jobs-list");

  if (!jobs.length) {
    list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">No jobs posted yet. Tap "Post Job" to fund Escrow & hire.</div>`;
    return;
  }

  list.innerHTML = jobs
    .map((j) => {
      const badge =
        j.status === "accepted"
          ? `<span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Accepted · ${j.accepted_worker_name}</span>`
          : j.status === "completed"
          ? `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Completed · Escrow Released</span>`
          : `<span class="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Open · Escrow Held</span>`;

      return `
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-bold text-sm text-slate-900">${j.skill} · ₹${j.pay_amount}</h4>
              <p class="text-xs text-slate-500 mt-0.5">${j.area} · ${j.duration_label} · Ref: ${j.escrow_ref}</p>
            </div>
            ${badge}
          </div>

          ${
            j.status === "accepted"
              ? `
            <div class="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-extrabold text-slate-900">Worker: ${j.accepted_worker_name}</p>
                  <p class="text-[11px] text-slate-600">Ph: ${j.accepted_worker_phone} · ${j.accepted_at}</p>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="KS.openChat(${j.id}, '${j.accepted_worker_name.replace(/'/g, "")}', '${j.accepted_worker_phone}')"
                    class="bg-white border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-xs">Chat</button>
                  <a href="tel:${j.accepted_worker_phone}"
                    class="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs">Call</a>
                </div>
              </div>

              <div class="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                <div class="flex justify-between"><span class="text-slate-500">Escrow Held</span><span class="font-bold text-emerald-600">₹${j.pay_amount} (Worker gets ₹${j.worker_payout})</span></div>
                <div class="flex justify-between"><span class="text-slate-500">1. Employer End Job</span><span class="font-bold ${j.employer_ended ? "text-emerald-600" : "text-amber-600"}">${j.employer_ended ? "Done" : "Pending"}</span></div>
                <div class="flex justify-between"><span class="text-slate-500">2. Worker End Job</span><span class="font-bold ${j.worker_ended ? "text-emerald-600" : "text-amber-600"}">${j.worker_ended ? "Done" : "Waiting"}</span></div>
              </div>

              <button onclick="KS.employerEndJob(${j.id})" ${j.employer_ended ? "disabled" : ""}
                class="w-full ${j.employer_ended ? "bg-emerald-100 text-emerald-700 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 text-white"} font-bold py-2.5 rounded-xl text-xs">
                ${j.employer_ended ? "Ended by You (Waiting for Worker)" : "End Job & Release Escrow"}
              </button>
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
};

KS.employerEndJob = async function (jobId) {
  try {
    const res = await KS.api(`/api/jobs/${jobId}/end`, {
      method: "POST",
      body: JSON.stringify({ role: "employer" }),
    });
    alert(res.message);
    KS.loadEmployerDashboard();
  } catch (err) {
    alert(err.message);
  }
};
