'use strict';

/* ═══════════════ STATE ═══════════════ */
let data = null, allWards = [];
let simRunning = false, simStep = -1, simTimer = null;
let floodLayers = [], mapMarkers = [], donutChart = null;
const RC = { HIGH:'#ef4444', MEDIUM:'#f59e0b', LOW:'#10b981' };

/* ═══════════════ MAP ═══════════════ */
const map = L.map('map', { center:[28.635,77.22], zoom:11, zoomControl:false, attributionControl:false });
L.control.zoom({ position:'topright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);

/* ═══════════════ INTENSITY GRID ═══════════════ */
(function buildGrid() {
  const el = document.getElementById('intensityGrid');
  if (!el) return;
  for (let i = 0; i < 28; i++) {
    const d = document.createElement('div');
    d.className = 'ig-cell';
    d.id = `igc${i}`;
    d.style.background = '#eef2ff';
    el.appendChild(d);
  }
})();

function updateGrid(mm) {
  const shades = ['#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5'];
  for (let i = 0; i < 28; i++) {
    const c = document.getElementById(`igc${i}`);
    if (!c) continue;
    const v = Math.random() * (mm / 300);
    const idx = Math.min(Math.floor(v * shades.length), shades.length - 1);
    c.style.background = shades[idx];
  }
}
updateGrid(120);

/* ═══════════════ SLIDER ═══════════════ */
const slider = document.getElementById('slider');
slider.addEventListener('input', () => {
  const v = +slider.value;
  document.getElementById('rainNum').textContent = v;
  updateGrid(v);
  const pill = document.getElementById('rainPill');
  const dot  = pill.querySelector('.rpill-dot');
  const cat  = document.getElementById('rainCat');
  if (v < 100) {
    pill.className = 'rain-pill low'; dot.className = 'rpill-dot low'; cat.textContent = 'Light';
  } else if (v < 200) {
    pill.className = 'rain-pill moderate'; dot.className = 'rpill-dot moderate'; cat.textContent = 'Moderate';
  } else {
    pill.className = 'rain-pill heavy'; dot.className = 'rpill-dot heavy'; cat.textContent = 'Heavy / Extreme';
  }
});

/* ═══════════════ ANALYZE ═══════════════ */
async function runAnalysis() {
  ['analyzeBtn','topAnalyzeBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>&nbsp; Analyzing…'; }
  });
  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rainfall: +slider.value }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
    allWards = data.wards;

    renderStatCards(data.summary);
    renderMapMarkers(data.wards);
    renderDonut(data.summary);
    renderWardCards(data.wards);
    renderTable(data.wards);
  } catch(e) {
    console.error('Analyze error:', e);
    alert('Error: ' + e.message + '\n\nMake sure Flask server is running (python app.py)');
  } finally {
    const ab = document.getElementById('analyzeBtn');
    const tb = document.getElementById('topAnalyzeBtn');
    if (ab) { ab.disabled = false; ab.innerHTML = '⚡ &nbsp;Analyze Flood Risk'; }
    if (tb) { tb.disabled = false; tb.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/><path d="M10 8l6 4-6 4V8z" fill="white"/></svg> Analyze Risk'; }
  }
}

/* ═══════════════ STAT CARDS ═══════════════ */
function renderStatCards(s) {
  set('s1', 10);
  setHTML('s1b', `<span style="color:${s.drain_failures>0?'#ef4444':'#10b981'}">` +
    (s.drain_failures > 0 ? `↑ ${s.drain_failures} drain failures` : '✓ All drains OK') + '</span>');
  document.getElementById('s1b').className = s.drain_failures > 0 ? 'sc-badge red' : 'sc-badge green';

  set('s2', fmt(s.pop_affected));
  setHTML('s2b', `↑ ${s.medium} medium risk wards`);
  document.getElementById('s2b').className = 'sc-badge red';

  set('s3', s.high);
  setHTML('s3b', s.high > 0 ? `↑ ${s.high} wards critical` : '✓ No critical wards');
  document.getElementById('s3b').className = s.high > 0 ? 'sc-badge red' : 'sc-badge green';

  set('s4', s.avg_readiness + '%');
  setHTML('s4b', `↑ ${s.pumps} pumps · ${s.teams} teams`);
  document.getElementById('s4b').className = s.avg_readiness >= 50 ? 'sc-badge green' : 'sc-badge amber';
}

