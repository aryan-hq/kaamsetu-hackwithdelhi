window.KS = window.KS || {};

KS.loadWallet = async function () {
  if (!KS.user) return;
  const data = await KS.api(`/api/wallet/${KS.user.id}`);
  const isWorker = data.role === "worker";

  document.getElementById("wallet-balance-amount").textContent = `₹${data.wallet_balance}`;
  document.getElementById("wallet-subtitle").textContent = isWorker
    ? "Withdrawable Wallet Balance (Escrow Payouts)"
    : "Available Shramvani Escrow Wallet";

  document.getElementById("wallet-stat-1-label").textContent = isWorker ? "In Escrow (Active)" : "Held in Escrow";
  document.getElementById("wallet-stat-1-val").textContent = `₹${data.escrow_held}`;
  document.getElementById("wallet-stat-2-label").textContent = isWorker ? "Total Earned" : "Total Funded";
  document.getElementById("wallet-stat-2-val").textContent = `₹${data.total_volume}`;

  document.getElementById("worker-withdraw-box").classList.toggle("hidden", !isWorker);
  document.getElementById("employer-topup-box").classList.toggle("hidden", isWorker);

  const list = document.getElementById("wallet-tx-list");
  if (!data.transactions.length) {
    list.innerHTML = `<div class="bg-white p-5 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">No transactions yet.</div>`;
    return;
  }

  list.innerHTML = data.transactions
    .map((t) => {
      const isPositive = ["credit", "topup"].includes(t.tx_type);
      const color = isPositive ? "text-emerald-600" : "text-slate-900";
      const sign = isPositive ? "+" : "-";
      return `
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold text-slate-900">${t.title}</p>
            <p class="text-[11px] text-slate-500">${t.note} · ${t.created_at}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-extrabold ${color}">${sign}₹${t.amount}</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">${t.payment_method}</span>
          </div>
        </div>
      `;
    })
    .join("");
};

KS.addWalletMoney = async function (amount) {
  try {
    const res = await KS.api("/api/wallet/add-money", {
      method: "POST",
      body: JSON.stringify({ user_id: KS.user.id, amount }),
    });
    alert(res.message);
    KS.loadWallet();
  } catch (err) {
    alert(err.message);
  }
};

KS.withdrawWalletMoney = async function (e) {
  e.preventDefault();
  const amount = parseInt(document.getElementById("withdraw-amount").value, 10);
  const upi_id = document.getElementById("withdraw-upi").value.trim();
  try {
    const res = await KS.api("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ user_id: KS.user.id, amount, upi_id }),
    });
    alert(res.message);
    document.getElementById("withdraw-amount").value = "";
    KS.loadWallet();
  } catch (err) {
    alert(err.message);
  }
};
