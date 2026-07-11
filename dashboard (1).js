const username = getSession();
if (!username) {
  window.location.href = "index.html";
}
document.getElementById("welcome-msg").textContent = "@" + username;

let tasks = [];
let todayLogsMap = {}; // taskId -> done
let dailyChart, weeklyChart;

async function init() {
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  await renderDailyChart();
  await renderWeeklyChart();
  await loadJournal();
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
    btn.addEventListener("click", () => toggleTask(btn.dataset.id));
  });
  list.querySelectorAll(".task-del").forEach((btn) => {
    btn.addEventListener("click", () => removeTask(btn.dataset.id));
  });
}

async function toggleTask(taskId) {
  const newDone = !todayLogsMap[taskId];
  todayLogsMap[taskId] = newDone;
  renderTasks();
  await apiCall("logTask", { username, date: dateKey(0), taskId, done: newDone });
  await renderDailyChart();
  await renderWeeklyChart();
}

async function addTask() {
  const nameInput = document.getElementById("new-task-name");
  const targetInput = document.getElementById("new-task-target");
  const taskName = nameInput.value.trim();
  if (!taskName) return;
  await apiCall("addTask", { username, taskName, targetLabel: targetInput.value.trim() });
  nameInput.value = "";
  targetInput.value = "";
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  await renderDailyChart();
  await renderWeeklyChart();
}

async function removeTask(taskId) {
  if (!confirm("این کار حذف بشه؟")) return;
  await apiCall("deleteTask", { username, taskId });
  await loadTasks();
  await loadTodayLogs();
  renderTasks();
  await renderDailyChart();
  await renderWeeklyChart();
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

async function saveJournal() {
  const note = document.getElementById("today-note").value.trim();
  await apiCall("saveNote", { username, date: dateKey(0), note });
  alert("یادداشت امروز ذخیره شد ✓");
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
