'use strict';

let ROLE = null;
let MACHINES = [];
let LANG = localStorage.getItem('bvl_language') || 'de';
let DEALER_PRICE_VISIBLE = false;

const FIELDS = [
  ['angebotsnummer','Angebotsnummer'],
  ['baujahr','Baujahr'],
  ['betriebsstunden','Betriebsstunden'],
  ['art','Art'],
  ['zustand','Zustand'],
  ['listenpreis','Listenpreis'],
  ['haendler_ep','Händler EP'],
  ['standort','Standort'],
  ['verfuegbarkeit','Verfügbarkeit'],
  ['sonstiges','Sonstiges']
];

const FIELD_KEYS = ['angebotsnummer','baujahr','betriebsstunden','art','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges'];

const FIELD_LABELS = {
  de: {
    angebotsnummer:'Angebotsnummer',
    baujahr:'Baujahr',
    betriebsstunden:'Betriebsstunden',
    art:'Art',
    zustand:'Zustand',
    listenpreis:'Listenpreis',
    haendler_ep:'H\u00e4ndler EP',
    standort:'Standort',
    verfuegbarkeit:'Verf\u00fcgbarkeit',
    sonstiges:'Sonstiges'
  },
  en: {
    angebotsnummer:'Offer number',
    baujahr:'Year',
    betriebsstunden:'Operating hours',
    art:'Type',
    zustand:'Condition',
    listenpreis:'List price',
    haendler_ep:'Dealer net price',
    standort:'Location',
    verfuegbarkeit:'Availability',
    sonstiges:'Miscellaneous'
  }
};

const I18N = {
  de: {
    appTitle:'Gebrauchtmaschinen',
    loginPrompt:'Bitte Passwort eingeben',
    passwordPlaceholder:'Passwort',
    loginButton:'Anmelden',
    wrongPassword:'Falsches Passwort',
    loginFailed:'Login fehlgeschlagen. Bitte erneut versuchen.',
    adminRole:'Admin',
    viewerRole:'Betrachter',
    logout:'Abmelden',
    languageLabel:'Sprache',
    administration:'Administration',
    adminHint:'W\u00e4hlen Sie einen Ordner mit den Maschinen-Unterordnern (je Maschine: Excel, PDF-Angebot und Fotos). Name, Angebotsnummer und Daten werden automatisch ausgelesen. Mehrere Maschinen auf einmal m\u00f6glich.',
    uploadFolder:'Maschinen-Ordner hochladen',
    addManual:'Einzeln manuell hinzuf\u00fcgen',
    machineSingular:'Maschine',
    machinePlural:'Maschinen',
    emptyState:'Noch keine Maschinen vorhanden.',
    noImage:'Kein Bild',
    untitled:'Ohne Titel',
    edit:'Bearbeiten',
    delete:'L\u00f6schen',
    deleteConfirm:'Diese Maschine wirklich l\u00f6schen?',
    deleteFailed:'L\u00f6schen fehlgeschlagen',
    viewPdf:'Angebot ansehen',
    createExpose:'Expos\u00e9 erstellen',
    creatingExpose:'Erstelle...',
    exposeFailed:'Expos\u00e9 konnte nicht erstellt werden.',
    pdfLibMissing:'PDF-Bibliothek konnte nicht geladen werden.',
    newMachine:'Neue Maschine',
    editMachine:'Maschine bearbeiten',
    save:'Speichern',
    cancel:'Abbrechen',
    saving:'Speichern...',
    formError:'Fehler: ',
    formTyp:'Maschinenname / Typ',
    formArt:'Art / Kategorie',
    formArtPlaceholder:'z. B. Futtermischwagen',
    formImages:'Bilder (Mehrfachauswahl m\u00f6glich)',
    formPdf:'PDF (optional, z. B. Angebot)',
    titleImage:'Titelbild',
    overview:'Maschinen\u00fcbersicht',
    photos:'Fotos',
    notSpecified:'nicht angegeben',
    exposeInfo:'Gebrauchtmaschine',
    showDealerPrices:'H\u00e4ndlerpreise anzeigen',
    hideDealerPrices:'H\u00e4ndlerpreise ausblenden',
    priceFootnote:'* Preise verstehen sich netto, zzgl. gesetzlicher MwSt. sowie Fracht- und Transportkosten.',
    visitorCounter:'Besucher'
  },
  en: {
    appTitle:'Used machines',
    loginPrompt:'Please enter password',
    passwordPlaceholder:'Password',
    loginButton:'Log in',
    wrongPassword:'Wrong password',
    loginFailed:'Login failed. Please try again.',
    adminRole:'Admin',
    viewerRole:'Viewer',
    logout:'Log out',
    languageLabel:'Language',
    administration:'Administration',
    adminHint:'Select a folder with machine subfolders. The tool automatically reads Excel files, PDF offers and photos. Multiple machines can be imported at once.',
    uploadFolder:'Upload machine folder',
    addManual:'Add manually',
    machineSingular:'machine',
    machinePlural:'machines',
    emptyState:'No machines available yet.',
    noImage:'No image',
    untitled:'Untitled',
    edit:'Edit',
    delete:'Delete',
    deleteConfirm:'Really delete this machine?',
    deleteFailed:'Delete failed',
    viewPdf:'Show offer',
    createExpose:'Create expos\u00e9',
    creatingExpose:'Creating...',
    exposeFailed:'Expos\u00e9 could not be created.',
    pdfLibMissing:'PDF library could not be loaded.',
    newMachine:'New machine',
    editMachine:'Edit machine',
    save:'Save',
    cancel:'Cancel',
    saving:'Saving...',
    formError:'Error: ',
    formTyp:'Machine name / type',
    formArt:'Type / category',
    formArtPlaceholder:'e.g. mixer wagon',
    formImages:'Images (multiple selection possible)',
    formPdf:'PDF (optional, e.g. offer)',
    titleImage:'Title image',
    overview:'Machine overview',
    photos:'Photos',
    notSpecified:'not specified',
    exposeInfo:'Used machine',
    showDealerPrices:'Show dealer prices',
    hideDealerPrices:'Hide dealer prices',
    priceFootnote:'* Prices are net prices, excluding VAT and freight/transport costs.',
    visitorCounter:'Visitors'
  }
};

