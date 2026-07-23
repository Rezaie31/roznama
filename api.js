// ============================================
// ارتباط با بک‌اند (گوگل اپس اسکریپت + گوگل شیت)
// ============================================
async function apiCall(action, payload = {}) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    // از text/plain استفاده می‌کنیم تا مرورگر preflight request نفرسته
    // (اپس‌اسکریپت به CORS preflight درست جواب نمی‌ده)
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error("خطا در ارتباط با سرور");
  return res.json();
}

async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// اگه ساعت بین نیمه‌شب تا ۴ صبحه، هنوز «دیروز» حساب می‌شه
// (برای کسایی که تا دیروقت بیدارن و کارهاشونو انجام می‌دن)
function logicalNow() {
  const now = new Date();
  if (now.getHours() < 4) {
    now.setDate(now.getDate() - 1);
  }
  return now;
}

function dateKey(offsetDays = 0) {
  const d = logicalNow();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayLabelFa(dateStr) {
  const days = ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

function formatTimeFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// ===== حالت تاریک / روشن =====
function initTheme() {
  const saved = localStorage.getItem("dt_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("dt_theme", next);
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.textContent = isDark ? "☀️" : "🌙";
}
initTheme();

// ===== نمایش «لطفاً صبر کنید» روی دکمه‌ها هنگام کار async =====
function setLoading(btn, text) {
  if (!btn) return;
  btn.dataset.originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span>${text || "در حال ثبت..."}`;
  btn.disabled = true;
  btn.classList.add("is-loading");
}
function clearLoading(btn) {
  if (!btn) return;
  if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  btn.disabled = false;
  btn.classList.remove("is-loading");
}

// ===== نشست کاربر (session) =====
function getSession() {
  return localStorage.getItem("dt_username");
}
function setSession(username) {
  localStorage.setItem("dt_username", username);
}
function clearSession() {
  localStorage.removeItem("dt_username");
}

// ===== نوتیفیکیشن‌های شناور (Toast) =====
function showToast(message, type = "") {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = "toast" + (type ? " " + type : "");
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// ===== جشن کوچیک (Confetti) =====
function launchConfetti() {
  const colors = ["#2f7a5c", "#e08a3c", "#ffd98e", "#3fae82", "#f2a65a"];
  const count = 60;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.4 + "s";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}
