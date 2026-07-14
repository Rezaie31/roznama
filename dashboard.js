const username = getSession();
if (!username) {
  window.location.href = "index.html";
}
document.getElementById("welcome-msg").textContent = "@" + username;

let tasks = [];
let todayLogsMap = {}; // taskId -> done
let dailyChart, weeklyChart, monthlyChart, yearlyChart;

async function init() {
  updateThemeIcon();
  initPickers();
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  renderProgress();
  await renderDailyChart();
  await renderWeeklyChart();
  await renderMonthlyChart();
  await renderYearlyChart();
  await loadJournal();
}

function renderProgress() {
  const wrap = document.getElementById("progress-wrap");
  if (tasks.length === 0) {
    wrap.style.display = "none";
    return;
  }
  const doneCount = tasks.filter((t) => todayLogsMap[t.taskId]).length;
  const pct = Math.round((doneCount / tasks.length) * 100);
  wrap.style.display = "block";
  document.getElementById("progress-text").textContent = `${doneCount} از ${tasks.length} کار انجام شده`;
  document.getElementById("progress-pct").textContent = pct + "%";
  document.getElementById("progress-fill").style.width = pct + "%";
}

// ===================== TASKS =====================
async function loadTasks() {
  const res = await apiCall("getTasks", { username });
  tasks = res.ok ? res.tasks : [];
}

async function loadTodayLogs() {
  const today = dateKey(0);
  const res = await apiCall("getLogs", { username, startDate: today, endDate: today });
  todayLogsMap = {};
  if (res.ok) {
    res.logs.forEach((l) => (todayLogsMap[l.taskId] = l.done === true || l.done === "TRUE"));
  }
}

