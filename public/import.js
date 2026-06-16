'use strict';
/* Ordner-Import: portiert aus der urspruenglichen index.html.
   Liest Excel + PDF + Bilder pro Maschinen-Unterordner aus und speichert auf dem Server. */

const fieldDefinitions = [
  { key:"angebotsnummer", label:"Angebotsnummer", aliases:["angebotsnummer","angebot nr","angebot","auftragsnummer","auftrag nr"] },
  { key:"baujahr", label:"Baujahr", aliases:["baujahr","bj"] },
  { key:"betriebsstunden", label:"Betriebsstunden", aliases:["betriebsstunden","stunden","bh"] },
  { key:"art", label:"Art", aliases:["art"] },
  { key:"zustand", label:"Zustand", aliases:["zustand"] },
  { key:"listenpreis", label:"Listenpreis", aliases:["listenpreis","listen price","bruttolistenpreis"] },
  { key:"haendler_ep", label:"Händler EP", aliases:["händler ep","haendler ep","dealer ep","einkaufspreis"] },
  { key:"standort", label:"Standort", aliases:["standort","location","ort","lagerort"] },
  { key:"verfuegbarkeit", label:"Verfügbarkeit", aliases:["verfügbarkeit","verfuegbarkeit","available","availability"] },
  { key:"sonstiges", label:"Sonstiges", aliases:["sonstiges","bemerkung","notiz","kommentar"] }
];

