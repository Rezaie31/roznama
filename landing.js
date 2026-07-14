// اگه از قبل لاگین کرده، مستقیم بفرستش داشبورد
if (getSession()) {
  window.location.href = "dashboard.html";
}

function openModal(tab) {
  document.getElementById("overlay").classList.add("open");
  switchTab(tab);
}
function closeModal() {
  document.getElementById("overlay").classList.remove("open");
  document.getElementById("login-error").textContent = "";
  document.getElementById("register-error").textContent = "";
}
function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("tab-login").classList.toggle("active", isLogin);
  document.getElementById("tab-register").classList.toggle("active", !isLogin);
  document.getElementById("form-login").style.display = isLogin ? "block" : "none";
  document.getElementById("form-register").style.display = isLogin ? "none" : "block";
}

async function handleRegister(btn) {
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value;
  const errEl = document.getElementById("register-error");
  errEl.textContent = "";
  if (!username || !password) {
    errEl.textContent = "نام کاربری و رمز عبور رو پر کن";
    return;
  }
  if (password.length < 4) {
    errEl.textContent = "رمز عبور باید حداقل ۴ کاراکتر باشه";
    return;
  }
  setLoading(btn, "در حال ثبت‌نام...");
  try {
    const passwordHash = await hashPassword(password);
    const res = await apiCall("register", { username, passwordHash });
    if (!res.ok) {
      errEl.textContent = res.error || "خطایی پیش اومد";
      clearLoading(btn);
      return;
    }
    setSession(username);
    window.location.href = "dashboard.html";
  } catch (e) {
    errEl.textContent = "اتصال به سرور برقرار نشد. آدرس APPS_SCRIPT_URL رو چک کن.";
    clearLoading(btn);
  }
}

async function handleLogin(btn) {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  if (!username || !password) {
    errEl.textContent = "نام کاربری و رمز عبور رو پر کن";
    return;
  }
  setLoading(btn, "در حال ورود...");
  try {
    const passwordHash = await hashPassword(password);
    const res = await apiCall("login", { username, passwordHash });
    if (!res.ok) {
      errEl.textContent = res.error || "خطایی پیش اومد";
      clearLoading(btn);
      return;
    }
    setSession(username);
    window.location.href = "dashboard.html";
  } catch (e) {
    errEl.textContent = "اتصال به سرور برقرار نشد. آدرس APPS_SCRIPT_URL رو چک کن.";
    clearLoading(btn);
  }
}

// ===== آیکون تم + انیمیشن ظاهر شدن هنگام اسکرول =====
updateThemeIcon();
document.querySelectorAll(".reveal").forEach((el) => {
  new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  ).observe(el);
});

// ===== انیمیشن قوس روز (خورشید که از افق طلوع تا غروب حرکت می‌کنه) =====
(function drawArc() {
  const wrap = document.getElementById("arc-wrap");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 800 400");
  svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
  svg.style.width = "100%";
  svg.style.height = "100%";

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M 40 380 A 360 360 0 0 1 760 380");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "rgba(255,255,255,0.25)");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-dasharray", "2 8");
  svg.appendChild(path);

  const sun = document.createElementNS(ns, "circle");
  sun.setAttribute("r", "14");
  sun.setAttribute("fill", "#ffd98e");
  sun.style.filter = "drop-shadow(0 0 14px rgba(255,217,142,0.8))";
  svg.appendChild(sun);

  wrap.appendChild(svg);

  const pathLen = path.getTotalLength();
  let t = 0;
  function animate() {
    t += 0.0016;
    if (t > 1) t = 0;
    const pt = path.getPointAtLength(pathLen * t);
    sun.setAttribute("cx", pt.x);
    sun.setAttribute("cy", pt.y);
    requestAnimationFrame(animate);
  }
  animate();
})();
