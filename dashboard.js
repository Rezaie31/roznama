const username = getSession();
if (!username) {
  window.location.href = "index.html";
}
document.getElementById("welcome-msg").textContent = "@" + username;

const PROGRESS_VALUES = [0, 10, 25, 50, 75, 100];
const PROGRESS_COLORS = { 0: "#b3432f", 10: "#c65a3a", 25: "#d97a3f", 50: "#e0a83c", 75: "#8fae4a", 100: "#2f7a5c" };
function colorForPct(pct) {
  let closest = 0;
  PROGRESS_VALUES.forEach((v) => {
    if (Math.abs(v - pct) <= Math.abs(closest - pct)) closest = v;
  });
  return PROGRESS_COLORS[closest];
}

let tasks = [];
let folders = [];
let todayProgressMap = {}; // taskId -> 0..100
let logsCache = []; // {date, taskId, progress} همه‌ی امسال تا امروز
let cachedYear = new Date().getFullYear();
let openFolders = new Set(); // folderId هایی که بازن
let dailyChart, weeklyChart, monthlyChart, yearlyChart;

async function init() {
  updateThemeIcon();
  initPickers();
  renderGreeting();

  const data = await apiCall("getDashboardData", { username });
  tasks = data.ok ? data.tasks : [];
  folders = data.ok ? data.folders || [] : [];
  logsCache = data.ok ? data.logs : [];
  folders.forEach((f) => openFolders.add(f.folderId)); // پیش‌فرض همه باز باشن
  openFolders.add("__none__");

  const todayKey = dateKey(0);
  todayProgressMap = {};
  logsCache
    .filter((l) => l.date === todayKey)
    .forEach((l) => (todayProgressMap[l.taskId] = l.progress));

  populateFolderSelect();
  renderTasks();
  renderProgress();
  renderDailyChart();
  renderWeeklyChart();
  renderMonthlyChart();
  renderYearlyChart();
  renderYesterdayRecap();
  renderJournal(data.todayNote || "", data.yesterdayNote || "", data.yesterdayResponse || "");

  document.getElementById("loading-screen").classList.add("hide");
  document.getElementById("dash-wrap").classList.add("ready");
}

function renderGreeting() {
  const hour = new Date().getHours();
  let salute = "سلام";
  if (hour < 5) salute = "شب بخیر";
  else if (hour < 12) salute = "صبح بخیر";
  else if (hour < 17) salute = "ظهر بخیر";
  else if (hour < 21) salute = "عصر بخیر";
  else salute = "شب بخیر";
  document.getElementById("greeting-text").textContent = `${salute}، ${username} 👋`;
}

// ===================== FOLDERS =====================
function populateFolderSelect() {
  const select = document.getElementById("new-task-folder");
  select.innerHTML = `<option value="">بدون پوشه</option>`;
  folders.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.folderId;
    opt.textContent = f.folderName;
    select.appendChild(opt);
  });
}

async function addFolder(btn) {
  const input = document.getElementById("new-folder-name");
  const folderName = input.value.trim();
  if (!folderName) return;
  setLoading(btn, "...");
  try {
    const res = await apiCall("addFolder", { username, folderName });
    folders.push({ folderId: res.folderId, folderName });
    openFolders.add(res.folderId);
    input.value = "";
    populateFolderSelect();
    renderTasks();
    showToast("پوشه‌ی جدید ساخته شد");
  } catch (e) {
    showToast("خطا در ساخت پوشه", "error");
  }
  clearLoading(btn);
}

async function deleteFolder(folderId, evt) {
  if (evt) evt.stopPropagation();
  if (!confirm("این پوشه حذف بشه؟ (کارهای داخلش پاک نمی‌شن، فقط بدون‌پوشه می‌شن)")) return;
  await apiCall("deleteFolder", { username, folderId });
  folders = folders.filter((f) => f.folderId !== folderId);
  tasks.forEach((t) => {
    if (t.folderId === folderId) t.folderId = "";
  });
  populateFolderSelect();
  renderTasks();
  renderProgress();
}

function toggleFolder(folderId, evt) {
  if (evt && evt.target.closest(".folder-del")) return;
  if (openFolders.has(folderId)) openFolders.delete(folderId);
  else openFolders.add(folderId);
  renderTasks();
}

