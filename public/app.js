'use strict';

let ROLE = null;
let MACHINES = [];

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

const $ = id => document.getElementById(id);
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function eur(label, v){
  if(!v) return v;
  const t = String(v).trim();
  if(/preis|ep/i.test(label) && /^[\d.,]+$/.test(t)){
    const n = Number(t.replace(/\./g,'').replace(',','.'));
    if(!isNaN(n)) return n.toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
  }
  return t;
}

// ---------- Login ----------
async function tryLogin(){
  const pw = $('pwInput').value;
  $('loginError').textContent = '';
  $('loginBtn').disabled = true;
  try{
    const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: pw})});
    if(!r.ok){ $('loginError').textContent = 'Falsches Passwort'; return; }
    const data = await r.json();
    ROLE = data.role;
    startApp();
  }catch(err){
    console.error('Login fehlgeschlagen', err);
    $('loginError').textContent = 'Login fehlgeschlagen. Bitte erneut versuchen.';
  }finally{
    $('loginBtn').disabled = false;
  }
}

function startApp(){
  $('loginOverlay').classList.add('hidden');
  $('app').classList.remove('hidden');
  const chip = $('roleChip');
  if(ROLE === 'admin'){ chip.textContent = 'Admin'; chip.classList.add('admin'); $('adminBar').classList.remove('hidden'); }
  else { chip.textContent = 'Betrachter'; chip.classList.remove('admin'); $('adminBar').classList.add('hidden'); }
  loadMachines();
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
  $('counter').textContent = MACHINES.length + (MACHINES.length === 1 ? ' Maschine' : ' Maschinen');
  if(!MACHINES.length){ grid.innerHTML=''; $('emptyState').classList.remove('hidden'); return; }
  $('emptyState').classList.add('hidden');
  grid.innerHTML = MACHINES.map(cardHtml).join('');
}

function cardHtml(m){
  const hero = m.title_image
    ? `<img class="hero" src="/uploads/${esc(m.title_image)}" onclick="openLightbox(${m.id},0)">`
    : `<div class="hero placeholder">Kein Bild</div>`;
  const badge = m.art ? `<span class="badge">${esc(m.art)}</span>` : '';
  const rows = FIELDS.map(([k,label])=>{
    const val = eur(label, m[k]);
    const disp = val ? esc(val) : `<span class="empty">&ndash;</span>`;
    return `<div class="row"><strong>${label}</strong><span>${disp}</span></div>`;
  }).join('');
  const gallery = (m.images||[]).map((img,i)=>`<img src="/uploads/${esc(img)}" onclick="openLightbox(${m.id},${i})">`).join('');
  const pdf = m.pdf_file ? `<a class="pdflink" href="/uploads/${esc(m.pdf_file)}" target="_blank">PDF ansehen</a>` : '';
  let actions = '';
  if(ROLE === 'admin'){
    actions = `<button class="btn ghost" onclick="editMachine(${m.id})">Bearbeiten</button>
               <button class="btn accent" onclick="deleteMachine(${m.id})">Löschen</button>`;
  }
  return `<div class="card">
    <div class="heroWrap">${hero}${badge}</div>
    <div class="content">
      <h3 class="mtitle">${esc(m.typ)||'Ohne Titel'}</h3>
      <div class="rows">${rows}</div>
      ${gallery ? `<div class="gallery">${gallery}</div>` : ''}
      <div class="cardactions">${actions}${pdf}</div>
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
  $('formTitle').textContent = 'Neue Maschine';
  openForm();
}

function editMachine(id){
  const m = MACHINES.find(x=>x.id===id);
  if(!m) return;
  resetForm();
  $('formTitle').textContent = 'Maschine bearbeiten';
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
      <img src="${url}"><span>Titelbild</span>`;
    tp.appendChild(lab);
  });
});

async function deleteMachine(id){
  if(!confirm('Diese Maschine wirklich löschen?')) return;
  const r = await fetch('/api/machines/'+id, {method:'DELETE'});
  if(r.ok){ loadMachines(); } else { alert('Löschen fehlgeschlagen'); }
}

$('machineForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const id = $('machineId').value;
  $('formStatus').textContent = 'Speichern …';
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
      const fd = new FormData();
      ['typ','art','angebotsnummer','baujahr','betriebsstunden','zustand','listenpreis','haendler_ep','standort','verfuegbarkeit','sonstiges']
        .forEach(k=>{ fd.append(k, this.elements[k] ? this.elements[k].value : ''); });
      const imgs = $('imageInput').files;
      for(let i=0;i<imgs.length;i++) fd.append('images', imgs[i]);
      const ti = document.querySelector('input[name="titleIndex"]:checked');
      fd.append('titleIndex', ti ? ti.value : '0');
      if($('pdfInput').files[0]) fd.append('pdf', $('pdfInput').files[0]);
      r = await fetch('/api/machines', {method:'POST', body: fd});
    }
    if(!r.ok){ const er = await r.json().catch(()=>({})); throw new Error(er.error||'Fehler'); }
    closeForm();
    loadMachines();
  }catch(err){
    $('formStatus').textContent = 'Fehler: ' + err.message;
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

// Bereits angemeldet?
(async function(){
  const r = await fetch('/api/me');
  const d = await r.json().catch(()=>({}));
  if(d && d.role){ ROLE = d.role; startApp(); }
  else { $('pwInput').focus(); }
})();
