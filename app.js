const VER = 'trishul_v6_abhishek';
const QUOTES = [
  { text: "Dream is not what you see in sleep, it is something that keeps you awake.", author: "A.P.J. Abdul Kalam" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "कर्मण्ये वाधिकारस्ते मा फलेषु कदाचन - Do your duty without worrying about results", author: "Bhagavad Gita" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" }
];

const DEFAULT_STATE = {
  name: 'Abhishek Sharma', bio: 'JEE/NEET Aspirant', aim: 'To crack the exam with top rank!',
  profilePic: '', // Stores base64 image
  goalMins: 360, minStreakMins: 60, // Set to 6 hours target
  pomFocus: 25, pomBreak: 5, pomLong: 15,
  tab: 'home', plannerTab: 'tasks', statsTab: 'week',
  lastDate: getTodayISO(), streak: 0, maxStreak: 0,
  history: {}, tasks: [], exams: [], holidays: [], schedule: [], // Custom Time Table
  tmrRun: false, tmrMode: 'focus', tmrSecs: 25 * 60, sessions: 0,
  calMonth: new Date().getMonth(), calYear: new Date().getFullYear(),
};

let STATE = { ...DEFAULT_STATE };
let TMR_INT = null;
let LAST_TICK = Date.now();
let CHART_INSTANCE = null; 

// Utils
function getTodayISO() { 
  const d = new Date(); return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; 
}
function getISO(date) { 
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; 
}
function fmtTime(mins) { 
  if(!mins) return "0m";
  let h=Math.floor(mins/60), m=Math.floor(mins%60); 
  return h>0 ? `${h}h ${m}m` : `${m}m`; 
}
function fmtSecs(secs) { 
  let m=Math.floor(secs/60), s=Math.floor(secs%60); 
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; 
}

let tOut;
function showToast(msg, color='var(--ac)') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = color;
  t.style.opacity = '1'; t.style.top = '25px';
  clearTimeout(tOut);
  tOut = setTimeout(() => { t.style.opacity = '0'; t.style.top = '10px'; }, 2500);
}

// Data Engine
function save() { 
  let s = {...STATE, tmrRun: false};
  try { localStorage.setItem(VER, JSON.stringify(s)); } 
  catch(e) { showToast("Storage Limit Reached. Clear Data.", "var(--rd)"); }
}
function load() {
  try {
    let raw = localStorage.getItem(VER);
    if(raw) {
      let parsed = JSON.parse(raw);
      STATE = {...DEFAULT_STATE, ...parsed, history: parsed.history || {}, schedule: parsed.schedule || []};
    }
  } catch(e){}
  checkDay();
  
  // Format Date for Header
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  document.getElementById('hdrDate').textContent = new Date().toLocaleDateString('en-US', dateOptions);
}

function checkDay() {
  let today = getTodayISO();
  if(!STATE.history[today]) STATE.history[today] = 0;
  
  if(STATE.lastDate && STATE.lastDate !== today) {
    let yest = new Date(); yest.setDate(yest.getDate() - 1);
    let yestISO = getISO(yest);
    
    if(STATE.lastDate === yestISO) {
      let yMins = STATE.history[yestISO] || 0;
      if(yMins >= STATE.minStreakMins || STATE.holidays.includes(yestISO)) STATE.streak++;
      else STATE.streak = 0;
    } else { STATE.streak = 0; }
    
    if(STATE.streak > STATE.maxStreak) STATE.maxStreak = STATE.streak;
    STATE.sessions = 0; 
    
    // Automatically reset Daily Time Table checkboxes on new day
    if(STATE.schedule) { STATE.schedule.forEach(s => s.done = false); }
  }
  STATE.lastDate = today; save();
}

function addTime(m) { STATE.history[getTodayISO()] += m; save(); showToast(`+${m}m Focus Logged!`, 'var(--gn)'); render(); }

// Navigation
function nav(tab) {
  STATE.tab = tab; save();
  document.querySelectorAll('.ni').forEach(el => el.classList.toggle('on', el.dataset.v === tab));
  render();
}
function setPTab(pt) { STATE.plannerTab = pt; save(); render(); }
function setSTab(st) { STATE.statsTab = st; save(); render(); }

