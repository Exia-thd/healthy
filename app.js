// ============================================================
// WORKOUT TRACKER — App Logic
// ============================================================

/* ---- Storage keys ---- */
const STORAGE_KEY = 'wt_logs';       // { "YYYY-MM-DD": { dayIdx, sets: {setId: {done, reps}}, completed } }
const STORAGE_STREAK = 'wt_streak';  // { count, lastDate }

/* ---- State ---- */
let currentDayIdx = null;   // JS day index 0-6
let expandedExercise = null;
let currentView = 'day';   // 'day' | 'stats' | 'history'

let timerState = null; // { config, round, phase, remaining, total, interval, paused }

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  currentDayIdx = new Date().getDay();
  renderHeader();
  renderWeeklyBar();
  renderDayView(currentDayIdx);
  renderStats();
  renderHistory();
  setupNavButtons();
  updateStreak();
});

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
function getLogs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getDayLog(dayIdx, dateKey) {
  const logs = getLogs();
  const key = dateKey || getTodayKey();
  return logs[key] || { dayIdx, sets: {}, completed: false };
}
function saveDayLog(dayIdx, log, dateKey) {
  const logs = getLogs();
  const key = dateKey || getTodayKey();
  logs[key] = { ...log, dayIdx };
  saveLogs(logs);
}

/* ============================================================
   STREAK
   ============================================================ */
function updateStreak() {
  const logs = getLogs();
  const today = getTodayKey();

  // Count consecutive days (backwards from today) with at least one completed workout
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = getDateKey(d);
    const log = logs[key];
    // Rest day (CN) counts as maintaining streak
    const dayIdx = d.getDay();
    if (SCHEDULE[dayIdx]?.type === 'rest') {
      d.setDate(d.getDate() - 1);
      streak++;
      continue;
    }
    if (log && log.completed) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      // Today not done yet — streak from yesterday
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  document.getElementById('streak-count').textContent = streak;
}

/* ============================================================
   HEADER
   ============================================================ */
