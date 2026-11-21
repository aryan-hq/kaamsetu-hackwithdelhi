window.KS = window.KS || {};

KS.postJob = async function (e) {
  e.preventDefault();
  const durationSelect = document.getElementById("emp-duration");
  const durationLabel = durationSelect.options[durationSelect.selectedIndex].text;
  const days = parseInt(durationSelect.value, 10) || 1;

  await KS.api("/api/jobs", {
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
      pay_amount: document.getElementById("emp-rate").value,
      payment_mode: document.getElementById("emp-pay-mode").value,
    }),
  });
  alert("Job posted! Matching workers can now see and accept it.");
  KS.switchPortalView("employer-dashboard");
};

KS.loadEmployerDashboard = async function () {
  if (!KS.user) return;
  const q = encodeURIComponent((document.getElementById("employer-search")?.value || "").trim());
  const { jobs } = await KS.api(`/api/jobs?employer_id=${KS.user.id}&q=${q}`);
  const list = document.getElementById("employer-jobs-list");

  if (!jobs.length) {
    list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">No jobs found. Tap "Post Job" to hire a worker.</div>`;
    return;
  }

  list.innerHTML = jobs
    .map((j) => {
      const badge =
        j.status === "accepted"
          ? `<span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Accepted · ${j.accepted_worker_name}</span>`
          : j.status === "completed"
          ? `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Completed (${j.payment_method_used || j.payment_mode})</span>`
          : `<span class="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Open · Waiting</span>`;

      const payStatusText = j.payment_verified
        ? `Verified (${j.payment_method_used}${j.upi_ref_id ? " · " + j.upi_ref_id : ""})`
        : j.payment_mode === "Cash"
        ? "Waiting for Worker Cash Confirm"
        : "Pending UPI Payment";

      return `
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-bold text-sm text-slate-900">${j.skill} · ₹${j.pay_amount}</h4>
              <p class="text-xs text-slate-500 mt-0.5">${j.area} · ${j.duration_label} · Preferred: ${j.payment_mode}</p>
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
                  <p class="text-[11px] text-slate-600">Ph: ${j.accepted_worker_phone} · Accepted ${j.accepted_at}</p>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="KS.openChat(${j.id}, '${j.accepted_worker_name.replace(/'/g, "")}', '${j.accepted_worker_phone}')"
                    class="bg-white border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-xs">Chat</button>
                  <a href="tel:${j.accepted_worker_phone}"
                    class="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs">Call</a>
                </div>
              </div>

              <!-- 3-Step Verification Status -->
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                <div class="flex justify-between"><span class="text-slate-500">1. Employer End Job</span><span class="font-bold ${j.employer_ended ? "text-emerald-600" : "text-amber-600"}">${j.employer_ended ? "Done" : "Pending"}</span></div>
                <div class="flex justify-between"><span class="text-slate-500">2. Worker End Job</span><span class="font-bold ${j.worker_ended ? "text-emerald-600" : "text-amber-600"}">${j.worker_ended ? "Done" : "Waiting"}</span></div>
                <div class="flex justify-between"><span class="text-slate-500">3. Payment</span><span class="font-bold ${j.payment_verified ? "text-emerald-600" : "text-amber-600"}">${payStatusText}</span></div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button onclick="KS.employerEndJob(${j.id})" ${j.employer_ended ? "disabled" : ""}
                  class="${j.employer_ended ? "bg-emerald-100 text-emerald-700 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 text-white"} font-bold py-2.5 rounded-xl text-xs">
                  ${j.employer_ended ? "Ended by You" : "End Job"}
                </button>
                ${
                  !j.payment_verified
                    ? `<button onclick="KS.employerPayUPI(${j.id}, ${j.pay_amount})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs">Pay ₹${j.pay_amount} via UPI</button>`
                    : `<button disabled class="bg-emerald-100 text-emerald-700 font-bold py-2.5 rounded-xl text-xs cursor-not-allowed">Payment Verified</button>`
                }
              </div>
              ${
                !j.payment_verified
                  ? `<p class="text-[10px] text-slate-500 text-center">Paying in Cash? Hand over ₹${j.pay_amount} directly and ask worker to tap "Payment Collected (Cash)".</p>`
                  : ""
              }
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

KS.employerPayUPI = async function (jobId, amount) {
  const upi = prompt(`Verify UPI Payment of ₹${amount}.
Enter your UPI ID (deducted from KaamSetu Wallet):`, "employer@upi");
  if (!upi) return;
  try {
    const res = await KS.api(`/api/jobs/${jobId}/pay-upi`, {
      method: "POST",
      body: JSON.stringify({ employer_id: KS.user.id, upi_id: upi }),
    });
    alert(res.message);
    KS.loadEmployerDashboard();
  } catch (err) {
    alert(err.message);
  }
};