function impNormalize(value){
  return String(value ?? "").trim().toLowerCase()
    .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
    .replace(/\s+/g," ").replace(/[\.:]/g,"");
}
function artGermanFromLabel(label){
  const n = String(label || "").trim();
  if(["Gebrauchtmaschine","Demomaschine","Neumaschine","Sonstiges"].includes(n)) return n;
  if(n === "Used machine") return "Gebrauchtmaschine";
  if(n === "Demo machine") return "Demomaschine";
  if(n === "New machine") return "Neumaschine";
  if(n === "Other") return "Sonstiges";
  return "Gebrauchtmaschine";
}
function getCell(rows,r,c){ if(!rows[r]) return ""; return rows[r][c] ?? ""; }
function findValueInRows(rows, aliases){
  const na = aliases.map(impNormalize);
  for(let r=0;r<rows.length;r++){
    for(let c=0;c<(rows[r]||[]).length;c++){
      const raw = getCell(rows,r,c); const cell = impNormalize(raw);
      if(!cell) continue;
      const found = na.find(a => cell === a || cell.startsWith(a+" ") || cell.includes(a));
      if(!found) continue;
      const rawString = String(raw ?? "");
      const colon = rawString.match(/[:：](.+)$/);
      if(colon && colon[1].trim()) return colon[1].trim();
      for(let cc=c+1; cc<Math.min((rows[r]||[]).length, c+6); cc++){
        const right = getCell(rows,r,cc); if(String(right??"").trim()!=="") return right;
      }
      for(let rr=r+1; rr<Math.min(rows.length, r+6); rr++){
        const below = getCell(rows,rr,c); if(String(below??"").trim()!=="") return below;
      }
    }
  }
  return "";
}
function cleanMachineTitle(raw){
  if(!raw) return "";
  let t = String(raw).replace(/\.pdf$/i,"").replace(/\.(xlsx|xls)$/i,"").replace(/_/g," ").replace(/\s+/g," ").trim();
  t = t.replace(/V\s*-\s*MIX/ig,"V-MIX").replace(/V\s*-\s*LOAD/ig,"V-LOAD").replace(/V\s*-\s*COMFORT/ig,"V-COMFORT");
  const patterns = [
    /\bV-MIX\s+Drive\s+Maximus\s+(?:Plus|Giant)\s+\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
    /\bV-MIX\s+(?:Plus|Giant|Agilo|Fill|Fix|Drive|Maximus|Compact)\s+[\w\s.+/-]*?\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
    /\bV-MIX\s+\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
    /\bV-LOAD\s+(?:Cutter\s+)?[A-Za-zÄÖÜäöüß]+\s*(?:[A-Za-zÄÖÜäöüß]+\s*)*(?:HD\s*)?\d+\b/i,
    /\bV-COMFORT\s+[A-Za-zÄÖÜäöüß0-9\s.+/-]+/i
  ];
  for(const p of patterns){ const m=t.match(p); if(m){ return m[0].replace(/\s*-\s*(\dS)\b/i,"-$1").replace(/\s+/g," ").trim(); } }
  return "";
}
async function ensurePdfLib(){
  if(window.pdfjsLib) return window.pdfjsLib;
  await new Promise(resolve=>{
    const timer = setTimeout(resolve, 4000);
    window.addEventListener('pdfjs-ready', ()=>{
      clearTimeout(timer);
      resolve();
    }, {once:true});
  });
  return window.pdfjsLib || null;
}
async function extractOfferNumberFromPDF(pdfFile){
  try{
    if(!pdfFile) return "";
    function normAn(v){ if(!v) return ""; const t=String(v).replace(/[–—−]/g,"-").replace(/\s+/g,"").replace(/_/g,"").trim(); const m=t.match(/AN-\d{2,}\.\d{3,}/i); return m?m[0].toUpperCase():""; }
    const fromFileName = normAn(pdfFile.name);
    const pdfLib = await ensurePdfLib();
    if(!pdfLib) return fromFileName;
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await pdfLib.getDocument({data:buffer}).promise;
    const page = await pdf.getPage(1);
    const text = await page.getTextContent();
    const items = text.items.map(i=>({str:String(i.str||"").trim(), x:i.transform[4]||0, y:i.transform[5]||0})).filter(i=>i.str);
    const labelItems = items.filter(i=>/angebotsnummer/i.test(i.str));
    for(const label of labelItems){
      const right = items.filter(i=>i!==label && Math.abs(i.y-label.y)<=8 && i.x>label.x).sort((a,b)=>a.x-b.x);
      const d = normAn(right.map(i=>i.str).join(" ")); if(d) return d;
      const c = normAn(right.map(i=>i.str).join("")); if(c) return c;
    }
    const linesMap={}; items.forEach(it=>{ const y=Math.round(it.y/3)*3; (linesMap[y]=linesMap[y]||[]).push(it); });
    const lines = Object.entries(linesMap).map(([y,ri])=>{ ri.sort((a,b)=>a.x-b.x); return {y:Number(y), text:ri.map(i=>i.str).join(" ").replace(/\s+/g," ").trim(), compact:ri.map(i=>i.str).join("").replace(/\s+/g,"").trim()}; }).sort((a,b)=>b.y-a.y);
    for(const line of lines){ if(/angebotsnummer/i.test(line.text)||/angebotsnummer/i.test(line.compact)){ const f=normAn(line.text)||normAn(line.compact); if(f) return f; } }
    const fromPdf = normAn(items.map(i=>i.str).join(" ")) || normAn(items.map(i=>i.str).join(""));
    if(fromPdf) return fromPdf;
    return fromFileName;
  }catch(err){
    console.error("AN aus PDF fehlgeschlagen", err);
    const m = String(pdfFile&&pdfFile.name?pdfFile.name:"").replace(/[–—−]/g,"-").match(/AN-\d{2,}\.\d{3,}/i);
    return m?m[0].toUpperCase():"";
  }
}
function hasGrossListPriceLabel(value){
  const compact = String(value || "").toLowerCase()
    .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
    .replace(/[^a-z0-9]/g,"");
  return compact.includes("bruttolistenpreis")
    || compact.includes("bruttolistenpreise")
    || compact.includes("listenpreisbrutto")
    || compact.includes("bruttolistprice")
    || compact.includes("grosslistprice")
    || compact.includes("listpricegross");
}
function normalizeListPriceValue(value){
  const text = String(value || "")
    .replace(/\u00a0/g," ")
    .replace(/\s+/g," ")
    .trim();
  const matches = text.match(/-?\d{1,3}(?:[.\s'`´]\d{3})+(?:,\d{2})?|-?\d{4,}(?:[,.]\d{2})?/g) || [];
  for(const raw of matches){
    let cleaned = String(raw)
      .replace(/[\s'`´]/g,"")
      .replace(/[^\d,.-]/g,"")
      .trim();
    if(!cleaned) continue;

    const comma = cleaned.lastIndexOf(",");
    const dot = cleaned.lastIndexOf(".");
    if(comma !== -1 && dot !== -1){
      cleaned = comma > dot
        ? cleaned.replace(/\./g,"").replace(",",".")
        : cleaned.replace(/,/g,"");
    }else if(comma !== -1){
      cleaned = /^\d{1,3}(,\d{3})+$/.test(cleaned)
        ? cleaned.replace(/,/g,"")
        : cleaned.replace(",",".");
    }else if(dot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(cleaned)){
      cleaned = cleaned.replace(/\./g,"");
    }

    const n = Number(cleaned);
    if(Number.isFinite(n) && n > 0) return String(Math.round(n));
  }
  return "";
}
function listPriceFromLabeledText(value){
  const text = String(value || "").replace(/\s+/g," ").trim();
  const label = text.match(/brutto\s*-?\s*listen\s*-?\s*preis|listen\s*-?\s*preis\s+brutto|gross\s+list\s+price|list\s+price\s+gross/i);
  if(!label) return "";
  const afterLabel = text.slice(label.index + label[0].length);
  return normalizeListPriceValue(afterLabel) || normalizeListPriceValue(text);
}
async function extractListPriceFromPDF(pdfFile){
  try{
    if(!pdfFile) return "";
    const pdfLib = await ensurePdfLib();
    if(!pdfLib){
      console.warn("PDF-Bibliothek nicht geladen, Listenpreis kann nicht ausgelesen werden.");
      return "";
    }
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await pdfLib.getDocument({data:buffer}).promise;
    const maxPages = pdf.numPages || 1;

    for(let p=1;p<=maxPages;p++){
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.map(i=>({str:String(i.str||"").trim(), x:i.transform[4]||0, y:i.transform[5]||0})).filter(i=>i.str);

      const labelItems = items.filter(i=>hasGrossListPriceLabel(i.str));
      for(const label of labelItems){
        const right = items
          .filter(i=>i!==label && Math.abs(i.y-label.y)<=10 && i.x>=label.x)
          .sort((a,b)=>a.x-b.x);
        const rightPrice = normalizeListPriceValue(right.map(i=>i.str).join(" "));
        if(rightPrice) return rightPrice;
      }

      const rowsMap = {};
      items.forEach(it=>{ const y=Math.round(it.y/3)*3; (rowsMap[y]=rowsMap[y]||[]).push(it); });
      const rows = Object.entries(rowsMap).map(([y,ri])=>{
        ri.sort((a,b)=>a.x-b.x);
        return {
          y:Number(y),
          items:ri,
          text:ri.map(i=>i.str).join(" ").replace(/\s+/g," ").trim(),
          compact:ri.map(i=>i.str).join("").replace(/\s+/g,"").trim()
        };
      }).sort((a,b)=>b.y-a.y);

      for(let i=0;i<rows.length;i++){
        const row = rows[i];
        if(!hasGrossListPriceLabel(row.text) && !hasGrossListPriceLabel(row.compact)) continue;
        const sameRowPrice = listPriceFromLabeledText(row.text) || listPriceFromLabeledText(row.compact) || normalizeListPriceValue(row.text);
        if(sameRowPrice) return sameRowPrice;
        const nextRows = rows.slice(i + 1, i + 7).map(r=>r.text).join(" ");
        const nextPrice = normalizeListPriceValue(nextRows);
        if(nextPrice) return nextPrice;
      }

      const fullText = rows.map(r=>r.text).join(" ");
      const fullTextPrice = listPriceFromLabeledText(fullText);
      if(fullTextPrice) return fullTextPrice;
    }
    return "";
  }catch(err){
    console.error("Listenpreis aus PDF fehlgeschlagen", err);
    return "";
  }
}
if(typeof window !== "undefined"){
  window.extractListPriceFromPDF = extractListPriceFromPDF;
}
async function extractMachineTitleFromPDF(pdfFile){
  try{
    if(!pdfFile) return "";
    const pdfLib = await ensurePdfLib();
    if(!pdfLib) return "";
    function normTitle(v){
      if(!v) return "";
      let text=String(v).replace(/V\s*-\s*MIX/ig,"V-MIX").replace(/V\s*-\s*LOAD/ig,"V-LOAD").replace(/V\s*-\s*COMFORT/ig,"V-COMFORT")
        .replace(/V\s*_\s*MIX/ig,"V-MIX").replace(/V\s*_\s*LOAD/ig,"V-LOAD").replace(/_/g," ").replace(/\s+/g," ").trim();
      text=text.replace(/^\d{6,}\s+/,"");
      text=text.replace(/\s+\d+\s+(?:\d{1,3}(?:\.\d{3})*,\d{2}|Serie|Ohne\s+Aufpreis|0,00|[0-9.,]+)\s*$/i,"").replace(/\s+\d+\s*$/,"").trim();
      const patterns=[
        /\bV-MIX\s+Drive\s+Maximus\s+(?:Plus|Giant)\s+\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
        /\bV-MIX\s+(?:Plus|Giant|Agilo|Fill|Fix|Drive|Maximus|Compact)\s+[\w\s.+/-]*?\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
        /\bV-MIX\s+\d+[.,]?\d*\s*[- ]\s*\dS\b/i,
        /\bV-LOAD\s+(?:Cutter\s+)?[A-Za-zÄÖÜäöüß]+\s*(?:[A-Za-zÄÖÜäöüß]+\s*)*(?:HD\s*)?\d+\b/i,
        /\bV-COMFORT\s+[A-Za-zÄÖÜäöüß0-9\s.+/-]+/i
      ];
      for(const p of patterns){ const m=text.match(p); if(m){ return m[0].replace(/\s*-\s*(\dS)\b/i,"-$1").replace(/\s+/g," ").trim(); } }
      if(/^(V-MIX|V-LOAD|V-COMFORT)\b/i.test(text) && text.length<=80){ return text.replace(/\s*-\s*(\dS)\b/i,"-$1").replace(/\s+/g," ").trim(); }
      return "";
    }
    const buffer=await pdfFile.arrayBuffer();
    const pdf=await pdfLib.getDocument({data:buffer}).promise;
    const maxPages=Math.min(pdf.numPages,2);
    for(let p=1;p<=maxPages;p++){
      const page=await pdf.getPage(p);
      const tc=await page.getTextContent();
      const items=tc.items.map(i=>({str:String(i.str||"").trim(), x:i.transform[4]||0, y:i.transform[5]||0})).filter(i=>i.str);
      const rowsMap={}; items.forEach(it=>{ const y=Math.round(it.y/3)*3; (rowsMap[y]=rowsMap[y]||[]).push(it); });
      const rows=Object.entries(rowsMap).map(([y,ri])=>{ ri.sort((a,b)=>a.x-b.x); return {y:Number(y), items:ri, text:ri.map(i=>i.str).join(" ").replace(/\s+/g," ").trim(), compact:ri.map(i=>i.str).join("").replace(/\s+/g,"").trim()}; }).sort((a,b)=>b.y-a.y);
      const headerRows=rows.filter(row=>{ const t=row.text.toLowerCase(); return t.includes("auftrag")&&t.includes("titel")&&t.includes("menge"); });
      for(const header of headerRows){
        const th=header.items.find(i=>/titel/i.test(i.str));
        const qh=header.items.find(i=>/menge/i.test(i.str));
        const ph=header.items.find(i=>/preis/i.test(i.str));
        const titleX=th?th.x-10:110;
        const nextColX=qh?qh.x-10:(ph?ph.x-10:9999);
        const below=rows.filter(r=>r.y<header.y-2).sort((a,b)=>b.y-a.y);
        for(const row of below){
          if(!row.items.some(i=>/^\d{6,}$/.test(i.str))) continue;
          let parts=row.items.filter(i=>i.x>=titleX && i.x<nextColX).map(i=>i.str).join(" ").replace(/\s+/g," ").trim();
          let title=normTitle(parts); if(title) return title;
          title=normTitle(row.text)||normTitle(row.compact); if(title) return title;
        }
      }
      for(const row of rows){ const title=normTitle(row.text)||normTitle(row.compact); if(title) return title; }
    }
    return normTitle(pdfFile.name);
  }catch(err){
    console.error("Titel aus PDF fehlgeschlagen", err);
    return cleanMachineTitle(pdfFile && pdfFile.name ? pdfFile.name : "");
  }
}
async function parseExcel(file){
  if(!file || typeof XLSX === "undefined") return { values:{}, error:"" };
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:"array",cellDates:false});
    const allRows=[];
    wb.SheetNames.forEach(sn=>{ const sheet=wb.Sheets[sn]; XLSX.utils.sheet_to_json(sheet,{header:1,defval:""}).forEach(r=>allRows.push(r)); });
    const values={};
    fieldDefinitions.forEach(f=>{ values[f.key]=findValueInRows(allRows,f.aliases); });
    const name=findValueInRows(allRows,["name","bezeichnung","titel","maschine","kurzbezeichnung"]);
    if(name) values.name=name;
    return { values, error:"" };
  }catch(err){ console.error(err); return { values:{}, error:"Excel-Datei konnte nicht gelesen werden." }; }
}

// ---------- Ordner-Import-Ablauf ----------
function setImportStatus(msg, isError){
  const el = document.getElementById('importStatus');
  if(el){ el.textContent = msg; el.style.color = isError ? '#A40B1E' : '#6b7b85'; }
}

async function handleFolderImport(e){
  const files = Array.from(e.target.files);
  if(!files.length) return;
  setImportStatus('Import läuft …');

  // Nach Maschinen-Unterordner gruppieren (wie in der alten index.html)
  const folderGroups = {};
  files.forEach(file=>{
    const parts = (file.webkitRelativePath || file.name).split('/');
    let folder = "Import";
    if(parts.length > 2) folder = parts.slice(0,-1).join('/');
    else if(parts.length > 1) folder = parts[0];
    (folderGroups[folder] = folderGroups[folder] || []).push(file);
  });

  const folders = Object.keys(folderGroups);
  let done = 0, failed = 0;
  let missingPdfListPrices = 0;

  for(const folder of folders){
    const group = folderGroups[folder];
    const titleImage = group.find(f => f.name.toLowerCase().includes('titel') && f.type.startsWith('image/'))
                    || group.find(f => f.type.startsWith('image/'));
    const excel = group.find(f => /\.(xlsx|xls)$/i.test(f.name));
    const pdf = group.find(f => /\.pdf$/i.test(f.name) && /angebot|offer|v-mix|vmix|gebraucht|used/i.test(f.name))
             || group.find(f => /\.pdf$/i.test(f.name));
    const images = group.filter(f => f.type.startsWith('image/'));

    setImportStatus(`Verarbeite ${++done} von ${folders.length} …`);

    try{
      const parsed = await parseExcel(excel);
      if(!parsed.values) parsed.values = {};
      const pdfMachineTitle = await extractMachineTitleFromPDF(pdf);
      const pdfOfferNumber = await extractOfferNumberFromPDF(pdf);
      const pdfListPrice = await extractListPriceFromPDF(pdf);
      if(pdf && !pdfListPrice){
        missingPdfListPrices += 1;
        console.warn("Kein Bruttolistenpreis im PDF gefunden:", pdf.name);
      }

      const v = parsed.values;
      const fd = new FormData();
      fd.append('typ', pdfMachineTitle || cleanMachineTitle(v.name) || cleanMachineTitle(pdf ? pdf.name : "") || (folder.split('/').pop() || ""));
      fd.append('art', artGermanFromLabel(v.art || ""));
      fd.append('angebotsnummer', pdfOfferNumber || v.angebotsnummer || "");
      fd.append('baujahr', v.baujahr || "");
      fd.append('betriebsstunden', v.betriebsstunden || "");
      fd.append('zustand', v.zustand || "");
      fd.append('listenpreis', pdfListPrice || v.listenpreis || "");
      fd.append('haendler_ep', v.haendler_ep || "");
      fd.append('standort', v.standort || "");
      fd.append('verfuegbarkeit', v.verfuegbarkeit || "");
      fd.append('sonstiges', v.sonstiges || "");

      let titleIndex = 0;
      images.forEach((img,i)=>{ fd.append('images', img); if(titleImage && img === titleImage) titleIndex = i; });
      fd.append('titleIndex', String(titleIndex));
      if(pdf) fd.append('pdf', pdf);

      const r = await fetch('/api/machines', { method:'POST', body: fd });
      if(!r.ok){ failed++; const er = await r.json().catch(()=>({})); console.error('Upload-Fehler', folder, er); }
    }catch(err){ failed++; console.error('Import-Fehler', folder, err); }
  }

  e.target.value = "";
  if(typeof loadMachines === 'function') loadMachines();
  const priceHint = missingPdfListPrices ? ` Hinweis: Bei ${missingPdfListPrices} PDF-Angebot(en) wurde kein Bruttolistenpreis gefunden.` : "";
  setImportStatus(`Fertig: ${folders.length - failed} importiert${failed ? ', ' + failed + ' fehlgeschlagen' : ''}.${priceHint}`, failed>0);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const folderBtn = document.getElementById('folderBtn');
  const folderInput = document.getElementById('folderInput');
  if(folderBtn && folderInput){
    folderBtn.addEventListener('click', ()=> folderInput.click());
    folderInput.addEventListener('change', handleFolderImport);
  }
});