// ===================== TASKS (RENDER) =====================
function folderAvgPct(folderTasks) {
  if (folderTasks.length === 0) return 0;
  const sum = folderTasks.reduce((s, t) => s + (todayProgressMap[t.taskId] || 0), 0);
  return Math.round(sum / folderTasks.length);
}

function buildTaskRowHtml(task) {
  const pct = todayProgressMap[task.taskId] || 0;
  const chips = PROGRESS_VALUES.map((v) => {
    const active = v === pct;
    const style = active ? `style="background:${colorForPct(v)}"` : "";
    return `<button class="chip ${active ? "active" : ""}" ${style} data-task="${task.taskId}" data-val="${v}">${v}٪</button>`;
  }).join("");

  const folderOptions =
    `<option value="" ${!task.folderId ? "selected" : ""}>بدون پوشه</option>` +
    folders.map((f) => `<option value="${f.folderId}" ${task.folderId === f.folderId ? "selected" : ""}>${escapeHtml(f.folderName)}</option>`).join("");

  return `
    <div class="task-row">
      <div class="task-row-top">
        <div class="task-name">${escapeHtml(task.taskName)}</div>
        ${task.targetLabel ? `<div class="task-target">${escapeHtml(task.targetLabel)}</div>` : ""}
        <select class="task-folder-move mono" data-task="${task.taskId}" title="جابه‌جایی به پوشه‌ی دیگه">${folderOptions}</select>
        <button class="task-del" data-id="${task.taskId}">×</button>
      </div>
      <div class="progress-chips">${chips}</div>
    </div>
  `;
}

function renderTasks() {
  const container = document.getElementById("folders-container");
  const empty = document.getElementById("task-empty");
  container.innerHTML = "";
  empty.style.display = tasks.length === 0 ? "block" : "none";

  const ungrouped = tasks.filter((t) => !t.folderId);
  if (ungrouped.length > 0) {
    const wrap = document.createElement("div");
    wrap.className = "ungrouped-tasks";
    wrap.innerHTML = ungrouped.map(buildTaskRowHtml).join("");
    container.appendChild(wrap);
  }

  folders.forEach((folder) => {
    const folderTasks = tasks.filter((t) => t.folderId === folder.folderId);
    const isOpen = openFolders.has(folder.folderId);
    const group = document.createElement("div");
    group.className = "folder-group";
    group.innerHTML = `
      <div class="folder-header ${isOpen ? "open" : ""}" data-folder="${folder.folderId}">
        <span class="chevron">▶</span>
        <span class="folder-name">📁 ${escapeHtml(folder.folderName)}</span>
        <span class="folder-avg">${folderTasks.length ? folderAvgPct(folderTasks) + "%" : "خالی"}</span>
        <button class="folder-del" data-folder="${folder.folderId}">×</button>
      </div>
      <div class="folder-body ${isOpen ? "open" : ""}">
        <div class="folder-body-inner">${folderTasks.map(buildTaskRowHtml).join("") || `<div class="empty-hint" style="padding:12px 0">کاری تو این پوشه نیست</div>`}</div>
      </div>
    `;
    container.appendChild(group);
  });

  container.querySelectorAll(".folder-header").forEach((el) => {
    el.addEventListener("click", (evt) => toggleFolder(el.dataset.folder, evt));
  });
  container.querySelectorAll(".folder-del").forEach((el) => {
    el.addEventListener("click", (evt) => deleteFolder(el.dataset.folder, evt));
  });
  container.querySelectorAll(".task-del").forEach((btn) => {
    btn.addEventListener("click", () => removeTask(btn.dataset.id));
  });
  container.querySelectorAll(".task-folder-move").forEach((select) => {
    select.addEventListener("change", () => moveTaskFolder(select.dataset.task, select.value));
  });
  container.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.classList.add("pop");
      setProgress(chip.dataset.task, Number(chip.dataset.val));
    });
  });
}

function upsertLogCache(date, taskId, progress) {
  const existing = logsCache.find((l) => l.date === date && l.taskId === taskId);
  if (existing) existing.progress = progress;
  else logsCache.push({ date, taskId, progress });
}