function renderHeader() {
  const days = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  const d = new Date();
  const dateStr = `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  document.getElementById('today-label').textContent = `Hôm nay: ${dateStr}`;
}

/* ============================================================
   WEEKLY BAR
   ============================================================ */
function renderWeeklyBar() {
  const bar = document.getElementById('week-days');
  bar.innerHTML = '';
  const logs = getLogs();
  const todayKey = getTodayKey();
  const todayIdx = new Date().getDay();

  DAY_ORDER.forEach(idx => {
    const day = SCHEDULE[idx];
    const pill = document.createElement('div');
    pill.className = 'day-pill';
    if (idx === currentDayIdx) pill.classList.add('active');
    if (idx === todayIdx) pill.classList.add('today');

    // Check if done — look at this week's occurrence
    const dateForDay = getThisWeekDate(idx);
    const key = getDateKey(dateForDay);
    const log = logs[key];
    if (log && log.completed) pill.classList.add('done');

    // color accent
    pill.style.setProperty('--day-color', day.color);
    if (idx === currentDayIdx) {
      pill.style.borderColor = day.color;
      pill.style.background = hexToRgba(day.color, 0.12);
    }

    pill.innerHTML = `
      <div class="pill-icon">${day.icon}</div>
      <div class="pill-label" style="color:${idx === currentDayIdx ? day.color : ''}">${day.label}</div>
      <div class="pill-dot" style="background:${log && log.completed ? day.color : ''}"></div>
    `;
    pill.addEventListener('click', () => {
      currentDayIdx = idx;
      renderWeeklyBar();
      renderDayView(idx);
      showView('day');
    });
    bar.appendChild(pill);
  });
}

function getThisWeekDate(targetDayIdx) {
  const today = new Date();
  const todayIdx = today.getDay();
  const diff = targetDayIdx - todayIdx;
  const d = new Date(today);
  d.setDate(d.getDate() + diff);
  return d;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============================================================
   NAV BUTTONS
   ============================================================ */
function setupNavButtons() {
  const btnStats = document.getElementById('btn-stats');
  const btnHistory = document.getElementById('btn-history');

  btnStats.addEventListener('click', () => {
    if (currentView === 'stats') { showView('day'); btnStats.classList.remove('active'); return; }
    showView('stats');
    btnStats.classList.add('active');
    btnHistory.classList.remove('active');
    renderStats();
  });
  btnHistory.addEventListener('click', () => {
    if (currentView === 'history') { showView('day'); btnHistory.classList.remove('active'); return; }
    showView('history');
    btnHistory.classList.add('active');
    btnStats.classList.remove('active');
    renderHistory();
  });
}

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

/* ============================================================
   DAY VIEW
   ============================================================ */
function renderDayView(dayIdx) {
  const day = SCHEDULE[dayIdx];
  const dateForDay = getThisWeekDate(dayIdx);
  const dateKey = getDateKey(dateForDay);
  const log = getDayLog(dayIdx, dateKey);

  renderDayHeader(day, log, dateKey);
  renderExercises(day, log, dayIdx, dateKey);
  renderDayActions(day, log, dayIdx, dateKey);
}

function renderDayHeader(day, log, dateKey) {
  const el = document.getElementById('day-header');
  el.style.background = `linear-gradient(135deg, ${hexToRgba(day.color, 0.25)}, ${hexToRgba(day.color, 0.08)})`;
  el.style.borderBottom = `2px solid ${hexToRgba(day.color, 0.4)}`;

  // Calculate total sets & done sets
  const { total, done } = countSets(day, log);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const typeLabels = { strength: 'Sức Mạnh', recovery: 'Phục Hồi', circuit: 'Circuit', cardio: 'Cardio', rest: 'Nghỉ Ngơi' };

  el.innerHTML = `
    <div class="day-header-content">
      <div class="day-header-top">
        <div class="day-header-icon">${day.icon}</div>
        <div class="day-header-badge" style="color:${day.color}">${typeLabels[day.type] || day.type}</div>
      </div>
      <div class="day-header-title">${day.day}</div>
      <div class="day-header-focus">${day.focus}</div>
      ${total > 0 ? `
      <div class="day-header-progress">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="progress-text">${done}/${total} sets</div>
      </div>` : ''}
    </div>
  `;
}

function countSets(day, log) {
  let total = 0, done = 0;
  day.exercises.forEach(ex => {
    ex.sets.forEach((s, si) => {
      total++;
      const setId = `${ex.id}_s${si}`;
      if (log.sets && log.sets[setId] && log.sets[setId].done) done++;
    });
  });
  return { total, done };
}

function renderExercises(day, log, dayIdx, dateKey) {
  const el = document.getElementById('exercises-list');
  el.innerHTML = '';

  if (day.type === 'rest') {
    el.innerHTML = `
      <div class="rest-card">
        <div class="rest-icon">😴</div>
        <h2>Ngày Nghỉ Ngơi</h2>
        <p>Ngủ đủ giấc, đi dạo nhẹ nhàng, nạp năng lượng.<br>Cơ bắp phát triển trong lúc nghỉ ngơi!</p>
      </div>
    `;
    return;
  }

  if (day.circuitNote) {
    const note = document.createElement('div');
    note.className = 'circuit-note';
    note.innerHTML = `<span class="cn-icon">⚡</span><span>${day.circuitNote}</span>`;
    el.appendChild(note);
  }

  day.exercises.forEach((ex, exIdx) => {
    const card = buildExerciseCard(ex, exIdx, log, day, dayIdx, dateKey);
    el.appendChild(card);
  });
}

function buildExerciseCard(ex, exIdx, log, day, dayIdx, dateKey) {
  const card = document.createElement('div');
  card.className = 'exercise-card';
  card.dataset.exId = ex.id;

  // Check if all sets done
  const allDone = ex.sets.length > 0 && ex.sets.every((s, si) => {
    const setId = `${ex.id}_s${si}`;
    return log.sets && log.sets[setId] && log.sets[setId].done;
  });
  if (allDone) card.classList.add('completed');

  const setsSummary = ex.timerConfig
    ? `${ex.timerConfig.rounds} vòng interval`
    : ex.sets.length > 0
      ? `${ex.sets.length} hiệp`
      : '';

  card.innerHTML = `
    <div class="exercise-header">
      <div class="exercise-number">${allDone ? '✓' : exIdx + 1}</div>
      <div class="exercise-info">
        <div class="exercise-name">${ex.name}</div>
        ${ex.tool ? `<div class="exercise-tool">${ex.tool}</div>` : ''}
        ${ex.note ? `<div class="exercise-note">${ex.note}</div>` : ''}
      </div>
      <div class="exercise-meta">
        ${setsSummary ? `<div class="sets-badge">${setsSummary}</div>` : ''}
        <div class="exercise-expand">▼</div>
      </div>
    </div>
    <div class="exercise-sets" id="sets-${ex.id}">
      ${buildSetsHTML(ex, log)}
    </div>
  `;

  // Toggle expand
  const header = card.querySelector('.exercise-header');
  header.addEventListener('click', () => toggleExercise(ex.id));

  // Auto-expand today's exercises & the first incomplete
  if (expandedExercise === ex.id || (expandedExercise === null && !allDone)) {
    card.querySelector('.exercise-sets').classList.add('open');
    if (expandedExercise === null) expandedExercise = ex.id;
  }

  // Bind set checkboxes
  const setsEl = card.querySelector(`#sets-${ex.id}`);
  setsEl.querySelectorAll('.set-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const setId = btn.dataset.setId;
      toggleSet(setId, ex, dayIdx, dateKey, log);
    });
  });

  // Bind reps inputs
  setsEl.querySelectorAll('.set-reps-input').forEach(input => {
    input.addEventListener('change', () => {
      const setId = input.dataset.setId;
      const freshLog = getDayLog(dayIdx, dateKey);
      if (!freshLog.sets) freshLog.sets = {};
      if (!freshLog.sets[setId]) freshLog.sets[setId] = { done: false };
      freshLog.sets[setId].reps = input.value;
      saveDayLog(dayIdx, freshLog, dateKey);
    });
  });

  // Timer button
  if (ex.timerConfig) {
    setsEl.querySelector('.timer-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startIntervalTimer(ex.timerConfig, ex.name);
    });
  }

  // Countdown buttons (single timed sets)
  setsEl.querySelectorAll('.countdown-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = parseInt(btn.dataset.sec);
      const label = btn.dataset.label;
      startCountdown(sec, label);
    });
  });

  return card;
}

