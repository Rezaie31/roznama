/**
 * بک‌اند اپلیکیشن ثبت کارهای روزانه
 * این فایل رو کامل کپی کن تو Google Apps Script (توضیحات کامل تو README.md هست)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function getSheet_(name, headers) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function usersSheet_()  { return getSheet_('Users',  ['username', 'passwordHash', 'createdAt']); }
function tasksSheet_()  { return getSheet_('Tasks',  ['taskId', 'username', 'taskName', 'targetLabel', 'active', 'createdAt']); }
function logsSheet_()   { return getSheet_('Logs',   ['username', 'date', 'taskId', 'done']); }
function notesSheet_()  { return getSheet_('Notes',  ['username', 'date', 'note']); }

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'register':  result = registerUser_(body.username, body.passwordHash); break;
      case 'login':      result = loginUser_(body.username, body.passwordHash); break;
      case 'addTask':    result = addTask_(body.username, body.taskName, body.targetLabel); break;
      case 'getTasks':   result = getTasks_(body.username); break;
      case 'deleteTask': result = deleteTask_(body.username, body.taskId); break;
      case 'logTask':    result = logTask_(body.username, body.date, body.taskId, body.done); break;
      case 'getLogs':    result = getLogs_(body.username, body.startDate, body.endDate); break;
      case 'saveNote':   result = saveNote_(body.username, body.date, body.note); break;
      case 'getNote':    result = getNote_(body.username, body.date); break;
      default:           result = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Users =====
function findUserRow_(username) {
  const data = usersSheet_().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) return i + 1;
  }
  return -1;
}

function registerUser_(username, passwordHash) {
  if (!username || !passwordHash) return { ok: false, error: 'اطلاعات ناقصه' };
  if (findUserRow_(username) !== -1) return { ok: false, error: 'این نام کاربری قبلاً گرفته شده' };
  usersSheet_().appendRow([username, passwordHash, new Date().toISOString()]);
  return { ok: true };
}

function loginUser_(username, passwordHash) {
  const row = findUserRow_(username);
  if (row === -1) return { ok: false, error: 'کاربری با این نام پیدا نشد' };
  const data = usersSheet_().getRange(row, 1, 1, 3).getValues()[0];
  if (data[1] !== passwordHash) return { ok: false, error: 'رمز عبور اشتباهه' };
  return { ok: true, username: username };
}

// ===== Tasks =====
function addTask_(username, taskName, targetLabel) {
  const taskId = Utilities.getUuid();
  tasksSheet_().appendRow([taskId, username, taskName, targetLabel || '', true, new Date().toISOString()]);
  return { ok: true, taskId: taskId };
}

function getTasks_(username) {
  const data = tasksSheet_().getDataRange().getValues();
  const tasks = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][4] === true) {
      tasks.push({ taskId: data[i][0], taskName: data[i][2], targetLabel: data[i][3] });
    }
  }
  return { ok: true, tasks: tasks };
}

function deleteTask_(username, taskId) {
  const sheet = tasksSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId && data[i][1] === username) {
      sheet.getRange(i + 1, 5).setValue(false);
      return { ok: true };
    }
  }
  return { ok: false, error: 'کار پیدا نشد' };
}

// ===== Logs =====
function logTask_(username, date, taskId, done) {
  const sheet = logsSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === date && data[i][2] === taskId) {
      sheet.getRange(i + 1, 4).setValue(done);
      return { ok: true };
    }
  }
  sheet.appendRow([username, date, taskId, done]);
  return { ok: true };
}

function getLogs_(username, startDate, endDate) {
  const data = logsSheet_().getDataRange().getValues();
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] >= startDate && data[i][1] <= endDate) {
      logs.push({ date: data[i][1], taskId: data[i][2], done: data[i][3] });
    }
  }
  return { ok: true, logs: logs };
}

// ===== Notes =====
function saveNote_(username, date, note) {
  const sheet = notesSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === date) {
      sheet.getRange(i + 1, 3).setValue(note);
      return { ok: true };
    }
  }
  sheet.appendRow([username, date, note]);
  return { ok: true };
}

function getNote_(username, date) {
  const data = notesSheet_().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === date) {
      return { ok: true, note: data[i][2] };
    }
  }
  return { ok: true, note: '' };
}