const ART_TRANSLATIONS = {
  'Gebrauchtmaschine': {de:'Gebrauchtmaschine', en:'Used machine'},
  'Demomaschine': {de:'Demomaschine', en:'Demo machine'},
  'Neumaschine': {de:'Neumaschine', en:'New machine'},
  'Sonstiges': {de:'Sonstiges', en:'Other'}
};

const CONDITION_TRANSLATIONS_EN = {
  'neu':'New',
  'neuwertig':'As new',
  'sehr gut':'Very good',
  'gut':'Good',
  'mittel':'Fair',
  'maessig':'Fair',
  'mittelmaessig':'Fair',
  'schlecht':'Poor',
  'schlechter zustand':'Poor condition',
  'gebraucht':'Used',
  'normal gebraucht':'Normal used condition',
  'einsatzbereit':'Ready for use',
  'funktionstuechtig':'Functional',
  'reparaturbeduerftig':'Needs repair',
  'ueberholungsbeduerftig':'Needs overhaul',
  'nicht einsatzbereit':'Not ready for use',
  'nicht funktionstuechtig':'Not functional',
  'nicht funktionsfaehig':'Not functional',
  'bastlerfahrzeug':'For repair/spares',
  'ersatzteiltraeger':'For spares',
  'defekt':'Defective'
};

const AVAILABILITY_TRANSLATIONS_EN = {
  'sofort':'Available now',
  'ab sofort':'Available now',
  'per sofort':'Available now',
  'sofort verfuegbar':'Available now',
  'verfuegbar':'Available',
  'lagernd':'In stock',
  'now':'Available now',
  'kurzfristig':'Available at short notice',
  'in kuerze':'Available soon',
  'auf anfrage':'On request',
  'nach absprache':'By arrangement',
  'nach vereinbarung':'By arrangement'
};

