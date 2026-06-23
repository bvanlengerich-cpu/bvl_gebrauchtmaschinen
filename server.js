'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const Database = require('better-sqlite3');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

// ---------- Konfiguration ----------
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'data.db');

// Passwoerter (in Coolify als Environment-Variablen setzen!)
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || 'ansehen';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
// Secret zum Signieren der Login-Cookies
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || process.env.APP_URL || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || '';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Datenbank ----------
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  typ TEXT DEFAULT '',
  art TEXT DEFAULT '',
  angebotsnummer TEXT DEFAULT '',
  baujahr TEXT DEFAULT '',
  betriebsstunden TEXT DEFAULT '',
  zustand TEXT DEFAULT '',
  listenpreis TEXT DEFAULT '',
  haendler_ep TEXT DEFAULT '',
  standort TEXT DEFAULT '',
  verfuegbarkeit TEXT DEFAULT '',
  sonstiges TEXT DEFAULT '',
  title_image TEXT DEFAULT '',
  pdf_file TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`);

const MACHINE_FIELDS = ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges'];
const incrementVisitCounter = db.transaction(() => {
  db.prepare("INSERT OR IGNORE INTO app_stats (key, value) VALUES ('visits', 0)").run();
  db.prepare("UPDATE app_stats SET value = value + 1 WHERE key = 'visits'").run();
  return db.prepare("SELECT value FROM app_stats WHERE key = 'visits'").get().value;
});

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value || ''));
}
function normalizeRecipients(value) {
  const seen = new Set();
  return String(value || '')
    .split(/[\n,;]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    .filter(v => {
      const key = v.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function getNotificationRecipients() {
  return normalizeRecipients(getSetting('notification_recipients'));
}
const DEFAULT_MAIL_TEMPLATES = {
  newSubject: 'Neue Maschine im Portal: {maschine}',
  newIntro: 'Im Gebrauchtmaschinenportal wurde eine neue Maschine hochgeladen:',
  soldSubject: 'Maschine verkauft: {maschine}',
  soldIntro: 'Die folgende Maschine wurde im Gebrauchtmaschinenportal als verkauft geloescht:'
};
function cleanTemplate(value, fallback, maxLength) {
  const text = String(value || '').trim() || fallback;
  return text.slice(0, maxLength);
}
function getMailTemplates() {
  return {
    newSubject: cleanTemplate(getSetting('notification_new_subject'), DEFAULT_MAIL_TEMPLATES.newSubject, 180),
    newIntro: cleanTemplate(getSetting('notification_new_intro'), DEFAULT_MAIL_TEMPLATES.newIntro, 1600),
    soldSubject: cleanTemplate(getSetting('notification_sold_subject'), DEFAULT_MAIL_TEMPLATES.soldSubject, 180),
    soldIntro: cleanTemplate(getSetting('notification_sold_intro'), DEFAULT_MAIL_TEMPLATES.soldIntro, 1600)
  };
}
function setMailTemplates(templates = {}) {
  setSetting('notification_new_subject', cleanTemplate(templates.newSubject, DEFAULT_MAIL_TEMPLATES.newSubject, 180));
  setSetting('notification_new_intro', cleanTemplate(templates.newIntro, DEFAULT_MAIL_TEMPLATES.newIntro, 1600));
  setSetting('notification_sold_subject', cleanTemplate(templates.soldSubject, DEFAULT_MAIL_TEMPLATES.soldSubject, 180));
  setSetting('notification_sold_intro', cleanTemplate(templates.soldIntro, DEFAULT_MAIL_TEMPLATES.soldIntro, 1600));
}
function applyMailTemplate(template, machine) {
  const values = {
    maschine: machine.typ || machine.angebotsnummer || 'Gebrauchtmaschine',
    typ: machine.typ || '',
    angebotsnummer: machine.angebotsnummer || '',
    baujahr: machine.baujahr || '',
    betriebsstunden: machine.betriebsstunden || '',
    zustand: machine.zustand || '',
    listenpreis: machine.listenpreis || '',
    haendler_ep: machine.haendler_ep || '',
    standort: machine.standort || '',
    verfuegbarkeit: machine.verfuegbarkeit || '',
    portal: publicUrl('/') || ''
  };
  return String(template || '').replace(/\{([a-z_]+)\}/gi, (match, key) => {
    const value = values[String(key).toLowerCase()];
    return value == null ? match : value;
  });
}
function smtpConfigured() {
  return Boolean(nodemailer && SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && MAIL_FROM);
}
function createMailer() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}
function publicUrl(pathname = '') {
  if (!PUBLIC_APP_URL) return '';
  return PUBLIC_APP_URL.replace(/\/+$/, '') + pathname;
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function machineMailRows(machine) {
  return [
    ['Maschine', machine.typ],
    ['Angebotsnummer', machine.angebotsnummer],
    ['Baujahr', machine.baujahr],
    ['Betriebsstunden', machine.betriebsstunden],
    ['Zustand', machine.zustand],
    ['Listenpreis', machine.listenpreis],
    ['Standort', machine.standort],
    ['Verfuegbarkeit', machine.verfuegbarkeit]
  ].filter(([, value]) => value);
}
function buildMachineMail(type, machine) {
  const isSold = type === 'sold';
  const templates = getMailTemplates();
  const subject = applyMailTemplate(isSold ? templates.soldSubject : templates.newSubject, machine);
  const intro = applyMailTemplate(isSold ? templates.soldIntro : templates.newIntro, machine);
  const rows = machineMailRows(machine);
  const appLink = publicUrl('/');
  const text = [
    intro,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    appLink ? `Portal: ${appLink}` : ''
  ].filter(line => line !== '').join('\n');
  const htmlRows = rows.map(([label, value]) =>
    `<tr><td style="padding:6px 12px;color:#37505f;font-weight:bold;border-bottom:1px solid #e3e9ec">${escapeHtml(label)}</td><td style="padding:6px 12px;border-bottom:1px solid #e3e9ec">${escapeHtml(value)}</td></tr>`
  ).join('');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2d36;background:#eef1f3;padding:20px">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e3e9ec;border-radius:12px;overflow:hidden">
      <div style="border-bottom:3px solid #597F97;padding:16px 18px">
        <div style="font-size:18px;font-weight:bold;color:#37505f">${escapeHtml(subject)}</div>
        <div style="font-size:13px;color:#6b7b85;margin-top:4px">BvL Gebrauchtmaschinen</div>
      </div>
      <div style="padding:18px">
        <p style="margin:0 0 14px">${escapeHtml(intro).replace(/\n/g, '<br>')}</p>
        <table style="width:100%;border-collapse:collapse;background:#f6f8f9;border:1px solid #e3e9ec;border-radius:10px;overflow:hidden">${htmlRows}</table>
        ${appLink ? `<p style="margin:18px 0 0"><a href="${escapeHtml(appLink)}" style="display:inline-block;background:#597F97;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:bold">Portal oeffnen</a></p>` : ''}
      </div>
    </div>
  </body></html>`;
  return { subject, text, html };
}
async function sendNotification(type, machine, recipientsOverride) {
  const recipients = recipientsOverride || getNotificationRecipients();
  if (!recipients.length) return { skipped: true, reason: 'Keine Empfaenger hinterlegt' };
  const mailer = createMailer();
  if (!mailer) return { skipped: true, reason: 'SMTP nicht konfiguriert' };
  const message = buildMachineMail(type, machine);
  await mailer.sendMail({
    from: MAIL_FROM,
    to: recipients.join(', '),
    subject: message.subject,
    text: message.text,
    html: message.html
  });
  return { ok: true, count: recipients.length };
}
function sendNotificationInBackground(type, machine) {
  sendNotification(type, machine).catch(err => {
    console.error('Benachrichtigungs-Mail fehlgeschlagen', err);
  });
}

