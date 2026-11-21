window.KS = window.KS || {};
KS.chatJobId = null;
KS.chatPollTimer = null;

KS.openChat = async function (jobId, peerName, peerPhone) {
  KS.chatJobId = jobId;
  document.getElementById("chat-peer-name").textContent = peerName;
  document.getElementById("chat-peer-phone").textContent = peerPhone;
  document.getElementById("chat-call-link").href = `tel:${peerPhone}`;
  document.getElementById("chat-modal").classList.remove("hidden");
  await KS.loadChatMessages();
  clearInterval(KS.chatPollTimer);
  KS.chatPollTimer = setInterval(KS.loadChatMessages, 4000);
};

KS.closeChat = function () {
  document.getElementById("chat-modal").classList.add("hidden");
  clearInterval(KS.chatPollTimer);
};

KS.loadChatMessages = async function () {
  if (!KS.chatJobId) return;
  const { messages } = await KS.api(`/api/jobs/${KS.chatJobId}/messages`);
  const box = document.getElementById("chat-messages");
  box.innerHTML = messages
    .map((m) => {
      if (m.sender_role === "system") {
        return `<div class="text-center text-[11px] bg-blue-50 text-blue-800 px-3 py-2 rounded-xl my-1">${m.message}</div>`;
      }
      const isMe = KS.user && m.sender_role === KS.user.role;
      return `
        <div class="flex flex-col ${isMe ? "items-end" : "items-start"}">
          <div class="max-w-[82%] px-3.5 py-2 rounded-2xl text-xs ${
            isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-900 rounded-bl-sm"
          }">
            <p class="font-bold text-[10px] opacity-75 mb-0.5">${m.sender_name}</p>
            <p>${m.message}</p>
          </div>
          <span class="text-[10px] text-slate-400 mt-0.5 px-1">${m.created_at}</span>
        </div>
      `;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
};

KS.sendChatMessage = async function (e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !KS.chatJobId) return;
  input.value = "";
  await KS.api(`/api/jobs/${KS.chatJobId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      sender_role: KS.user ? KS.user.role : "worker",
      sender_name: KS.user ? KS.user.name : "User",
      message: text,
    }),
  });
  await KS.loadChatMessages();
};
