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

function dateKey(offsetDays = 0) {
  const d = new Date();
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