const $ = id => document.getElementById(id);
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizeFreeText(value){
  return String(value || '').trim().toLowerCase()
    .replace(/Ã¤/g,'ae').replace(/Ã¶/g,'oe').replace(/Ã¼/g,'ue').replace(/ÃŸ/g,'ss')
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^\w.,/-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function translateDurationToEnglish(value){
  const raw = String(value || '').trim();
  let text = normalizeFreeText(raw).replace(/,/g,'.');
  const approx = /^(ca\.?|circa|ungefaehr|etwa)\b/.test(text);
  text = text.replace(/^(ca\.?|circa|ungefaehr|etwa)\s*/, '').trim();
  const m = text.match(/^(\d+(?:\.\d+)?)(?:\s*(?:-|bis|\/)\s*(\d+(?:\.\d+)?))?\s*(tag|tage|woche|wochen|kw|monat|monate)$/);
  if(!m) return '';
  const number = m[2] ? `${m[1]}-${m[2]}` : m[1];
  let unit = 'weeks';
  if(m[3] === 'tag' || m[3] === 'tage') unit = m[1] === '1' && !m[2] ? 'day' : 'days';
  if(m[3] === 'woche' || m[3] === 'wochen' || m[3] === 'kw') unit = m[1] === '1' && !m[2] ? 'week' : 'weeks';
  if(m[3] === 'monat' || m[3] === 'monate') unit = m[1] === '1' && !m[2] ? 'month' : 'months';
  return `${approx ? 'approx. ' : ''}${number} ${unit}`;
}
function translateCondition(value){
  if(LANG !== 'en' || !value) return value;
  return CONDITION_TRANSLATIONS_EN[normalizeFreeText(value)] || String(value).trim();
}
function translateAvailability(value){
  if(LANG !== 'en' || !value) return value;
  const normalized = normalizeFreeText(value);
  return AVAILABILITY_TRANSLATIONS_EN[normalized] || translateDurationToEnglish(value) || String(value).trim();
}
function parseMoneyNumber(value){
  const text = String(value || '').replace(/[^\d.,-]/g, '').trim();
  if(!text || !/^-?[\d.,]+$/.test(text)) return null;
  let normalized = text;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if(comma !== -1 && dot !== -1){
    normalized = comma > dot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  }else if(comma !== -1){
    normalized = /^\d{1,3}(,\d{3})+$/.test(normalized)
      ? normalized.replace(/,/g, '')
      : normalized.replace(',', '.');
  }else if(dot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(normalized)){
    normalized = normalized.replace(/\./g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function eur(label, v){
  if(!v) return v;
  const text = String(v).trim();
  if(/preis|price|ep/i.test(label)){
    const n = parseMoneyNumber(text);
    const locale = LANG === 'en' ? 'en-US' : 'de-DE';
    if(n !== null) return n.toLocaleString(locale,{style:'currency',currency:'EUR',maximumFractionDigits:0});
  }
  return text;
}
function formatVisitCount(value){
  const n = Number(value);
  if(!Number.isFinite(n) || n < 0) return '00000';
  return String(Math.floor(n)).padStart(5, '0');
}
function setVisitorCount(value){
  const el = $('visitorCount');
  if(el) el.textContent = formatVisitCount(value);
}

function t(key){ return (I18N[LANG] && I18N[LANG][key]) || key; }
function fieldLabel(key){ return (FIELD_LABELS[LANG] && FIELD_LABELS[LANG][key]) || key; }
function artLabel(value){
  const v = String(value || '').trim();
  return (ART_TRANSLATIONS[v] && ART_TRANSLATIONS[v][LANG]) || v || t('notSpecified');
}
function formatFieldValue(key, value){
  if(!value) return value;
  if(key === 'art') return artLabel(value);
  if(key === 'zustand') return translateCondition(value);
  if(key === 'verfuegbarkeit') return translateAvailability(value);
  if(key === 'haendler_ep' && !DEALER_PRICE_VISIBLE) return '********';
  return eur(fieldLabel(key), value);
}
function setText(id, value){ const el = $(id); if(el) el.textContent = value; }
function setFieldLabel(name, value){
  const field = document.querySelector(`[name="${name}"]`);
  const container = field && field.closest('.field');
  const label = container && container.querySelector('label');
  if(label) label.textContent = value;
}
function updateRoleChip(){
  const chip = $('roleChip');
  if(!chip) return;
  if(ROLE === 'admin'){ chip.textContent = t('adminRole'); chip.classList.add('admin'); }
  else { chip.textContent = t('viewerRole'); chip.classList.remove('admin'); }
}
function updateDealerPriceToggle(){
  const btn = $('dealerPriceToggle');
  const text = $('dealerPriceToggleText');
  if(!btn) return;
  const label = DEALER_PRICE_VISIBLE ? t('hideDealerPrices') : t('showDealerPrices');
  btn.classList.toggle('price-visible', DEALER_PRICE_VISIBLE);
  btn.setAttribute('aria-pressed', DEALER_PRICE_VISIBLE ? 'true' : 'false');
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  if(text) text.textContent = label;
}
function updateStaticText(){
  document.documentElement.lang = LANG === 'en' ? 'en' : 'de';
  const loginTitle = document.querySelector('.login-box h1');
  if(loginTitle) loginTitle.textContent = t('appTitle');
  const loginPrompt = document.querySelector('.login-box p');
  if(loginPrompt) loginPrompt.textContent = t('loginPrompt');
  if($('pwInput')) $('pwInput').placeholder = t('passwordPlaceholder');
  setText('loginBtn', t('loginButton'));
  const topTitle = document.querySelector('.titles h1');
  if(topTitle) topTitle.textContent = t('appTitle');
  setText('languageLabel', t('languageLabel'));
  if($('languageSelect')) $('languageSelect').value = LANG;
  setText('logoutBtn', t('logout'));
  setText('visitorLabel', t('visitorCounter'));
  const adminTitle = document.querySelector('#adminBar h2');
  if(adminTitle) adminTitle.textContent = t('administration');
  const adminHint = document.querySelector('#adminBar .hint');
  if(adminHint) adminHint.textContent = t('adminHint');
  setText('folderBtn', t('uploadFolder'));
  setText('addBtn', t('addManual'));
  setText('emptyState', t('emptyState'));
  setText('cancelBtn', t('cancel'));
  setText('saveBtn', t('save'));
  setFieldLabel('typ', t('formTyp'));
  setFieldLabel('art', t('formArt'));
  const artInput = document.querySelector('[name="art"]');
  if(artInput) artInput.placeholder = t('formArtPlaceholder');
  setFieldLabel('angebotsnummer', fieldLabel('angebotsnummer'));
  setFieldLabel('baujahr', fieldLabel('baujahr'));
  setFieldLabel('betriebsstunden', fieldLabel('betriebsstunden'));
  setFieldLabel('zustand', fieldLabel('zustand'));
  setFieldLabel('listenpreis', fieldLabel('listenpreis'));
  setFieldLabel('haendler_ep', LANG === 'en' ? fieldLabel('haendler_ep') + ' (internal)' : fieldLabel('haendler_ep') + ' (intern)');
  setFieldLabel('standort', fieldLabel('standort'));
  setFieldLabel('verfuegbarkeit', fieldLabel('verfuegbarkeit'));
  setFieldLabel('sonstiges', fieldLabel('sonstiges'));
  const imageLabel = $('imageField') && $('imageField').querySelector('label');
  if(imageLabel) imageLabel.textContent = t('formImages');
  const pdfLabel = $('pdfField') && $('pdfField').querySelector('label');
  if(pdfLabel) pdfLabel.textContent = t('formPdf');
  updateRoleChip();
  updateDealerPriceToggle();
}
function applyLanguage(){
  localStorage.setItem('bvl_language', LANG);
  updateStaticText();
  render();
}

// ---------- Login ----------
async function tryLogin(){
  const pw = $('pwInput').value;
  $('loginError').textContent = '';
  $('loginBtn').disabled = true;
  try{
    const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: pw})});
    if(!r.ok){ $('loginError').textContent = t('wrongPassword'); return; }
    const data = await r.json();
    ROLE = data.role;
    startApp();
  }catch(err){
    console.error('Login fehlgeschlagen', err);
    $('loginError').textContent = t('loginFailed');
  }finally{
    $('loginBtn').disabled = false;
  }
}