/* ═══════════════ MAP MARKERS ═══════════════ */
function renderMapMarkers(wards) {
  mapMarkers.forEach(m => m.remove()); mapMarkers = [];
  wards.forEach(w => {
    const col  = RC[w.risk];
    const size = w.risk==='HIGH'?40:w.risk==='MEDIUM'?33:26;
    const sym  = w.risk==='HIGH'?'!':w.risk==='MEDIUM'?'~':'✓';
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
        background:white;border:2.5px solid ${col};
        box-shadow:0 2px 10px ${col}55;
        display:flex;align-items:center;justify-content:center;
        font-size:${Math.round(size*.35)}px;font-weight:800;color:${col};
        font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;">${sym}</div>`,
      iconSize:[size,size], iconAnchor:[size/2,size/2],
    });
    const popup = `
      <div class="pu-title">${w.name}</div>
      <div class="pu-row"><span class="pu-key">Flood Risk</span><span class="pu-val ${w.risk}">${w.risk}</span></div>
      <div class="pu-row"><span class="pu-key">Rainfall</span><span class="pu-val">${w.rainfall} mm</span></div>
      <div class="pu-row"><span class="pu-key">Elevation</span><span class="pu-val">${w.elevation} m</span></div>
      <div class="pu-row"><span class="pu-key">Drainage</span><span class="pu-val">${w.drainage}%</span></div>
      <div class="pu-row"><span class="pu-key">Population</span><span class="pu-val">${fmt(w.population)}</span></div>
      <div class="pu-row"><span class="pu-key">Readiness</span><span class="pu-val">${w.readiness}% — ${w.readiness_label}</span></div>
      <div class="pu-row"><span class="pu-key">Drain Status</span><span class="pu-val ${w.drain_failed?'DRAIN':'LOW'}">${w.drain_failed?'⚠ Failure Risk':'✓ Normal'}</span></div>
      <div class="pu-row"><span class="pu-key">Flood Area</span><span class="pu-val">${w.flood_area} km²</span></div>
    `;
    const m = L.marker([w.lat,w.lon],{icon}).addTo(map).bindPopup(popup,{maxWidth:240});
    mapMarkers.push(m);
    if (w.drain_failed) {
      const wi = L.divIcon({ className:'', html:`<div style="font-size:14px">⚠️</div>`, iconSize:[16,16], iconAnchor:[-5,22] });
      mapMarkers.push(L.marker([w.lat+0.007,w.lon+0.014],{icon:wi}).addTo(map));
    }
  });
}

/* ═══════════════ DONUT ═══════════════ */
function renderDonut(s) {
  const total = (s.high + s.medium + s.low) || 1;
  const hp = Math.round(s.high/total*100), mp = Math.round(s.medium/total*100), lp = Math.round(s.low/total*100);
  set('dHigh', hp+'%'); set('dMed', mp+'%'); set('dLow', lp+'%');
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: ['High','Medium','Low'],
      datasets: [{ data:[s.high,s.medium,s.low],
        backgroundColor:['#fca5a5','#fcd34d','#6ee7b7'],
        borderColor:['#ef4444','#f59e0b','#10b981'],
        borderWidth:2, hoverOffset:4 }],
    },
    options: { responsive:true, maintainAspectRatio:false, cutout:'66%', plugins:{legend:{display:false}} },
  });
}