// ---------- Auth-Helfer ----------
function makeToken(role) {
  const payload = role + '.' + Date.now();
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return payload + '.' + sig;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [role, ts, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(role + '.' + ts).digest('hex');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (role !== 'admin' && role !== 'viewer') return null;
  return role;
}
function currentRole(req) {
  return verifyToken(req.cookies && req.cookies.bvl_auth);
}
function requireAuth(req, res, next) {
  const role = currentRole(req);
  if (!role) return res.status(401).json({ error: 'Nicht angemeldet' });
  req.role = role;
  next();
}
function requireAdmin(req, res, next) {
  const role = currentRole(req);
  if (role !== 'admin') return res.status(403).json({ error: 'Nur Admins duerfen aendern' });
  req.role = role;
  next();
}

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(cookieParser());

// Upload-Handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024, files: 60 }
});

// ---------- Auth-Routen ----------
app.post('/api/login', (req, res) => {
  const pw = (req.body && req.body.password) || '';
  let role = null;
  if (pw && pw === ADMIN_PASSWORD) role = 'admin';
  else if (pw && pw === VIEWER_PASSWORD) role = 'viewer';
  if (!role) return res.status(401).json({ error: 'Falsches Passwort' });
  res.cookie('bvl_auth', makeToken(role), {
    httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30
  });
  res.json({ role });
});
app.post('/api/logout', (req, res) => {
  res.clearCookie('bvl_auth');
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  res.json({ role: currentRole(req) });
});