function renderTasks() {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("task-empty");
  list.innerHTML = "";
  empty.style.display = tasks.length === 0 ? "block" : "none";

  tasks.forEach((task) => {
    const done = !!todayLogsMap[task.taskId];
    const row = document.createElement("div");
    row.className = "task-row";
    row.innerHTML = `
      <button class="task-check ${done ? "done" : ""}" data-id="${task.taskId}">${done ? "✓" : ""}</button>
      <div style="flex:1">
        <div class="task-name">${escapeHtml(task.taskName)}</div>
        ${task.targetLabel ? `<div class="task-target">${escapeHtml(task.targetLabel)}</div>` : ""}
      </div>
      <button class="task-del" data-id="${task.taskId}">×</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".task-check").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.add("pop");
      toggleTask(btn.dataset.id);
    });
  });
  list.querySelectorAll(".task-del").forEach((btn) => {
    btn.addEventListener("click", () => removeTask(btn.dataset.id));
  });
}

async function toggleTask(taskId) {
  const newDone = !todayLogsMap[taskId];
  todayLogsMap[taskId] = newDone;
  renderTasks();
  renderProgress();
  await apiCall("logTask", { username, date: dateKey(0), taskId, done: newDone });
  await renderDailyChart();
  await renderWeeklyChart();
  await renderMonthlyChart();
  await renderYearlyChart();
}

async function addTask(btn) {
  const nameInput = document.getElementById("new-task-name");
  const targetInput = document.getElementById("new-task-target");
  const taskName = nameInput.value.trim();
  if (!taskName) return;
  setLoading(btn, "در حال افزودن...");
  await apiCall("addTask", { username, taskName, targetLabel: targetInput.value.trim() });
  nameInput.value = "";
  targetInput.value = "";
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  renderProgress();
  await renderDailyChart();
  await renderWeeklyChart();
  await renderMonthlyChart();
  await renderYearlyChart();
  clearLoading(btn);
}

async function removeTask(taskId) {
  if (!confirm("این کار حذف بشه؟")) return;
  await apiCall("deleteTask", { username, taskId });
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  renderProgress();
  await renderDailyChart();
  await renderWeeklyChart();
  await renderMonthlyChart();
  await renderYearlyChart();
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
  const startYear = now.getFullYear() - 5; // آخرین ۶ سال قابل انتخابن
  yearPicker.innerHTML = "";
  for (let y = now.getFullYear(); y >= startYear; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearPicker.appendChild(opt);
  }
  yearPicker.addEventListener("change", () => renderYearlyChart());
}

async function getMonthData() {
  const [yearStr, monthStr] = document.getElementById("month-picker").value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-based
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth_(year, month);

  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const res = await apiCall("getLogs", { username, startDate: start, endDate: end });
  const logs = res.ok ? res.logs : [];

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayLogs = logs.filter((l) => l.date === key && (l.done === true || l.done === "TRUE"));
    const total = tasks.length;
    const pct = total > 0 ? Math.round((dayLogs.length / total) * 100) : 0;
    days.push({ label: String(d), pct });
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
      datasets: [
        {
          data: days.map((d) => d.pct),
          backgroundColor: days.map((d) => (d.pct >= 100 ? "#2f7a5c" : d.pct > 0 ? "#e08a3c" : "rgba(107,114,128,0.25)")),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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

  const start = `${year}-01-01`;
  const end = isCurrentYear ? dateKey(0) : `${year}-12-31`;
  const res = await apiCall("getLogs", { username, startDate: start, endDate: end });
  const logs = res.ok ? res.logs : [];

  const months = [];
  for (let m = 0; m <= lastMonth; m++) {
    const relevantDays = isCurrentYear && m === now.getMonth() ? now.getDate() : daysInMonth_(year, m);
    const monthPrefix = `${year}-${String(m + 1).padStart(2, "0")}-`;
    const monthLogs = logs.filter((l) => l.date.startsWith(monthPrefix) && (l.done === true || l.done === "TRUE"));
    const total = tasks.length * relevantDays;
    const pct = total > 0 ? Math.round((monthLogs.length / total) * 100) : 0;
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
      datasets: [
        {
          data: months.map((m) => m.pct),
          backgroundColor: months.map((m) => (m.pct >= 70 ? "#2f7a5c" : m.pct > 0 ? "#e08a3c" : "rgba(107,114,128,0.25)")),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
    },
  });
}

// ===================== DAILY CHART =====================
async function renderDailyChart() {
  const ctx = document.getElementById("daily-chart");
  const labels = tasks.map((t) => t.taskName);
  const data = tasks.map((t) => (todayLogsMap[t.taskId] ? 1 : 0));

  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((d) => (d ? "#2f7a5c" : "rgba(107,114,128,0.25)")),
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 1, ticks: { stepSize: 1, callback: (v) => (v === 1 ? "انجام شد" : "نشد") } },
      },
    },
  });
}

// ===================== WEEKLY CHART + RING =====================
async function getWeekData() {
  const start = dateKey(-6);
  const end = dateKey(0);
  const res = await apiCall("getLogs", { username, startDate: start, endDate: end });
  const logs = res.ok ? res.logs : [];

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = dateKey(-i);
    const dayLogs = logs.filter((l) => l.date === key && (l.done === true || l.done === "TRUE"));
    const total = tasks.length;
    const pct = total > 0 ? Math.round((dayLogs.length / total) * 100) : 0;
    days.push({ key, label: weekdayLabelFa(key), pct });
  }
  return days;
}

async function renderWeeklyChart() {
  const days = await getWeekData();
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
  const gap = 0.06; // فاصله بین قوس‌ها (رادیان)
  const segAngle = (2 * Math.PI) / n - gap;

  days.forEach((d, i) => {
    const startAngle = -Math.PI / 2 + i * ((2 * Math.PI) / n);
    const endAngle = startAngle + segAngle;
    const color = d.pct >= 100 ? "#2f7a5c" : d.pct > 0 ? "#e08a3c" : "rgba(107,114,128,0.25)";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, startAngle, endAngle));
    path.setAttribute("stroke", color);
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
    <div><span class="dot" style="background:#2f7a5c"></span>روز کامل</div>
    <div><span class="dot" style="background:#e08a3c"></span>ناقص</div>
    <div><span class="dot" style="background:rgba(107,114,128,0.25)"></span>انجام‌نشده</div>
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

// ===================== JOURNAL =====================
async function loadJournal() {
  const yesterdayRes = await apiCall("getNote", { username, date: dateKey(-1) });
  const box = document.getElementById("yesterday-note-box");
  const textEl = document.getElementById("yesterday-note-text");
  if (yesterdayRes.ok && yesterdayRes.note) {
    box.style.display = "block";
    textEl.textContent = "دیروز این یادداشت‌ها رو داشتی — یادت باشه طبق برنامه پیش بری: " + yesterdayRes.note;
  }

  const todayRes = await apiCall("getNote", { username, date: dateKey(0) });
  if (todayRes.ok && todayRes.note) {
    document.getElementById("today-note").value = todayRes.note;
  }
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
