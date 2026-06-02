'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const Database = require('better-sqlite3');

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
`);

const MACHINE_FIELDS = ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges'];

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
  limits: { fileSize: 30 * 1024 * 1024, files: 40 }
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
  { name: 'images', maxCount: 30 },
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
  const imgs = db.prepare('SELECT filename FROM images WHERE machine_id = ?').all(id);
  const m = db.prepare('SELECT pdf_file FROM machines WHERE id = ?').get(id);
  db.prepare('DELETE FROM images WHERE machine_id = ?').run(id);
  db.prepare('DELETE FROM machines WHERE id = ?').run(id);
  // Dateien entfernen
  imgs.forEach(r => { try { fs.unlinkSync(path.join(UPLOAD_DIR, r.filename)); } catch (e) {} });
  if (m && m.pdf_file) { try { fs.unlinkSync(path.join(UPLOAD_DIR, m.pdf_file)); } catch (e) {} }
  res.json({ ok: true });
});

// ---------- Statische Frontend-Dateien ----------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('BvL Gebrauchtmaschinen laeuft auf Port ' + PORT);
  console.log('Datenverzeichnis: ' + DATA_DIR);
});