// ---------- Besucherzaehler ----------
app.post('/api/visit', requireAuth, (req, res) => {
  try {
    res.json({ count: incrementVisitCounter() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Besucherzaehler konnte nicht aktualisiert werden' });
  }
});

// ---------- Benachrichtigungen ----------
app.get('/api/notification-settings', requireAdmin, (req, res) => {
  const recipients = getNotificationRecipients();
  const templates = getMailTemplates();
  res.json({
    recipients: recipients.join('\n'),
    templates,
    smtpConfigured: smtpConfigured(),
    mailFrom: MAIL_FROM || ''
  });
});

app.put('/api/notification-settings', requireAdmin, (req, res) => {
  const recipients = normalizeRecipients(req.body && req.body.recipients);
  setMailTemplates(req.body && req.body.templates);
  setSetting('notification_recipients', recipients.join('\n'));
  res.json({
    ok: true,
    recipients: recipients.join('\n'),
    templates: getMailTemplates(),
    count: recipients.length,
    smtpConfigured: smtpConfigured()
  });
});

app.post('/api/notification-settings/test', requireAdmin, async (req, res) => {
  try {
    const recipients = getNotificationRecipients();
    if (!recipients.length) return res.status(400).json({ error: 'Keine Empfaenger hinterlegt' });
    if (!smtpConfigured()) return res.status(400).json({ error: 'SMTP ist noch nicht konfiguriert' });
    await sendNotification('new', {
      typ: 'Testmaschine',
      angebotsnummer: 'TEST',
      zustand: 'Gut',
      standort: 'BvL Emsbueren',
      verfuegbarkeit: 'Sofort'
    }, recipients);
    res.json({ ok: true, count: recipients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Test-E-Mail konnte nicht gesendet werden' });
  }
});

// ---------- Maschinen lesen ----------
app.get('/api/machines', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM machines ORDER BY id DESC').all();
  const imgStmt = db.prepare('SELECT filename FROM images WHERE machine_id = ? ORDER BY sort, id');
  const result = rows.map(m => ({
    ...m,
    images: imgStmt.all(m.id).map(r => r.filename)
  }));
  res.json(result);
});

// Geschuetzte Datei-Auslieferung (Bilder/PDF nur fuer Angemeldete)
app.get('/uploads/:file', requireAuth, (req, res) => {
  const safe = path.basename(req.params.file);
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

// ---------- Maschine anlegen (nur Admin) ----------
const uploadFields = upload.fields([
  { name: 'images', maxCount: 50 },
  { name: 'pdf', maxCount: 1 }
]);

app.post('/api/machines', requireAdmin, uploadFields, (req, res) => {
  try {
    const b = req.body || {};
    const values = {};
    MACHINE_FIELDS.forEach(k => { values[k] = (b[k] || '').toString().trim(); });

    const imgFiles = (req.files && req.files.images) || [];
    const pdfFiles = (req.files && req.files.pdf) || [];
    const pdfFile = pdfFiles.length ? pdfFiles[0].filename : '';

    // Titelbild: ueber Index aus dem Formular oder erstes Bild
    let titleIndex = parseInt(b.titleIndex, 10);
    if (isNaN(titleIndex) || titleIndex < 0 || titleIndex >= imgFiles.length) titleIndex = 0;
    const titleImage = imgFiles.length ? imgFiles[titleIndex].filename : '';

    const info = db.prepare(`INSERT INTO machines
      (typ,art,angebotsnummer,baujahr,betriebsstunden,zustand,listenpreis,haendler_ep,standort,verfuegbarkeit,sonstiges,title_image,pdf_file,created_at)
      VALUES (@typ,@art,@angebotsnummer,@baujahr,@betriebsstunden,@zustand,@listenpreis,@haendler_ep,@standort,@verfuegbarkeit,@sonstiges,@title_image,@pdf_file,@created_at)`)
      .run({ ...values, title_image: titleImage, pdf_file: pdfFile, created_at: new Date().toISOString() });

    const machineId = info.lastInsertRowid;
    const insImg = db.prepare('INSERT INTO images (machine_id, filename, sort) VALUES (?,?,?)');
    imgFiles.forEach((f, i) => insImg.run(machineId, f.filename, i));

    sendNotificationInBackground('new', {
      id: machineId,
      ...values,
      title_image: titleImage,
      pdf_file: pdfFile
    });

    res.json({ ok: true, id: machineId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ---------- Maschine bearbeiten (nur Admin, Textfelder) ----------
app.put('/api/machines/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const exists = db.prepare('SELECT id FROM machines WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Nicht gefunden' });
  const b = req.body || {};
  const values = {};
  MACHINE_FIELDS.forEach(k => { values[k] = (b[k] || '').toString().trim(); });
  db.prepare(`UPDATE machines SET
    typ=@typ, art=@art, angebotsnummer=@angebotsnummer, baujahr=@baujahr, betriebsstunden=@betriebsstunden,
    zustand=@zustand, listenpreis=@listenpreis, haendler_ep=@haendler_ep, standort=@standort,
    verfuegbarkeit=@verfuegbarkeit, sonstiges=@sonstiges WHERE id=@id`).run({ ...values, id });
  res.json({ ok: true });
});

// ---------- Maschine loeschen (nur Admin) ----------
app.delete('/api/machines/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(id);
  if (!machine) return res.status(404).json({ error: 'Nicht gefunden' });
  const notifySold = req.query.notifySold === '1' || (req.body && req.body.notifySold === true);
  const imgs = db.prepare('SELECT filename FROM images WHERE machine_id = ?').all(id);
  db.prepare('DELETE FROM images WHERE machine_id = ?').run(id);
  db.prepare('DELETE FROM machines WHERE id = ?').run(id);
  // Dateien entfernen
  imgs.forEach(r => { try { fs.unlinkSync(path.join(UPLOAD_DIR, r.filename)); } catch (e) {} });
  if (machine.pdf_file) { try { fs.unlinkSync(path.join(UPLOAD_DIR, machine.pdf_file)); } catch (e) {} }
  if (notifySold) sendNotificationInBackground('sold', machine);
  res.json({ ok: true });
});

// ---------- Statische Frontend-Dateien ----------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('BvL Gebrauchtmaschinen laeuft auf Port ' + PORT);
  console.log('Datenverzeichnis: ' + DATA_DIR);
});