async function setProgress(taskId, value) {
  todayProgressMap[taskId] = value;
  const todayKey = dateKey(0);
  upsertLogCache(todayKey, taskId, value);

  renderTasks();
  renderProgress();
  renderDailyChart();
  renderWeeklyChart();
  renderMonthlyChart();
  renderYearlyChart();

  await apiCall("logTask", { username, date: todayKey, taskId, progress: value });
}

async function addTask(btn) {
  const nameInput = document.getElementById("new-task-name");
  const targetInput = document.getElementById("new-task-target");
  const folderSelect = document.getElementById("new-task-folder");
  const taskName = nameInput.value.trim();
  if (!taskName) return;
  setLoading(btn, "در حال افزودن...");
  try {
    const folderId = folderSelect.value;
    const res = await apiCall("addTask", { username, taskName, targetLabel: targetInput.value.trim(), folderId });
    tasks.push({ taskId: res.taskId, taskName, targetLabel: targetInput.value.trim(), folderId });
    nameInput.value = "";
    targetInput.value = "";
    renderTasks();
    renderProgress();
    renderDailyChart();
    renderWeeklyChart();
    renderMonthlyChart();
    renderYearlyChart();
    renderYesterdayRecap();
    showToast("کار جدید اضافه شد");
  } catch (e) {
    showToast("خطا در ارتباط با سرور", "error");
  }
  clearLoading(btn);
}

async function moveTaskFolder(taskId, folderId) {
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return;
  task.folderId = folderId;
  renderTasks();
  renderProgress();
  try {
    await apiCall("updateTaskFolder", { username, taskId, folderId });
    showToast("کار جابه‌جا شد");
  } catch (e) {
    showToast("خطا در جابه‌جایی", "error");
  }
}

async function removeTask(taskId) {
  if (!confirm("این کار حذف بشه؟")) return;
  await apiCall("deleteTask", { username, taskId });
  tasks = tasks.filter((t) => t.taskId !== taskId);
  renderTasks();
  renderProgress();
  renderDailyChart();
  renderWeeklyChart();
  renderMonthlyChart();
  renderYearlyChart();
  renderYesterdayRecap();
}