function startApp(){
  DEALER_PRICE_VISIBLE = false;
  $('loginOverlay').classList.add('hidden');
  $('app').classList.remove('hidden');
  updateStaticText();
  if(ROLE === 'admin'){ $('adminBar').classList.remove('hidden'); }
  else { $('adminBar').classList.add('hidden'); }
  recordVisit();
  loadMachines();
}

async function recordVisit(){
  try{
    const r = await fetch('/api/visit', {method:'POST'});
    if(!r.ok) return;
    const data = await r.json();
    setVisitorCount(data.count);
  }catch(err){
    console.warn('Besucherzaehler konnte nicht aktualisiert werden', err);
  }
}

async function loadMachines(){
  const r = await fetch('/api/machines');
  if(!r.ok){ return; }
  MACHINES = await r.json();
  render();
}

// ---------- Rendering ----------
function render(){
  const grid = $('grid');
  $('counter').textContent = MACHINES.length + ' ' + (MACHINES.length === 1 ? t('machineSingular') : t('machinePlural'));
  if(!MACHINES.length){ grid.innerHTML=''; $('emptyState').classList.remove('hidden'); return; }
  $('emptyState').classList.add('hidden');
  grid.innerHTML = MACHINES.map(cardHtml).join('');
}

function cardHtml(m){
  const hero = m.title_image
    ? `<img class="hero" src="/uploads/${esc(m.title_image)}" onclick="openLightbox(${m.id},0)">`
    : `<div class="hero placeholder">${esc(t('noImage'))}</div>`;
  const badge = m.art ? `<span class="badge">${esc(artLabel(m.art))}</span>` : '';
  const rows = FIELD_KEYS.map(k=>{
    const label = fieldLabel(k) + (k === 'listenpreis' ? '*' : '');
    const val = formatFieldValue(k, m[k]);
    const disp = val ? esc(val) : `<span class="empty">&ndash;</span>`;
    return `<div class="row"><strong>${label}</strong><span>${disp}</span></div>`;
  }).join('');
  const gallery = (m.images||[]).map((img,i)=>`<img src="/uploads/${esc(img)}" onclick="openLightbox(${m.id},${i})">`).join('');
  const pdf = m.pdf_file ? `<a class="pdflink" href="/uploads/${esc(m.pdf_file)}" target="_blank">${esc(t('viewPdf'))}</a>` : '';
  const expose = `<button class="btn" onclick="downloadExpose(${m.id}, this)">${esc(t('createExpose'))}</button>`;
  let actions = '';
  if(ROLE === 'admin'){
    actions = `<button class="btn ghost" onclick="editMachine(${m.id})">${esc(t('edit'))}</button>
               <button class="btn accent" onclick="deleteMachine(${m.id})">Löschen</button>`;
  }
  if(ROLE === 'admin'){
    actions = `<button class="btn ghost" onclick="editMachine(${m.id})">${esc(t('edit'))}</button>
               <button class="btn accent" onclick="deleteMachine(${m.id})">${esc(t('delete'))}</button>`;
  }
  return `<div class="card">
    <div class="heroWrap">${hero}${badge}</div>
    <div class="content">
      <h3 class="mtitle">${esc(m.typ)||esc(t('untitled'))}</h3>
      <div class="rows">${rows}</div>
      ${m.listenpreis ? `<div class="price-note">${esc(t('priceFootnote'))}</div>` : ''}
      ${gallery ? `<div class="gallery">${gallery}</div>` : ''}
      <div class="cardactions">${actions}${expose}${pdf}</div>
    </div>
  </div>`;
}