// Chart Logic
function initChart() {
  const ctx = document.getElementById('statsChart');
  if(!ctx) return;
  if(CHART_INSTANCE) { CHART_INSTANCE.destroy(); } 

  let labels = [], data = [], totalMins = 0, activeDays = 0, totalDaysCount = 1;
  const tTab = STATE.statsTab;

  if(tTab === 'week') {
    totalDaysCount = 7;
    for(let i=6; i>=0; i--) {
      let d = new Date(); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
      let m = STATE.history[getISO(d)] || 0;
      data.push(m / 60); totalMins += m;
    }
  } else if(tTab === 'month') {
    totalDaysCount = 30;
    for(let i=29; i>=0; i--) {
      let d = new Date(); d.setDate(d.getDate()-i);
      labels.push(d.getDate());
      let m = STATE.history[getISO(d)] || 0;
      data.push(m / 60); totalMins += m;
    }
  } else if(tTab === 'quarter') {
    totalDaysCount = 90;
    for(let i=2; i>=0; i--) {
      let d = new Date(); d.setMonth(d.getMonth()-i);
      labels.push(d.toLocaleDateString('en-US', {month:'long'}));
      let monthMins = 0;
      Object.keys(STATE.history).forEach(dateStr => {
        let hDate = new Date(dateStr);
        if(hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear()) { monthMins += STATE.history[dateStr]; }
      });
      data.push(monthMins / 60); totalMins += monthMins;
    }
  }

  document.getElementById('stTotal').innerText = fmtTime(totalMins);
  document.getElementById('stAvg').innerText = fmtTime(totalMins / totalDaysCount);

  let gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');

  CHART_INSTANCE = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: gradient, borderRadius: tTab==='month'?2:6, hoverBackgroundColor: '#f5c542' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Focused: ${fmtTime(c.raw * 60)}` } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8ca0c8', callback: (v)=>v+'h' } },
        x: { grid: { display: false }, ticks: { color: '#8ca0c8' } }
      }
    }
  });
}

// Timer Logic
function getTmrTot() { return (STATE.tmrMode==='focus'?STATE.pomFocus : STATE.tmrMode==='break'?STATE.pomBreak : STATE.pomLong) * 60; }
function tglTmr() { STATE.tmrRun ? pauseTmr() : startTmr(); }
function startTmr() {
  if(TMR_INT) return;
  STATE.tmrRun = true; LAST_TICK = Date.now(); save(); upTmrUI();
  TMR_INT = setInterval(() => {
    let now = Date.now(); let dt = Math.floor((now - LAST_TICK)/1000);
    if(dt > 0) {
      STATE.tmrSecs -= dt; LAST_TICK = now;
      if(STATE.tmrSecs <= 0) compTmr(); else upTmrUI();
    }
  }, 500);
}
function pauseTmr() { clearInterval(TMR_INT); TMR_INT=null; STATE.tmrRun=false; save(); upTmrUI(); }
function rstTmr() { pauseTmr(); STATE.tmrSecs = getTmrTot(); save(); upTmrUI(); }
function compTmr() {
  pauseTmr();
  if(STATE.tmrMode === 'focus') {
    STATE.sessions++; addTime(STATE.pomFocus);
    STATE.tmrMode = (STATE.sessions % 4 === 0) ? 'long' : 'break';
    showToast('Focus Complete! Take a break.', 'var(--gn)');
  } else { STATE.tmrMode = 'focus'; showToast('Break over! Ready to focus?', 'var(--ac)'); }
  STATE.tmrSecs = getTmrTot(); save(); upTmrUI();
}
function setTmrMode(m) { pauseTmr(); STATE.tmrMode = m; STATE.tmrSecs = getTmrTot(); save(); upTmrUI(); render(); }

function upTmrUI() {
  if(STATE.tab !== 'timer') return;
  let val = document.getElementById('tVal'), rng = document.getElementById('tRing'), btn = document.getElementById('tBtn');
  if(val) val.textContent = fmtSecs(STATE.tmrSecs);
  if(rng) rng.style.strokeDashoffset = 691 - (691 * Math.max(0, STATE.tmrSecs / getTmrTot()));
  if(btn) btn.innerHTML = STATE.tmrRun ? '⏸ Pause' : '▶ Start';
}

// Global UI Function Scope for HTML Events
window.addSchRow = () => {
    let t = document.getElementById('schT').value, v = document.getElementById('schV').value;
    if(t && v) { STATE.schedule.push({id: Date.now(), time: t, task: v, done: false}); save(); render(); }
};
window.delSch = (id) => { STATE.schedule = STATE.schedule.filter(x=>x.id!==id); save(); render(); };
window.togSch = (id) => { let s=STATE.schedule.find(x=>x.id===id); if(s){ s.done=!s.done; save(); render(); }};
window.resetDailySch = () => { STATE.schedule.forEach(s => s.done = false); save(); render(); showToast('Schedule Reset for Today!'); };

window.upPic = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { STATE.profilePic = ev.target.result; save(); render(); showToast('Profile Photo Updated!'); }
    reader.readAsDataURL(file);
}

// Rendering Engine
function render() {
  const m = document.getElementById('main');
  if(STATE.tab === 'home') m.innerHTML = UI.home();
  else if(STATE.tab === 'planner') m.innerHTML = UI.planner();
  else if(STATE.tab === 'timer') { m.innerHTML = UI.timer(); upTmrUI(); }
  else if(STATE.tab === 'stats') { m.innerHTML = UI.stats(); setTimeout(initChart, 10); }
  else if(STATE.tab === 'profile') m.innerHTML = UI.profile();
}

const UI = {
  home: () => {
    let q = QUOTES[new Date().getDate() % QUOTES.length];
    let td = STATE.history[getTodayISO()] || 0;
    let pct = Math.min(100, (td / STATE.goalMins) * 100);
    
    // Time table sorting & HTML mapping
    let schHtml = '';
    STATE.schedule.sort((a,b)=>a.time.localeCompare(b.time)).forEach(s => {
        // format time nicely (e.g. 14:30 to 02:30 PM)
        let tArr = s.time.split(':'); let h = parseInt(tArr[0]), m = tArr[1];
        let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; h = h ? h : 12;
        let niceTime = `${h}:${m} ${ampm}`;

        schHtml += `
        <div class="sch-row ${s.done ? 'done' : ''}" onclick="togSch(${s.id})">
            <div class="chk-box ${s.done?'done':''}">${s.done?'✓':''}</div>
            <div class="sch-time">${niceTime}</div>
            <div class="sch-task">${s.task}</div>
            <button class="btn-glass" style="padding:4px 8px; border:none;" onclick="event.stopPropagation(); delSch(${s.id})">❌</button>
        </div>`;
    });
    if(STATE.schedule.length === 0) schHtml = `<div style="text-align:center; color:var(--dm); font-size:0.8rem; padding:10px;">No schedule added yet. Build your daily routine!</div>`;

    return `
      <div class="quote-box">
        <div class="quote-txt">"${q.text}"</div><div class="quote-auth">— ${q.author}</div>
      </div>
      <div class="cd goal-card">
        <div class="goal-ring" style="--p: ${pct}%"><div class="goal-ring-in">${Math.round(pct)}%</div></div>
        <div>
          <h3>Today's Progress</h3>
          <div style="color:var(--dm); font-size:0.85rem;">Studied: <b style="color:var(--tx)">${fmtTime(td)}</b> / ${fmtTime(STATE.goalMins)}</div>
        </div>
      </div>
      
      <!-- CUSTOM DAILY TIME TABLE -->
      <div class="cd">
        <div class="rw-between" style="margin-bottom:12px;">
            <h3 style="margin:0;">📝 My Daily Routine</h3>
            <button class="btn-glass" style="padding:4px 10px; font-size:0.75rem" onclick="resetDailySch()">🔄 Reset Day</button>
        </div>
        <div class="rw" style="margin-bottom:16px;">
            <input type="time" id="schT" style="margin:0; width:120px;">
            <input type="text" id="schV" placeholder="Subject/Task..." style="margin:0; flex:1;">
            <button class="btn btn-primary" style="padding:10px 14px;" onclick="addSchRow()">➕</button>
        </div>
        <div>${schHtml}</div>
      </div>

      <div class="cd">
        <h3>⚡ Quick Log Focus Time</h3>
        <div class="rw">
          <button class="btn btn-glass btn-full" onclick="addTime(15)">+15m</button>
          <button class="btn btn-glass btn-full" onclick="addTime(30)">+30m</button>
          <button class="btn btn-primary btn-full" onclick="addTime(60)">+1h</button>
        </div>
      </div>
    `;
  },
  
  planner: () => {
    let pt = STATE.plannerTab;
    let html = `<div class="pill-nav"><div class="pill ${pt==='tasks'?'active':''}" onclick="setPTab('tasks')">Tasks</div><div class="pill ${pt==='exams'?'active':''}" onclick="setPTab('exams')">Exams</div><div class="pill ${pt==='cal'?'active':''}" onclick="setPTab('cal')">Calendar</div></div>`;
    
    if(pt === 'tasks') {
      window.addTask = () => { let v=document.getElementById('ti').value, p=document.getElementById('tp').value; if(v){ STATE.tasks.push({id:Date.now(), t:v, p, d:false}); save(); render(); }};
      window.tgTask = (id) => { let t=STATE.tasks.find(x=>x.id===id); if(t){ t.d=!t.d; save(); render(); }};
      window.dlTask = (id) => { STATE.tasks=STATE.tasks.filter(x=>x.id!==id); save(); render(); };
      html += `<div class="cd"><div class="rw"><input id="ti" placeholder="To-Do List..." style="margin:0"><select id="tp" style="width:100px;margin:0"><option value="red">High</option><option value="orange">Med</option><option value="green">Low</option></select></div><button class="btn btn-primary btn-full" style="margin-top:12px" onclick="addTask()">Add Task</button></div>`;
      let pnd = STATE.tasks.filter(t=>!t.d); let dn = STATE.tasks.filter(t=>t.d);
      pnd.forEach(t => { html += `<div class="item-row"><div class="prio-line" style="background:${t.p}"></div><div class="chk-box" onclick="tgTask(${t.id})"></div><div class="task-txt">${t.t}</div><button class="btn-glass" style="padding:4px 8px;border:none" onclick="dlTask(${t.id})">❌</button></div>`; });
      if(dn.length) { html += `<h4 style="margin:20px 0 10px; color:var(--dm)">Completed</h4>`; dn.forEach(t => { html += `<div class="item-row" style="opacity:0.6"><div class="chk-box done" onclick="tgTask(${t.id})">✓</div><div class="task-txt done">${t.t}</div><button class="btn-glass" style="padding:4px 8px;border:none" onclick="dlTask(${t.id})">❌</button></div>`; });}
    } else if(pt === 'exams') {
      window.addEx = () => { let n=document.getElementById('en').value, d=document.getElementById('ed').value; if(n&&d){ STATE.exams.push({id:Date.now(), n, d}); save(); render(); }};
      window.dlEx = (id) => { STATE.exams=STATE.exams.filter(x=>x.id!==id); save(); render(); };
      html += `<div class="cd"><input id="en" placeholder="Exam Name"><input type="date" id="ed"><button class="btn btn-primary btn-full" onclick="addEx()">Save Exam</button></div>`;
      STATE.exams.sort((a,b)=>new Date(a.d)-new Date(b.d)).forEach(e => {
        let days = Math.ceil((new Date(e.d) - new Date(getTodayISO())) / 86400000);
        html += `<div class="item-row"><div style="flex:1"><div style="font-weight:700">${e.n}</div><div style="font-size:0.75rem;color:var(--dm)">${e.d}</div></div><div style="font-weight:900;color:${days<3?'var(--rd)':'var(--gd)'}">${days<0?'Past':days+'d'}</div><button class="btn-glass" style="padding:4px 8px;border:none" onclick="dlEx(${e.id})">❌</button></div>`;
      });
    } else if(pt === 'cal') {
      window.chM = (d) => { STATE.calMonth+=d; if(STATE.calMonth>11){STATE.calMonth=0;STATE.calYear++;} else if(STATE.calMonth<0){STATE.calMonth=11;STATE.calYear--;} save(); render(); };
      window.tgH = (iso) => { if(STATE.holidays.includes(iso)) STATE.holidays=STATE.holidays.filter(h=>h!==iso); else STATE.holidays.push(iso); checkDay(); render(); };
      let m=STATE.calMonth, y=STATE.calYear;
      let dIM = new Date(y, m+1, 0).getDate(), fD = new Date(y, m, 1).getDay();
      let mN = new Date(y, m, 1).toLocaleString('default', {month:'long'});
      let ch = `<div class="rw-between" style="margin-bottom:12px"><button class="btn-glass" style="padding:4px 12px" onclick="chM(-1)">◀</button><h4 style="margin:0">${mN} ${y}</h4><button class="btn-glass" style="padding:4px 12px" onclick="chM(1)">▶</button></div>`;
      ch += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:0.7rem;color:var(--dm);margin-bottom:8px"><div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">`;
      for(let i=0; i<fD; i++) ch+= `<div></div>`;
      for(let i=1; i<=dIM; i++) {
        let dObj = new Date(y, m, i); dObj = new Date(dObj.getTime() - (dObj.getTimezoneOffset()*60000));
        let iso = dObj.toISOString().split('T')[0];
        let hG = (STATE.history[iso]||0) >= STATE.minStreakMins, isH = STATE.holidays.includes(iso), ex = STATE.exams.some(e=>e.d===iso), isT = iso===getTodayISO();
        let style = `aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:0.8rem;border:1px solid ${isT?'var(--gd)':'var(--ln)'};cursor:pointer;position:relative;`;
        if(isH) style += `background:rgba(239,68,68,0.2);color:var(--rd);`; else if(hG) style += `background:rgba(16,185,129,0.2);color:var(--gn);`;
        ch += `<div style="${style}" onclick="tgH('${iso}')">${i}${ex?`<div style="position:absolute;bottom:2px;width:4px;height:4px;background:var(--ac);border-radius:50%"></div>`:''}</div>`;
      }
      ch += `</div><div style="text-align:center;font-size:0.7rem;color:var(--dm);margin-top:12px">Tap a day to mark/unmark Holiday</div>`;
      html += `<div class="cd">${ch}</div>`;
    }
    return html;
  },

  timer: () => {
    let m = STATE.tmrMode; let clr = m==='focus' ? 'var(--ac)' : m==='break' ? 'var(--gn)' : 'var(--bl)';
    let dots = ''; for(let i=1; i<=4; i++) dots += `<div class="s-dot ${(STATE.sessions % 4) >= i || (STATE.sessions>0 && STATE.sessions%4===0) ? 'done' : ''}" style="${((STATE.sessions % 4) >= i || (STATE.sessions>0 && STATE.sessions%4===0))?`--ac:${clr}`:''}"></div>`;
    return `
      <div class="pill-nav"><div class="pill ${m==='focus'?'active':''}" onclick="setTmrMode('focus')">Focus</div><div class="pill ${m==='break'?'active':''}" onclick="setTmrMode('break')">Break</div><div class="pill ${m==='long'?'active':''}" onclick="setTmrMode('long')">L-Break</div></div>
      <div class="cd timer-wrap">
        <svg class="svg-ring" width="240" height="240"><circle class="svg-circle-bg" stroke-width="8" fill="transparent" r="110" cx="120" cy="120"/><circle id="tRing" class="svg-circle-prog" stroke-width="8" fill="transparent" r="110" cx="120" cy="120" style="stroke:${clr}"/></svg>
        <div class="timer-content"><div id="tVal" class="timer-val">${fmtSecs(STATE.tmrSecs)}</div><div class="timer-mode-txt" style="color:${clr}">${m==='focus'?'Stay Focused':'Relax'}</div></div>
      </div>
      <div class="session-dots">${dots}</div><div style="text-align:center;font-size:0.75rem;color:var(--dm);margin-bottom:24px;margin-top:8px">Sessions Complete: ${STATE.sessions}</div>
      <div class="rw"><button class="btn btn-glass" style="width:30%" onclick="rstTmr()">⏹</button><button id="tBtn" class="btn btn-primary" style="width:70%; background:${clr}; box-shadow:0 4px 15px ${clr}40" onclick="tglTmr()">${STATE.tmrRun?'⏸ Pause':'▶ Start'}</button></div>
    `;
  },

  stats: () => {
    let st = STATE.statsTab;
    return `
      <div class="cd" style="text-align:center; display:flex; align-items:center; justify-content:center; gap:16px;">
        <div style="font-size:3.5rem;font-weight:900;background:linear-gradient(135deg,var(--gd),var(--or));-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1">${STATE.streak}</div>
        <div style="text-align:left;"><h3 style="margin-bottom:0;">Day Streak 🔥</h3><div style="font-size:0.8rem;color:var(--dm)">Max All-Time: <b>${STATE.maxStreak} Days</b></div></div>
      </div>
      <div class="pill-nav"><div class="pill ${st==='week'?'active':''}" onclick="setSTab('week')">7 Days</div><div class="pill ${st==='month'?'active':''}" onclick="setSTab('month')">30 Days</div><div class="pill ${st==='quarter'?'active':''}" onclick="setSTab('quarter')">Quarter</div></div>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-lbl">Total Focus</div><div class="stat-val" id="stTotal">0h</div></div>
        <div class="stat-box"><div class="stat-lbl">Daily Avg</div><div class="stat-val" id="stAvg" style="color:var(--ac)">0h</div></div>
      </div>
      <div class="cd" style="padding-bottom:10px;"><h3 style="margin-bottom:16px;">📈 Study Analytics</h3><div style="position: relative; height: 250px; width: 100%;"><canvas id="statsChart"></canvas></div></div>
    `;
  },

  profile: () => {
    window.svProf = () => {
      STATE.name = document.getElementById('pn').value || 'Abhishek Sharma';
      STATE.bio = document.getElementById('pBio').value;
      STATE.aim = document.getElementById('pAim').value;
      STATE.goalMins = (Number(document.getElementById('pg').value)||4) * 60;
      STATE.minStreakMins = (Number(document.getElementById('ps').value)||1) * 60;
      STATE.pomFocus = Number(document.getElementById('pf').value)||25;
      STATE.pomBreak = Number(document.getElementById('pb').value)||5;
      STATE.pomLong = Number(document.getElementById('pl').value)||15;
      if(!STATE.tmrRun) STATE.tmrSecs = getTmrTot();
      save(); showToast('Profile & Settings Saved!', 'var(--gn)'); render();
    };
    
    let defaultImg = '<div style="color:var(--tx); font-size:2.5rem;">👤</div>';
    let picHtml = STATE.profilePic ? `<img src="${STATE.profilePic}">` : defaultImg;

    return `
      <div class="profile-hdr">
        <label class="prof-pic-wrap">
            <div class="prof-pic">${picHtml}</div>
            <div class="upload-btn">📷</div>
            <input type="file" accept="image/*" style="display:none" onchange="upPic(event)">
        </label>
        <div style="text-align:center;">
           <h2 style="font-family:'Caveat',cursive; font-size:2rem; color:var(--gd); margin-bottom:2px;">${STATE.name}</h2>
        </div>
      </div>

      <div class="cd">
        <h3>📝 My Identity & Goals</h3>
        <label style="font-size:0.75rem; color:var(--dm)">Full Name</label>
        <input id="pn" placeholder="Your Name" value="${STATE.name}">
        <label style="font-size:0.75rem; color:var(--dm)">Bio / About Me</label>
        <textarea id="pBio" placeholder="E.g., Dropper, Preparing for 2027...">${STATE.bio}</textarea>
        <label style="font-size:0.75rem; color:var(--dm)">My Ultimate Aim / Motivation</label>
        <textarea id="pAim" placeholder="E.g., To get AIR Under 100 in JEE Advanced...">${STATE.aim}</textarea>
      </div>

      <div class="cd">
        <h3>🎯 Goal Configurations</h3>
        <div class="rw">
          <div style="flex:1"><label style="font-size:0.7rem;color:var(--dm)">Daily Target (hrs)</label><input id="pg" type="number" step="0.5" value="${STATE.goalMins/60}"></div>
          <div style="flex:1"><label style="font-size:0.7rem;color:var(--dm)">Min for Streak (hrs)</label><input id="ps" type="number" step="0.5" value="${STATE.minStreakMins/60}"></div>
        </div>
      </div>
      
      <div class="cd">
        <h3>⏱️ Pomodoro Settings</h3>
        <div class="rw">
          <div><label style="font-size:0.7rem;color:var(--dm)">Focus (m)</label><input id="pf" type="number" value="${STATE.pomFocus}"></div>
          <div><label style="font-size:0.7rem;color:var(--dm)">Break (m)</label><input id="pb" type="number" value="${STATE.pomBreak}"></div>
          <div><label style="font-size:0.7rem;color:var(--dm)">Long (m)</label><input id="pl" type="number" value="${STATE.pomLong}"></div>
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:10px" onclick="svProf()">💾 Save Profile & Settings</button>
      </div>
    `;
  }
};

window.onload = () => { load(); render(); };