// ===================== YESTERDAY RECAP =====================
function renderYesterdayRecap() {
  const list = document.getElementById("yesterday-tasks-list");
  const empty = document.getElementById("yesterday-tasks-empty");
  list.innerHTML = "";

  if (tasks.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  const yDate = dateKey(-1);
  const progMap = {};
  logsCache.filter((l) => l.date === yDate).forEach((l) => (progMap[l.taskId] = l.progress));

  tasks.forEach((task) => {
    const pct = progMap[task.taskId] || 0;
    const row = document.createElement("div");
    row.className = "y-task-row";
    row.innerHTML = `<span class="mark" style="background:${colorForPct(pct)}">${pct}٪</span><span>${escapeHtml(task.taskName)}</span>`;
    list.appendChild(row);
  });
}

// ===================== PROGRESS BAR + RING =====================
let wasFullyDone = false;
let firstProgressRender = true;

function todayAvgPct() {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((s, t) => s + (todayProgressMap[t.taskId] || 0), 0);
  return Math.round(sum / tasks.length);
}

function renderProgress() {
  const wrap = document.getElementById("progress-wrap");
  const ringNum = document.getElementById("today-ring-num");
  const ring = document.getElementById("today-ring");

  if (tasks.length === 0) {
    wrap.style.display = "none";
    ring.innerHTML = "";
    ringNum.textContent = "";
    return;
  }
  const pct = todayAvgPct();
  wrap.style.display = "block";
  document.getElementById("progress-text").textContent = "میانگین پیشرفت امروز";
  document.getElementById("progress-pct").textContent = pct + "%";
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-fill").style.background = colorForPct(pct);

  drawTodayRing(pct);
  ringNum.textContent = pct + "%";

  const fullyDone = tasks.length > 0 && tasks.every((t) => (todayProgressMap[t.taskId] || 0) === 100);
  if (fullyDone && !wasFullyDone && !firstProgressRender) {
    launchConfetti();
    showToast("همه‌ی کارهای امروز صد در صد انجام شد! 🎉", "success");
  }
  wasFullyDone = fullyDone;
  firstProgressRender = false;
}

function drawTodayRing(pct) {
  const svg = document.getElementById("today-ring");
  const cx = 20, cy = 20, r = 16, strokeW = 4;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${strokeW}" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorForPct(pct)}" stroke-width="${strokeW}"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${cx} ${cy})" style="transition: stroke-dashoffset .5s ease" />
  `;
}

// ===================== MONTHLY CHART =====================
function daysInMonth_(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function initPickers() {
  const now = new Date();
  const monthPicker = document.getElementById("month-picker");
  monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  monthPicker.max = monthPicker.value;
  monthPicker.addEventListener("change", () => renderMonthlyChart());

  const yearPicker = document.getElementById("year-picker");
  const startYear = now.getFullYear() - 5;
  yearPicker.innerHTML = "";
  for (let y = now.getFullYear(); y >= startYear; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearPicker.appendChild(opt);
  }
  yearPicker.addEventListener("change", () => renderYearlyChart());
}

function avgPctForDay(logs, key) {
  if (tasks.length === 0) return 0;
  const progMap = {};
  logs.filter((l) => l.date === key).forEach((l) => (progMap[l.taskId] = l.progress));
  const sum = tasks.reduce((s, t) => s + (progMap[t.taskId] || 0), 0);
  return Math.round(sum / tasks.length);
}

async function getMonthData() {
  const [yearStr, monthStr] = document.getElementById("month-picker").value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth_(year, month);

  let logs;
  if (year === cachedYear) {
    logs = logsCache;
  } else {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const res = await apiCall("getLogs", { username, startDate: start, endDate: end });
    logs = res.ok ? res.logs : [];
  }

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ label: String(d), pct: avgPctForDay(logs, key) });
  }
  return days;
}

async function renderMonthlyChart() {
  const days = await getMonthData();
  const ctx = document.getElementById("monthly-chart");
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days.map((d) => d.label),
      datasets: [{ data: days.map((d) => d.pct), backgroundColor: days.map((d) => colorForPct(d.pct)), borderRadius: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } },
        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
      },
    },
  });
}

// ===================== YEARLY CHART =====================
const monthNamesFa = ["ژانویه", "فوریه", "مارس", "آوریل", "می", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"];

async function getYearData() {
  const year = Number(document.getElementById("year-picker").value);
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const lastMonth = isCurrentYear ? now.getMonth() : 11;

  let logs;
  if (year === cachedYear) {
    logs = logsCache;
  } else {
    const start = `${year}-01-01`;
    const end = isCurrentYear ? dateKey(0) : `${year}-12-31`;
    const res = await apiCall("getLogs", { username, startDate: start, endDate: end });
    logs = res.ok ? res.logs : [];
  }

  const months = [];
  for (let m = 0; m <= lastMonth; m++) {
    const daysCount = isCurrentYear && m === now.getMonth() ? now.getDate() : daysInMonth_(year, m);
    let total = 0;
    for (let d = 1; d <= daysCount; d++) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      total += avgPctForDay(logs, key);
    }
    const pct = daysCount > 0 ? Math.round(total / daysCount) : 0;
    months.push({ label: monthNamesFa[m], pct });
  }
  return months;
}

async function renderYearlyChart() {
  const months = await getYearData();
  const ctx = document.getElementById("yearly-chart");
  if (yearlyChart) yearlyChart.destroy();
  yearlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [{ data: months.map((m) => m.pct), backgroundColor: months.map((m) => colorForPct(m.pct)), borderRadius: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
    },
  });
}

// ===================== DAILY CHART =====================
function renderDailyChart() {
  const ctx = document.getElementById("daily-chart");
  const labels = tasks.map((t) => t.taskName);
  const data = tasks.map((t) => todayProgressMap[t.taskId] || 0);

  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data, backgroundColor: data.map(colorForPct), borderRadius: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
    },
  });
}

// ===================== WEEKLY CHART + RING =====================
function getWeekData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = dateKey(-i);
    days.push({ key, label: weekdayLabelFa(key), pct: avgPctForDay(logsCache, key) });
  }
  return days;
}

function renderWeeklyChart() {
  const days = getWeekData();
  const ctx = document.getElementById("weekly-chart");

  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: days.map((d) => d.label),
      datasets: [
        {
          data: days.map((d) => d.pct),
          borderColor: "#e08a3c",
          backgroundColor: "rgba(224,138,60,0.15)",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#e08a3c",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
    },
  });

  drawWeekRing(days);
}

function drawWeekRing(days) {
  const svg = document.getElementById("week-ring");
  const legend = document.getElementById("ring-legend");
  svg.innerHTML = "";
  legend.innerHTML = "";

  const cx = 55, cy = 55, r = 42, strokeW = 12;
  const n = days.length;
  const gap = 0.06;
  const segAngle = (2 * Math.PI) / n - gap;

  days.forEach((d, i) => {
    const startAngle = -Math.PI / 2 + i * ((2 * Math.PI) / n);
    const endAngle = startAngle + segAngle;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, startAngle, endAngle));
    path.setAttribute("stroke", colorForPct(d.pct));
    path.setAttribute("stroke-width", strokeW);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  });

  const avg = Math.round(days.reduce((s, d) => s + d.pct, 0) / days.length);
  const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  centerText.setAttribute("x", cx);
  centerText.setAttribute("y", cy + 6);
  centerText.setAttribute("text-anchor", "middle");
  centerText.setAttribute("font-size", "20");
  centerText.setAttribute("font-family", "IBM Plex Mono, monospace");
  centerText.setAttribute("fill", "#1f2430");
  centerText.textContent = avg + "%";
  svg.appendChild(centerText);

  legend.innerHTML = `
    <div><span class="dot" style="background:#2f7a5c"></span>عالی (۷۵-۱۰۰٪)</div>
    <div><span class="dot" style="background:#e0a83c"></span>متوسط (۲۵-۵۰٪)</div>
    <div><span class="dot" style="background:#b3432f"></span>کم (۰-۱۰٪)</div>
  `;
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ===================== JOURNAL + REMINDER =====================
function renderJournal(todayNote, yesterdayNote, yesterdayResponse) {
  const panel = document.getElementById("reminder-panel");
  const textEl = document.getElementById("reminder-note-text");
  const actions = document.getElementById("reminder-actions");
  const resultEl = document.getElementById("reminder-result");

  if (yesterdayNote) {
    panel.style.display = "block";
    textEl.textContent = yesterdayNote;

    if (yesterdayResponse === "accepted" || yesterdayResponse === "rejected") {
      actions.style.display = "none";
      resultEl.style.display = "block";
      resultEl.textContent =
        yesterdayResponse === "accepted" ? "قبول کردی — امروز انجامش بده ✓" : "رد کردی — مشکلی نیست، شاید دفعه‌ی بعد";
    } else {
      actions.style.display = "flex";
      resultEl.style.display = "none";
    }
  } else {
    panel.style.display = "none";
  }

  if (todayNote) {
    document.getElementById("today-note").value = todayNote;
  }
}

async function respondToNote(choice) {
  await apiCall("saveNoteResponse", { username, date: dateKey(-1), response: choice });
  document.getElementById("reminder-actions").style.display = "none";
  const resultEl = document.getElementById("reminder-result");
  resultEl.style.display = "block";
  resultEl.textContent = choice === "accepted" ? "قبول کردی — امروز انجامش بده ✓" : "رد کردی — مشکلی نیست، شاید دفعه‌ی بعد";
  showToast(choice === "accepted" ? "عالیه، موفق باشی 💪" : "باشه، هروقت خواستی");
}

async function saveJournal(btn) {
  const note = document.getElementById("today-note").value.trim();
  setLoading(btn, "در حال ذخیره...");
  await apiCall("saveNote", { username, date: dateKey(0), note });
  clearLoading(btn);
  btn.textContent = "ذخیره شد ✓";
  setTimeout(() => { btn.textContent = "ذخیره یادداشت امروز"; }, 1800);
}

// ===================== MISC =====================
function logout() {
  clearSession();
  window.location.href = "index.html";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();