// ---------- Lightbox ----------
let lbImages = [], lbIndex = 0, lbEl = null;
function openLightbox(machineId, index){
  const m = MACHINES.find(x=>x.id===machineId);
  if(!m) return;
  lbImages = (m.images && m.images.length) ? m.images.slice() : (m.title_image ? [m.title_image] : []);
  if(!lbImages.length) return;
  lbIndex = index || 0;
  if(!lbEl){
    lbEl = document.createElement('div');
    lbEl.className = 'lightbox';
    lbEl.innerHTML = `<button class="lb-close" onclick="closeLightbox()">&times;</button>
      <button class="lb-btn lb-prev" onclick="lbMove(-1)">&#8249;</button>
      <img id="lbImg">
      <button class="lb-btn lb-next" onclick="lbMove(1)">&#8250;</button>`;
    lbEl.addEventListener('click', e=>{ if(e.target===lbEl) closeLightbox(); });
    document.body.appendChild(lbEl);
  }
  lbEl.style.display='flex';
  lbShow();
}
function lbShow(){ $('lbImg').src = '/uploads/' + lbImages[lbIndex]; }
function lbMove(d){ lbIndex = (lbIndex + d + lbImages.length) % lbImages.length; lbShow(); }
function closeLightbox(){ if(lbEl) lbEl.style.display='none'; }
document.addEventListener('keydown', e=>{
  if(lbEl && lbEl.style.display==='flex'){
    if(e.key==='Escape') closeLightbox();
    if(e.key==='ArrowLeft') lbMove(-1);
    if(e.key==='ArrowRight') lbMove(1);
  }
});