function buildSetsHTML(ex, log) {
  if (ex.timerConfig) {
    const cfg = ex.timerConfig;
    return `
      <div class="sets-grid">
        <button class="timer-btn">
          ▶ Bắt đầu ${cfg.rounds} vòng — ${cfg.workSec}s tập / ${cfg.restSec}s nghỉ
        </button>
      </div>
    `;
  }

  if (ex.sets.length === 0) return '<p style="color:var(--text2);font-size:.83rem;padding:4px 0">Không có set cụ thể.</p>';

  const rows = ex.sets.map((s, si) => {
    const setId = `${ex.id}_s${si}`;
    const setLog = log.sets && log.sets[setId];
    const isDone = setLog && setLog.done;
    const savedReps = setLog && setLog.reps ? setLog.reps : '';

    const isTimed = s.type === 'timed';
    const repsInput = s.target !== null && !isTimed
      ? `<input class="set-reps-input" type="number" min="0" max="999" placeholder="${s.target}" value="${savedReps}" data-set-id="${setId}" title="Nhập số lần thực tế" />`
      : '';

    const countdownBtn = isTimed
      ? `<button class="countdown-btn" data-sec="${s.duration}" data-label="${ex.name}">⏱ ${s.label}</button>`
      : '';

    return `
      <div class="set-row ${isDone ? 'checked' : ''}" id="row-${setId}">
        <div class="set-check" data-set-id="${setId}">${isDone ? '✓' : ''}</div>
        <div class="set-label">Hiệp ${si + 1} — ${s.label}</div>
        ${repsInput}
        ${countdownBtn}
      </div>
    `;
  }).join('');

  return `<div class="sets-grid">${rows}</div>`;
}

