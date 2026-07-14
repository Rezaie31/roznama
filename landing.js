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
    showToast("خطا در اتصال به سرور", "error");
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

// ===== شماره‌گذاری برای تاخیر پلکانی =====
document.querySelectorAll(".steps-grid .step, .features .feature").forEach((el, i) => {
  el.style.setProperty("--i", i);
});

// ===== ذرات شناور تو هیرو (کمتر رو موبایل، خاموش با کاهش حرکت) =====
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.innerWidth < 600;

(function makeParticles() {
  if (prefersReducedMotion) return;
  const wrap = document.getElementById("particles");
  const count = isMobile ? 8 : 22;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = 2 + Math.random() * 3;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = 40 + Math.random() * 55 + "%";
    p.style.animationDuration = 6 + Math.random() * 8 + "s";
    p.style.animationDelay = Math.random() * 8 + "s";
    wrap.appendChild(p);
  }
})();

// ===== شمارش انیمیشنی آمار =====
(function animateStats() {
  const nums = document.querySelectorAll(".stat .num[data-count]");
  if (!nums.length) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const duration = 1200;
        const start = performance.now();
        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        obs.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  nums.forEach((el) => observer.observe(el));
})();

// ===== افکت تیلت سه‌بعدی رو کارت‌های فیچر (فقط دسکتاپ) =====
if (!isMobile) {
  document.querySelectorAll(".feature").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / rect.height) * -10;
      const rotateY = ((x - rect.width / 2) / rect.width) * 10;
      card.style.transform = `translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

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

  // رو موبایل یا وقتی کاربر ترجیح می‌ده حرکت کمتری ببینه، فقط ثابت وسط قوس بذارش
  if (prefersReducedMotion || isMobile) {
    const pt = path.getPointAtLength(pathLen * 0.5);
    sun.setAttribute("cx", pt.x);
    sun.setAttribute("cy", pt.y);
    return;
  }

  let t = 0;
  let running = true;
  let rafId;
  function animate() {
    if (!running) return;
    t += 0.0016;
    if (t > 1) t = 0;
    const pt = path.getPointAtLength(pathLen * t);
    sun.setAttribute("cx", pt.x);
    sun.setAttribute("cy", pt.y);
    rafId = requestAnimationFrame(animate);
  }
  animate();

  // وقتی تب مخفیه، انیمیشن رو متوقف کن تا CPU/باتری هدر نره
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      animate();
    }
  });
})();
