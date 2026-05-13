/**
 * Google Apps Script backend for Wadfun Finance
 *
 * Setup
 *   1. Open the Google Sheet bound to this script.
 *   2. Ensure the sheet named "Entries" has this header row (A1:K1, in this exact order):
 *        A: id
 *        B: date
 *        C: type
 *        D: category
 *        E: project
 *        F: description
 *        G: amount
 *        H: vat
 *        I: wht
 *        J: vatType
 *        K: whtType
 *   3. Ensure a sheet named "Projects" exists with header A1 = "name".
 *   4. Deploy → New deployment → Web app → execute as Me, access Anyone.
 *      Copy the /exec URL into the API constant in src/App.tsx.
 *
 * Backfill for existing rows: leave H..K blank — the frontend treats blanks as 0/undefined
 * and will start populating values as new entries are saved/edited.
 */

const ENTRY_SHEET = "Entries";
const PROJECT_SHEET = "Projects";
const ENTRY_COLS = 11; // A..K

function _entrySheet()   { return SpreadsheetApp.getActive().getSheetByName(ENTRY_SHEET); }
function _projectSheet() { return SpreadsheetApp.getActive().getSheetByName(PROJECT_SHEET); }

function _json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _rowToEntry(r) {
  return {
    id: r[0],
    date: r[1] instanceof Date ? Utilities.formatDate(r[1], Session.getScriptTimeZone(), "yyyy-MM-dd") : String(r[1] || ""),
    type: r[2],
    category: r[3],
    project: r[4],
    description: r[5],
    amount: Number(r[6]) || 0,
    vat: Number(r[7]) || 0,
    wht: Number(r[8]) || 0,
    vatType: r[9] || "",
    whtType: r[10] || "",
  };
}

function _entryToRow(body, id) {
  return [
    id,
    body.date || "",
    body.type || "",
    body.category || "",
    body.project || "",
    body.description || "",
    Number(body.amount) || 0,
    Number(body.vat) || 0,
    Number(body.wht) || 0,
    body.vatType || "",
    body.whtType || "",
  ];
}

function getAll() {
  const sheet = _entrySheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, entries: [] };
  const data = sheet.getRange(2, 1, last - 1, ENTRY_COLS).getValues();
  const entries = data.filter(r => r[0] !== "" && r[0] !== null).map(_rowToEntry);
  return { ok: true, entries };
}

function addEntry(body) {
  const sheet = _entrySheet();
  const id = body.id || Date.now();
  sheet.appendRow(_entryToRow(body, id));
  return { ok: true, id };
}

function updateEntry(body) {
  const sheet = _entrySheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false, error: "no rows" };
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(body.id)) {
      sheet.getRange(i + 2, 1, 1, ENTRY_COLS).setValues([_entryToRow(body, body.id)]);
      return { ok: true };
    }
  }
  return { ok: false, error: "not found" };
}

function deleteEntry(id) {
  const sheet = _entrySheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false };
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false };
}

function getProjects() {
  const sheet = _projectSheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, projects: [] };
  const data = sheet.getRange(2, 1, last - 1, 1).getValues();
  const projects = data.map(r => String(r[0] || "").trim()).filter(Boolean);
  return { ok: true, projects };
}

function addProject(name) {
  const sheet = _projectSheet();
  sheet.appendRow([String(name || "").trim()]);
  return { ok: true };
}

function deleteProject(name) {
  const sheet = _projectSheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false };
  const data = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(name).trim()) {
      sheet.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false };
}

/**
 * Send a one-time PIN-change confirmation code to the configured email.
 * Body: { code: "123456", email: "a.athiwat29@gmail.com", ts: "ISO8601" }
 * The frontend generates the code; the server only relays it via MailApp.
 */
function notifyPinChange(body) {
  if (!body || !body.code) return { ok: false, error: "missing code" };
  const to = body.email || "a.athiwat29@gmail.com";
  const code = String(body.code);
  if (!/^\d{4,8}$/.test(code)) return { ok: false, error: "invalid code format" };
  const when = body.ts ? new Date(body.ts) : new Date();
  const whenStr = Utilities.formatDate(when, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  const subject = "Wadfun Finance - PIN Change Confirmation Code";
  const text =
    "Wadfun Finance — PIN Change Confirmation\n\n" +
    "Your confirmation code: " + code + "\n\n" +
    "This code expires in 5 minutes.\n" +
    "Requested at (Asia/Bangkok): " + whenStr + "\n\n" +
    "If you did not request this change, ignore this email and consider changing your PIN.\n";
  try {
    MailApp.sendEmail({ to: to, subject: subject, body: text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function _route(action, params, body) {
  switch (action) {
    case "getAll":           return getAll();
    case "getProjects":      return getProjects();
    case "addEntry":         return addEntry(body || {});
    case "updateEntry":      return updateEntry(body || {});
    case "deleteEntry":      return deleteEntry(params.id);
    case "addProject":       return addProject(params.name);
    case "deleteProject":    return deleteProject(params.name);
    case "notifyPinChange":  return notifyPinChange(body || {});
    default:                 return { ok: false, error: "unknown action: " + action };
  }
}

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || "";
  return _json(_route(action, e.parameter || {}, null));
}

function doPost(e) {
  const action = (e.parameter && e.parameter.action) || "";
  let body = null;
  try { body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null; }
  catch (err) { return _json({ ok: false, error: "invalid JSON" }); }
  return _json(_route(action, e.parameter || {}, body));
}