function toggleExercise(exId) {
  const setsEl = document.getElementById(`sets-${exId}`);
  if (!setsEl) return;
  const isOpen = setsEl.classList.contains('open');
  // Close all
  document.querySelectorAll('.exercise-sets').forEach(el => el.classList.remove('open'));
  if (!isOpen) {
    setsEl.classList.add('open');
    expandedExercise = exId;
  } else {
    expandedExercise = null;
  }
}

function toggleSet(setId, ex, dayIdx, dateKey, currentLog) {
  const freshLog = getDayLog(dayIdx, dateKey);
  if (!freshLog.sets) freshLog.sets = {};
  if (!freshLog.sets[setId]) freshLog.sets[setId] = { done: false };
  freshLog.sets[setId].done = !freshLog.sets[setId].done;
  saveDayLog(dayIdx, freshLog, dateKey);

  // Re-render
  expandedExercise = ex.id;
  renderDayView(dayIdx);
  renderWeeklyBar();
}

function renderDayActions(day, log, dayIdx, dateKey) {
  const el = document.getElementById('day-actions');
  if (day.type === 'rest') { el.innerHTML = ''; return; }

  const { total, done } = countSets(day, log);
  const isCompleted = log.completed;

  el.innerHTML = `
    <button class="btn-complete ${isCompleted ? 'done-btn' : 'incomplete'}" id="btn-complete-day">
      ${isCompleted ? '✅ Đã hoàn thành hôm nay!' : `🎯 Đánh dấu hoàn thành (${done}/${total} sets)`}
    </button>
  `;
  document.getElementById('btn-complete-day').addEventListener('click', () => {
    toggleDayComplete(dayIdx, dateKey, !isCompleted);
  });
}

function toggleDayComplete(dayIdx, dateKey, markDone) {
  const log = getDayLog(dayIdx, dateKey);
  log.completed = markDone;
  saveDayLog(dayIdx, log, dateKey);
  updateStreak();
  renderWeeklyBar();
  renderDayView(dayIdx);
  if (markDone) showToast('🎉 Tuyệt vời! Buổi tập hoàn thành!');
  else showToast('Đã bỏ đánh dấu hoàn thành.');
}

/* ============================================================
   INTERVAL TIMER
   ============================================================ */
function startIntervalTimer(config, name) {
  if (timerState && timerState.interval) clearInterval(timerState.interval);

  const modal = document.getElementById('timer-modal');
  document.getElementById('timer-title').textContent = name;

  timerState = {
    config,
    round: 0,
    phase: 'countdown', // countdown → work → rest → ...
    remaining: 3,
    total: 3,
    paused: false,
    interval: null,
  };

  modal.style.display = 'flex';
  updateTimerDisplay();
  timerState.interval = setInterval(tickTimer, 1000);

  document.getElementById('timer-pause').onclick = () => {
    timerState.paused = !timerState.paused;
    document.getElementById('timer-pause').textContent = timerState.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
  };
  document.getElementById('timer-stop').onclick = stopTimer;
}

function startCountdown(sec, label) {
  if (timerState && timerState.interval) clearInterval(timerState.interval);

  const modal = document.getElementById('timer-modal');
  document.getElementById('timer-title').textContent = label;

  timerState = {
    config: null,
    round: 1,
    phase: 'work',
    remaining: sec,
    total: sec,
    paused: false,
    interval: null,
  };

  modal.style.display = 'flex';
  updateTimerDisplay();
  timerState.interval = setInterval(tickTimer, 1000);

  document.getElementById('timer-pause').onclick = () => {
    timerState.paused = !timerState.paused;
    document.getElementById('timer-pause').textContent = timerState.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
  };
  document.getElementById('timer-stop').onclick = stopTimer;
}