/* ═══════════════ WARD CARDS ═══════════════ */
function setFilter(mode, btn) {
  document.querySelectorAll('.fpill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWardCards(mode==='ALL' ? allWards : allWards.filter(w=>w.risk===mode));
}

function renderWardCards(wards) {
  const el = document.getElementById('wardGrid');
  if (!wards.length) { el.innerHTML = '<div class="empty-msg">No wards match this filter.</div>'; return; }
  el.innerHTML = '';

  const sorted = [...wards].sort((a,b)=>['HIGH','MEDIUM','LOW'].indexOf(a.risk)-['HIGH','MEDIUM','LOW'].indexOf(b.risk));

  sorted.forEach((w, i) => {
    const col   = RC[w.risk];
    const bigPct = w.risk==='HIGH' ? w.prob_high : w.risk==='MEDIUM' ? w.prob_med : w.prob_low;

    // 7 spark bars — simulate trend data
    const spark = Array.from({length:7},(_,j)=>{
      const base = w.risk==='HIGH'?0.65:w.risk==='MEDIUM'?0.45:0.25;
      return Math.max(0.1, Math.min(1, base + (Math.sin(j+i)*0.25)));
    });
    const sparkHTML = spark.map((v,j)=>
      `<div class="wc-spark-bar" style="height:${Math.round(v*100)}%;background:${col}${j===6?'':'88'}"></div>`
    ).join('');

    // 3 breakdown rows — matching image style
    const rows = [
      { label:'Readiness', val:w.readiness+'%', pct:w.readiness, color: w.readiness>=70?'#10b981':w.readiness>=40?'#f59e0b':'#ef4444' },
      { label:'Drainage',  val:w.drainage+'%',  pct:w.drainage,  color: w.drain_failed?'#f59e0b':'#6366f1' },
      { label:'Prob High', val:w.prob_high+'%', pct:w.prob_high, color: col },
    ];

    const div = document.createElement('div');
    div.className = 'ward-card';
    div.style.animationDelay = `${i*0.06}s`;
    div.innerHTML = `
      <div class="wc-top">
        <div class="wc-label"><span class="wc-ldot" style="background:${col}"></span>Top Ward · ${w.risk} RISK</div>
        <span class="wc-more">⋯</span>
      </div>
      <div class="wc-bigpct" style="color:${col}">${bigPct}%</div>
      <div class="wc-name">${w.name}</div>
      <div class="wc-meta">Pop ${fmt(w.population)} · Elev ${w.elevation}m · ${w.flood_area}km² est. flood</div>
      <div class="wc-spark">${sparkHTML}</div>
      <div class="wc-breakdown">
        ${rows.map(r=>`
          <div class="wc-brow">
            <span class="wc-bdot" style="background:${r.color}"></span>
            <span class="wc-blbl">${r.label}</span>
            <div class="wc-bbar"><div class="wc-bfill" style="width:${Math.min(r.pct,100)}%;background:${r.color}"></div></div>
            <span class="wc-bval">${r.val}</span>
          </div>`).join('')}
      </div>
      ${w.drain_failed ? `<div class="wc-drain-tag">⚡ Drain Failure Risk · Index ${w.drain_index}</div>` : ''}
    `;
    div.addEventListener('click', () => map.flyTo([w.lat,w.lon], 14, {duration:1}));
    el.appendChild(div);
  });
}

/* ═══════════════ TABLE ═══════════════ */
function renderTable(wards) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  [...wards]
    .sort((a,b)=>['HIGH','MEDIUM','LOW'].indexOf(a.risk)-['HIGH','MEDIUM','LOW'].indexOf(b.risk))
    .forEach(w => {
      const a = w.alloc;
      const fc = w.readiness>=70?'good':w.readiness>=40?'moderate':'poor';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${w.name}</td>
        <td><span class="risk-chip ${w.risk}">${w.risk}</span></td>
        <td>${a.pumps>0?`<span class="res-num">${a.pumps}</span>`:`<span class="res-nil">—</span>`}</td>
        <td>${a.teams>0?`<span class="res-num">${a.teams}</span>`:`<span class="res-nil">—</span>`}</td>
        <td>${(a.boats||0)>0?`<span class="res-num">${a.boats}</span>`:`<span class="res-nil">—</span>`}</td>
        <td><div class="rbar-row"><div class="rbar-bg"><div class="rbar-fill ${fc}" style="width:${w.readiness}%"></div></div><span class="rbar-pct">${w.readiness}%</span></div></td>
        <td><span class="${w.drain_failed?'status-fail':'status-ok'}">${w.drain_failed?'⚠ Risk':'✓ OK'}</span></td>
      `;
      tbody.appendChild(tr);
    });
}

/* ═══════════════ TIMELINE ═══════════════ */
async function loadTimeline() {
  try {
    const items = await (await fetch('/api/timeline')).json();
    const el = document.getElementById('timelineEl');
    el.innerHTML = '';
    items.forEach(item => {
      const d = document.createElement('div');
      d.className = 'tl-item';
      d.innerHTML = `
        <div class="tl-dot" style="background:${item.color}1a;border-color:${item.color}55;color:${item.color}">●</div>
        <div>
          <div class="tl-time" style="color:${item.color}">${item.time}</div>
          ${item.tasks.map(t=>`<div class="tl-task">${t}</div>`).join('')}
        </div>`;
      el.appendChild(d);
    });
  } catch(e) { console.error(e); }
}

/* ═══════════════ SIMULATION ═══════════════ */
function toggleSim() { simRunning ? stopSim() : startSim(); }

function startSim() {
  if (!data) { alert('Please run Analyze first!'); return; }
  simRunning = true; simStep = 0;
  document.getElementById('simBtn').classList.add('running');
  document.getElementById('simIcon').textContent = '⏹';
  document.getElementById('simTxt').textContent  = 'Stop Simulation';
  clearFlood(); doStep();
  simTimer = setInterval(() => { simStep++; if(simStep>=4){stopSim();return;} doStep(); }, 2800);
}
function doStep() {
  for (let i=0;i<4;i++) document.getElementById(`ss${i}`).classList.toggle('active', i<=simStep);
  if (simStep<1||!data) return;
  const r = [0,700,1500,2700][simStep];
  data.wards.filter(w=>w.risk==='HIGH').forEach(w=>{
    floodLayers.push(L.circle([w.lat,w.lon],{radius:r,color:'#ef4444',fillColor:'#ef4444',fillOpacity:0.07+simStep*0.04,weight:1.5,dashArray:simStep<3?'6 4':null}).addTo(map));
  });
  if (simStep>=2) data.wards.filter(w=>w.risk==='MEDIUM').forEach(w=>{
    floodLayers.push(L.circle([w.lat,w.lon],{radius:r*0.5,color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:0.05,weight:1,dashArray:'4 4'}).addTo(map));
  });
}
function stopSim() {
  simRunning=false; clearInterval(simTimer);
  document.getElementById('simBtn').classList.remove('running');
  document.getElementById('simIcon').textContent = '▶';
  document.getElementById('simTxt').textContent  = 'Start Simulation';
  setTimeout(()=>{ clearFlood(); for(let i=0;i<4;i++) document.getElementById(`ss${i}`).classList.remove('active'); simStep=-1; }, 2500);
}
function clearFlood() { floodLayers.forEach(l=>l.remove()); floodLayers=[]; }

/* ═══════════════ HELPERS ═══════════════ */
function set(id, v)    { const e=document.getElementById(id); if(e) e.textContent=v; }
function setHTML(id,v) { const e=document.getElementById(id); if(e) e.innerHTML=v; }
function fmt(n) { return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?Math.round(n/1000)+'K':n; }

/* ═══════════════ INIT ═══════════════ */
window.addEventListener('DOMContentLoaded', () => {
  loadTimeline();
  setTimeout(runAnalysis, 400);
});