let supportPollInterval = null;

function openSupportModal() {
  document.getElementById("support-overlay").classList.add("open");
  const phone = localStorage.getItem("dt_support_phone");
  if (phone) {
    showSupportChat(phone);
  } else {
    document.getElementById("support-intro").style.display = "block";
    document.getElementById("support-chat").style.display = "none";
  }
}

function closeSupportModal() {
  document.getElementById("support-overlay").classList.remove("open");
  if (supportPollInterval) {
    clearInterval(supportPollInterval);
    supportPollInterval = null;
  }
}

async function startSupportChat(btn) {
  const phone = document.getElementById("support-phone").value.trim();
  const message = document.getElementById("support-first-message").value.trim();
  const errEl = document.getElementById("support-error");
  errEl.textContent = "";
  if (!phone || !message) {
    errEl.textContent = "شماره تماس و پیامت رو پر کن";
    return;
  }
  setLoading(btn, "در حال ارسال...");
  try {
    await apiCall("sendSupportMessage", { phone, sender: "user", message });
    localStorage.setItem("dt_support_phone", phone);
    clearLoading(btn);
    showSupportChat(phone);
    showToast("پیامت ارسال شد");
  } catch (e) {
    errEl.textContent = "خطا در ارسال. دوباره امتحان کن.";
    clearLoading(btn);
  }
}

async function showSupportChat(phone) {
  document.getElementById("support-intro").style.display = "none";
  document.getElementById("support-chat").style.display = "block";
  await refreshChatThread(phone);
  if (supportPollInterval) clearInterval(supportPollInterval);
  supportPollInterval = setInterval(() => refreshChatThread(phone), 6000);
}

async function refreshChatThread(phone) {
  const res = await apiCall("getSupportMessages", { phone });
  const thread = document.getElementById("chat-thread");
  if (!res.ok) return;
  thread.innerHTML = res.messages
    .map((m) => `<div class="chat-bubble ${m.sender === "admin" ? "admin" : "user"}">${escapeHtmlSupport(m.message)}</div>`)
    .join("");
  thread.scrollTop = thread.scrollHeight;
}

async function sendChatMessage(btn) {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  const phone = localStorage.getItem("dt_support_phone");
  if (!phone) return;
  input.value = "";
  setLoading(btn, "...");
  await apiCall("sendSupportMessage", { phone, sender: "user", message });
  clearLoading(btn);
  await refreshChatThread(phone);
}

function resetSupportPhone() {
  localStorage.removeItem("dt_support_phone");
  if (supportPollInterval) {
    clearInterval(supportPollInterval);
    supportPollInterval = null;
  }
  document.getElementById("support-intro").style.display = "block";
  document.getElementById("support-chat").style.display = "none";
  document.getElementById("support-phone").value = "";
  document.getElementById("support-first-message").value = "";
}

function escapeHtmlSupport(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