function tickTimer() {
  if (timerState.paused) return;

  timerState.remaining--;
  if (timerState.remaining <= 0) {
    advanceTimerPhase();
  }
  updateTimerDisplay();
}

function advanceTimerPhase() {
  const { config } = timerState;

  if (!config) {
    // Simple countdown done
    stopTimer();
    showToast('✅ Xong!');
    return;
  }

  if (timerState.phase === 'countdown') {
    timerState.phase = 'work';
    timerState.round = 1;
    timerState.remaining = config.workSec;
    timerState.total = config.workSec;
    playBeep('high');
  } else if (timerState.phase === 'work') {
    if (timerState.round >= config.rounds) {
      stopTimer();
      showToast('🎉 Hoàn thành tất cả vòng!');
      return;
    }
    timerState.phase = 'rest';
    timerState.remaining = config.restSec;
    timerState.total = config.restSec;
    playBeep('low');
  } else if (timerState.phase === 'rest') {
    timerState.phase = 'work';
    timerState.round++;
    timerState.remaining = config.workSec;
    timerState.total = config.workSec;
    playBeep('high');
  }
}

function updateTimerDisplay() {
  const { remaining, total, phase, round, config } = timerState;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  document.getElementById('timer-display').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  const phaseEl = document.getElementById('timer-phase');
  const barEl = document.getElementById('timer-bar');
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  if (phase === 'countdown') {
    phaseEl.textContent = `Chuẩn bị... ${remaining}`;
    phaseEl.className = 'timer-phase countdown';
    barEl.className = 'timer-bar-fill';
    document.getElementById('timer-round').textContent = '';
  } else if (phase === 'work') {
    phaseEl.textContent = config ? config.workLabel : '⏱ Đang chạy...';
    phaseEl.className = 'timer-phase work';
    barEl.className = 'timer-bar-fill work';
    document.getElementById('timer-round').textContent =
      config ? `Vòng ${round} / ${config.rounds}` : '';
  } else if (phase === 'rest') {
    phaseEl.textContent = config ? config.restLabel : '😮‍💨 Nghỉ';
    phaseEl.className = 'timer-phase rest';
    barEl.className = 'timer-bar-fill rest';
    document.getElementById('timer-round').textContent =
      config ? `Vòng ${round} / ${config.rounds} — Nghỉ` : '';
  }

  barEl.style.width = `${pct}%`;
}

function stopTimer() {
  if (timerState && timerState.interval) clearInterval(timerState.interval);
  timerState = null;
  document.getElementById('timer-modal').style.display = 'none';
}

/* Simple beep using Web Audio API */
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'high' ? 880 : 440;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}

/* ============================================================
   STATS VIEW
   ============================================================ */