// ---------- Expose-PDF ----------
function uploadUrl(filename){ return '/uploads/' + encodeURIComponent(filename); }
function fileSafeName(value){
  return String(value || 'Expose')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 90);
}
function blobToDataUrl(blob){
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}
function imageDataUrlToPdfImage(dataUrl){
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = () => {
      const maxSide = 1600;
      const width = img.naturalWidth || img.width || 1;
      const height = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), width: canvas.width, height: canvas.height });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
function svgToPngDataUrl(svgText, width, height){
  return new Promise(resolve=>{
    const blob = new Blob([svgText], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}
async function loadBvlLogoForPdf(){
  try{
    const r = await fetch('/logo-bvl.svg');
    if(!r.ok) return '';
    return await svgToPngDataUrl(await r.text(), 545, 427);
  }catch(err){
    console.warn('BvL-Logo konnte nicht geladen werden', err);
    return '';
  }
}
async function fetchImageForPdf(filename){
  try{
    const r = await fetch(uploadUrl(filename));
    if(!r.ok) return null;
    const dataUrl = await blobToDataUrl(await r.blob());
    if(!dataUrl) return null;
    return await imageDataUrlToPdfImage(dataUrl);
  }catch(err){
    console.warn('Bild konnte nicht ins Expose geladen werden', filename, err);
    return null;
  }
}

async function downloadExpose(machineId, button){
  const machine = MACHINES.find(x=>x.id===machineId);
  if(!machine) return;
  if(!window.jspdf || !window.jspdf.jsPDF){
    alert(t('pdfLibMissing'));
    return;
  }

  const originalText = button ? button.textContent : '';
  if(button){ button.disabled = true; button.textContent = t('creatingExpose'); }

  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
    const bvlLogoDataUrl = await loadBvlLogoForPdf();
    const margin = 16;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const bvl = [89, 127, 151];
    const bvlDark = [55, 80, 95];
    const accent = [164, 11, 30];
    const lightBg = [246, 248, 249];
    const lineGrey = [220, 228, 232];
    const textGrey = [95, 110, 118];
    let pageNo = 1;
    let y = 0;

    function safeText(value){ return String(value || t('notSpecified')); }
    function addHeader(){
      doc.setFillColor(255,255,255);
      doc.rect(0, 0, pageW, 46, 'F');
      if(bvlLogoDataUrl){
        doc.addImage(bvlLogoDataUrl, 'PNG', margin, 7, 22, 17.2);
      }else{
        doc.setTextColor(...bvlDark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(19);
        doc.text('BvL', margin, 18);
      }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...bvlDark);
      doc.text('Bernard van Lengerich Maschinenfabrik GmbH & Co. KG', margin + 28, 16);
      doc.text('Grenzstrasse 16 - 48488 Emsbueren - Germany', margin + 28, 21);
      doc.setDrawColor(...bvl);
      doc.setLineWidth(0.6);
      doc.line(margin, 43, pageW - margin, 43);
      doc.setDrawColor(...accent);
      doc.setLineWidth(1.1);
      doc.line(pageW - margin - 32, 43, pageW - margin, 43);

      doc.setDrawColor(...bvl);
      doc.setLineWidth(0.35);
      doc.rect(pageW - margin - 66, 13, 66, 20);
      doc.setTextColor(35, 45, 52);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Expose:', pageW - margin - 62, 21);
      doc.text(t('exposeInfo'), pageW - margin - 35, 21);
      doc.text(fieldLabel('angebotsnummer') + ':', pageW - margin - 62, 28);
      doc.text(safeText(machine.angebotsnummer), pageW - margin - 28, 28);
    }
    function addFooter(){
      doc.setDrawColor(...lineGrey);
      doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
      doc.setTextColor(...textGrey);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Bernard van Lengerich Maschinenfabrik GmbH & Co. KG', margin, pageH - 10);
      doc.text(String(pageNo), pageW - margin, pageH - 10, {align:'right'});
    }
    function ensureSpace(height){
      if(y + height <= pageH - 24) return;
      addFooter();
      doc.addPage();
      pageNo += 1;
      addHeader();
      y = 60;
    }
    function drawDataRow(label, value){
      const valueLines = doc.splitTextToSize(safeText(value), pageW - margin * 2 - 68);
      const rowH = Math.max(11, valueLines.length * 4.8 + 5);
      ensureSpace(rowH + 1);
      doc.setFillColor(...lightBg);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      doc.setDrawColor(...lineGrey);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      doc.setTextColor(...bvlDark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(label, margin + 4, y + 7.2);
      doc.setTextColor(30, 42, 48);
      doc.setFont('helvetica', 'normal');
      doc.text(valueLines, margin + 64, y + 7.2);
      y += rowH + 1;
    }
    function drawImageBox(image, x, imgY, boxW, boxH){
      doc.setFillColor(238, 242, 244);
      doc.roundedRect(x, imgY, boxW, boxH, 2, 2, 'F');
      const ratio = image.width / image.height;
      let drawW = boxW;
      let drawH = boxH;
      if(ratio > boxW / boxH) drawH = boxW / ratio;
      else drawW = boxH * ratio;
      const centeredX = x + (boxW - drawW) / 2;
      const centeredY = imgY + (boxH - drawH) / 2;
      doc.addImage(image.dataUrl, 'JPEG', centeredX, centeredY, drawW, drawH);
    }

    addHeader();
    y = 62;

    doc.setTextColor(...bvlDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    const machineName = machine.typ || t('untitled');
    const titleLines = doc.splitTextToSize(machineName, pageW - margin * 2);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 7;

    doc.setTextColor(...textGrey);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(t('overview'), margin, y);
    y += 8;

    [
      ['angebotsnummer', machine.angebotsnummer],
      ['betriebsstunden', machine.betriebsstunden],
      ['baujahr', machine.baujahr],
      ['art', artLabel(machine.art)],
      ['zustand', formatFieldValue('zustand', machine.zustand)],
      ['standort', machine.standort],
      ['verfuegbarkeit', formatFieldValue('verfuegbarkeit', machine.verfuegbarkeit)],
      ['listenpreis', formatFieldValue('listenpreis', machine.listenpreis)]
    ].forEach(([key, value])=>drawDataRow(fieldLabel(key) + (key === 'listenpreis' ? '*' : ''), value));

    if(machine.sonstiges) drawDataRow(fieldLabel('sonstiges'), machine.sonstiges);

    if(machine.listenpreis){
      y += 3;
      ensureSpace(11);
      doc.setTextColor(...textGrey);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize(t('priceFootnote'), pageW - margin * 2), margin, y + 5);
      y += 13;
    }

    y += 8;
    ensureSpace(18);
    doc.setTextColor(...bvlDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(t('photos'), margin, y);
    y += 8;

    const imageNames = Array.from(new Set([machine.title_image].concat(machine.images || []).filter(Boolean)));
    const images = [];
    for(const filename of imageNames){
      const img = await fetchImageForPdf(filename);
      if(img) images.push(img);
    }

    if(!images.length){
      doc.setTextColor(...textGrey);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text(t('notSpecified'), margin, y + 5);
    }else{
      const colGap = 8;
      const colW = (pageW - margin * 2 - colGap) / 2;
      const imgH = 62;
      let col = 0;
      for(const image of images){
        ensureSpace(imgH + 10);
        const x = margin + col * (colW + colGap);
        drawImageBox(image, x, y, colW, imgH);
        col += 1;
        if(col >= 2){
          col = 0;
          y += imgH + 8;
        }
      }
    }

    addFooter();
    const filename = fileSafeName(machineName + '_' + (machine.angebotsnummer || '') + '_Expose') + '.pdf';
    doc.save(filename);
  }catch(err){
    console.error('Expose konnte nicht erstellt werden', err);
    alert(t('exposeFailed'));
  }finally{
    if(button){ button.disabled = false; button.textContent = originalText || t('createExpose'); }
  }
}

// ---------- Admin: Formular ----------
function openForm(){ $('formModal').classList.remove('hidden'); }
function closeForm(){ $('formModal').classList.add('hidden'); }

function resetForm(){
  $('machineForm').reset();
  $('machineId').value = '';
  $('thumbPick').innerHTML = '';
  $('formStatus').textContent = '';
  $('imageField').classList.remove('hidden');
  $('pdfField').classList.remove('hidden');
}

function newMachine(){
  resetForm();
  $('formTitle').textContent = t('newMachine');
  openForm();
}

function editMachine(id){
  const m = MACHINES.find(x=>x.id===id);
  if(!m) return;
  resetForm();
  $('formTitle').textContent = t('editMachine');
  $('machineId').value = id;
  const f = $('machineForm');
  ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges']
    .forEach(k=>{ if(f.elements[k]) f.elements[k].value = m[k] || ''; });
  // Beim Bearbeiten werden nur Textfelder geaendert (Bilder bleiben unveraendert)
  $('imageField').classList.add('hidden');
  $('pdfField').classList.add('hidden');
  openForm();
}

// Bild-Vorschau + Titelbild-Auswahl
$('imageInput') && $('imageInput').addEventListener('change', function(){
  const tp = $('thumbPick');
  tp.innerHTML = '';
  const files = Array.from(this.files);
  files.forEach((file,i)=>{
    const url = URL.createObjectURL(file);
    const lab = document.createElement('label');
    lab.innerHTML = `<input type="radio" name="titleIndex" value="${i}" ${i===0?'checked':''} style="display:none">
      <img src="${url}"><span>${t('titleImage')}</span>`;
    tp.appendChild(lab);
  });
});

async function deleteMachine(id){
  if(!confirm('Diese Maschine wirklich löschen?')) return;
  const r = await fetch('/api/machines/'+id, {method:'DELETE'});
  if(r.ok){ loadMachines(); } else { alert('Löschen fehlgeschlagen'); }
}

async function deleteMachine(id){
  if(!confirm(t('deleteConfirm'))) return;
  const r = await fetch('/api/machines/'+id, {method:'DELETE'});
  if(r.ok){ loadMachines(); } else { alert(t('deleteFailed')); }
}

$('machineForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const id = $('machineId').value;
  $('formStatus').textContent = 'Speichern …';
  $('formStatus').textContent = t('saving');
  $('saveBtn').disabled = true;
  try{
    let r;
    if(id){
      // Bearbeiten: nur Textfelder als JSON
      const data = {};
      ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges']
        .forEach(k=>{ data[k] = this.elements[k] ? this.elements[k].value : ''; });
      r = await fetch('/api/machines/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
    } else {
      // Neu: FormData mit Dateien
      const pdfFile = $('pdfInput').files[0];
      if(pdfFile && this.elements.listenpreis && !this.elements.listenpreis.value.trim() && typeof window.extractListPriceFromPDF === 'function'){
        const pdfListPrice = await window.extractListPriceFromPDF(pdfFile);
        if(pdfListPrice) this.elements.listenpreis.value = pdfListPrice;
      }
      const fd = new FormData();
      ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges']
        .forEach(k=>{ fd.append(k, this.elements[k] ? this.elements[k].value : ''); });
      const imgs = $('imageInput').files;
      for(let i=0;i<imgs.length;i++) fd.append('images', imgs[i]);
      const ti = document.querySelector('input[name="titleIndex"]:checked');
      fd.append('titleIndex', ti ? ti.value : '0');
      if(pdfFile) fd.append('pdf', pdfFile);
      r = await fetch('/api/machines', {method:'POST', body: fd});
    }
    if(!r.ok){ const er = await r.json().catch(()=>({})); throw new Error(er.error||t('formError')); }
    closeForm();
    loadMachines();
  }catch(err){
    $('formStatus').textContent = t('formError') + err.message;
  }finally{
    $('saveBtn').disabled = false;
  }
});

// ---------- Events ----------
$('loginBtn').addEventListener('click', tryLogin);
$('pwInput').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
$('logoutBtn').addEventListener('click', async ()=>{ await fetch('/api/logout',{method:'POST'}); location.reload(); });
$('addBtn').addEventListener('click', newMachine);
$('cancelBtn').addEventListener('click', closeForm);
$('languageSelect').addEventListener('change', e=>{ LANG = e.target.value === 'en' ? 'en' : 'de'; applyLanguage(); });
$('dealerPriceToggle').addEventListener('click', ()=>{
  DEALER_PRICE_VISIBLE = !DEALER_PRICE_VISIBLE;
  updateDealerPriceToggle();
  render();
});
updateStaticText();

// Bereits angemeldet?
(async function(){
  const r = await fetch('/api/me');
  const d = await r.json().catch(()=>({}));
  if(d && d.role){ ROLE = d.role; startApp(); }
  else { $('pwInput').focus(); }
})();