function renderStats() {
  const el = document.getElementById('stats-grid');
  const logs = getLogs();

  const entries = Object.entries(logs);
  const totalWorkouts = entries.filter(([,v]) => v.completed).length;
  const totalSets = entries.reduce((acc, [,v]) => {
    if (!v.sets) return acc;
    return acc + Object.values(v.sets).filter(s => s.done).length;
  }, 0);

  // This week's completion
  const weekDone = DAY_ORDER.filter(idx => {
    const d = getThisWeekDate(idx);
    const key = getDateKey(d);
    return logs[key] && logs[key].completed;
  }).length;

  const streak = parseInt(document.getElementById('streak-count').textContent) || 0;

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">🏋️</div>
      <div class="stat-value" style="color:var(--accent)">${totalWorkouts}</div>
      <div class="stat-label">Buổi tập hoàn thành</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div class="stat-value" style="color:var(--green)">${totalSets}</div>
      <div class="stat-label">Tổng số sets đã làm</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🔥</div>
      <div class="stat-value" style="color:var(--orange)">${streak}</div>
      <div class="stat-label">Chuỗi ngày hiện tại</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📅</div>
      <div class="stat-value" style="color:var(--yellow)">${weekDone}</div>
      <div class="stat-label">Tuần này đã tập</div>
    </div>
    <div class="stat-card wide">
      <div class="stat-icon">📊</div>
      <div class="stat-label" style="margin-bottom:4px;font-size:.82rem;color:var(--text2)">Tuần này</div>
      <div class="week-heatmap" id="week-heatmap"></div>
    </div>
    <div class="stat-card wide">
      <div class="stat-icon">🗓</div>
      <div class="stat-label" style="margin-bottom:4px;font-size:.82rem;color:var(--text2)">Tháng ${new Date().getMonth()+1}/${new Date().getFullYear()}</div>
      <div class="month-cal" id="month-cal"></div>
    </div>
  `;

  renderWeekHeatmap(logs);
  renderMonthCal(logs);
}

function renderWeekHeatmap(logs) {
  const el = document.getElementById('week-heatmap');
  if (!el) return;
  DAY_ORDER.forEach(idx => {
    const day = SCHEDULE[idx];
    const d = getThisWeekDate(idx);
    const key = getDateKey(d);
    const log = logs[key];
    const isDone = log && log.completed;
    const isRest = day.type === 'rest';

    const cell = document.createElement('div');
    cell.className = `heat-cell${isDone ? ' done' : ''}${isRest ? ' rest-day' : ''}`;
    cell.innerHTML = `
      <span style="font-size:14px">${day.icon}</span>
      <span>${day.label}</span>
    `;
    el.appendChild(cell);
  });
}

function renderMonthCal(logs) {
  const el = document.getElementById('month-cal');
  if (!el) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();

  const dayLabels = ['CN','T2','T3','T4','T5','T6','T7'];
  let html = '<div class="month-cal-grid">';
  dayLabels.forEach(l => { html += `<div class="month-cal-header">${l}</div>`; });

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const log = logs[key];
    const isToday = d === todayDate;
    const hasDone = log && log.completed;
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    else if (hasDone) cls += ' has-workout';
    html += `<div class="${cls}">${d}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

/* ============================================================
   HISTORY VIEW
   ============================================================ */
function renderHistory() {
  const el = document.getElementById('history-list');
  const logs = getLogs();

  const entries = Object.entries(logs)
    .filter(([,v]) => v.completed || (v.sets && Object.values(v.sets).some(s => s.done)))
    .sort(([a],[b]) => b.localeCompare(a))
    .slice(0, 60);

  if (entries.length === 0) {
    el.innerHTML = `
      <div class="history-empty">
        <div class="he-icon">📭</div>
        <p>Chưa có buổi tập nào được ghi lại.<br>Hãy bắt đầu tập và đánh dấu hoàn thành!</p>
      </div>
    `;
    return;
  }

  el.innerHTML = '';
  entries.forEach(([dateKey, log]) => {
    const daySchedule = SCHEDULE[log.dayIdx];
    if (!daySchedule) return;

    const doneSets = log.sets ? Object.values(log.sets).filter(s => s.done).length : 0;
    const [y,m,d] = dateKey.split('-');

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-day-badge" style="background:${hexToRgba(daySchedule.color,0.15)};color:${daySchedule.color}">
        <span style="font-size:20px">${daySchedule.icon}</span>
        <span style="font-size:0.7rem;font-weight:700">${daySchedule.label}</span>
      </div>
      <div class="history-info">
        <div class="history-date">${d}/${m}/${y}</div>
        <div class="history-focus">${daySchedule.focus}</div>
        <div class="history-sets">${doneSets} sets đã hoàn thành</div>
      </div>
      <div class="history-status">${log.completed ? '✅' : '🔄'}</div>
    `;
    el.appendChild(item);
  });
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}
