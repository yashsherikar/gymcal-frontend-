/* ═══════════════════════════════════════════
   GYMCAL FRONTEND — app.js
   Premium AI Nutrition Tracker
═══════════════════════════════════════════ */

// ── CONFIG ──
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://gymcal-backend-1.onrender.com/api';

// ── STATE ──
let token = localStorage.getItem('gymcal_token') || null;
let userData = null;
let currentFood = null;
let dailySummary = null;

// ── ANIMATED BACKGROUND ──
(function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((W * H) / 18000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        color: Math.random() > 0.7 ? '#b9ff4b' : Math.random() > 0.5 ? '#4bf5ff' : '#a78bfa'
      });
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(185,255,75,0.02)';
    ctx.lineWidth = 1;
    const size = 60;
    for (let x = 0; x < W; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    requestAnimationFrame(animate);
  }

  resize(); createParticles(); animate();
  window.addEventListener('resize', () => { resize(); createParticles(); });
})();

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  if (token) showApp();

  // Enter key on food search
  setTimeout(() => {
    const inp = document.getElementById('food-name-input');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') searchFood(); });
    const loginPwd = document.getElementById('login-password');
    if (loginPwd) loginPwd.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  }, 300);
});

function updateGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning 👋' : h < 17 ? 'Good Afternoon 👋' : 'Good Evening 👋';
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = greet;
  const dateEl = document.getElementById('greeting-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}

// ════════════════════════════════
// API HELPER
// ════════════════════════════════
async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  // Safe JSON parse — won't crash on empty body or HTML error pages
  let data = {};
  const text = await res.text();
  if (text && text.trim().length > 0) {
    try { data = JSON.parse(text); } catch(_) { data = { error: text.substring(0, 200) }; }
  }
  if (!res.ok) throw new Error(data.error || data.message || `Server error (HTTP ${res.status})`);
  return data;
}

// ════════════════════════════════
// AUTH
// ════════════════════════════════
function toggleAuth(mode) {
  document.getElementById('login-form').classList.toggle('hidden', mode === 'register');
  document.getElementById('register-form').classList.toggle('hidden', mode !== 'register');
}

function selectGoal(el) {
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.querySelector('#login-form .btn-primary');
  if (!email || !password) { showError(errEl, 'Please fill in all fields.'); return; }
  setLoading(btn, true); errEl.classList.add('hidden');
  try {
    const data = await api('POST', '/auth/login', { email, password });
    token = data.token;
    localStorage.setItem('gymcal_token', token);
    userData = data;
    showApp();
  } catch (e) {
    showError(errEl, e.message);
  } finally { setLoading(btn, false); }
}

async function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const weightKg = parseFloat(document.getElementById('reg-weight').value);
  const heightCm = parseFloat(document.getElementById('reg-height').value);
  const age = parseInt(document.getElementById('reg-age').value);
  const gender = document.getElementById('reg-gender').value;
  const activityLevel = document.getElementById('reg-activity').value;
  const goalEl = document.querySelector('.goal-card.active');
  const goal = goalEl ? goalEl.dataset.goal : 'MAINTAIN';
  const errEl = document.getElementById('reg-error');
  const btn = document.querySelector('#register-form .btn-primary');
  if (!name || !email || !password || !weightKg || !heightCm || !age) {
    showError(errEl, 'Please fill in all fields.'); return;
  }
  setLoading(btn, true); errEl.classList.add('hidden');
  try {
    const data = await api('POST', '/auth/register', { name, email, password, weightKg, heightCm, age, gender, goal, activityLevel });
    token = data.token;
    localStorage.setItem('gymcal_token', token);
    userData = data;
    showApp();
  } catch (e) {
    showError(errEl, e.message);
  } finally { setLoading(btn, false); }
}

function handleLogout() {
  token = null; userData = null;
  localStorage.removeItem('gymcal_token');
  document.getElementById('app-screen').className = 'screen hidden';
  document.getElementById('auth-screen').className = 'screen active';
}

// ════════════════════════════════
// NAVIGATION
// ════════════════════════════════
async function showApp() {
  document.getElementById('auth-screen').className = 'screen hidden';
  document.getElementById('app-screen').className = 'screen active';
  try {
    userData = await api('GET', '/user/profile');
    updateSidebarUser();
    populateProfilePage();
  } catch (e) {
    if (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized')) {
      handleLogout(); return;
    }
  }
  showPage('dashboard');
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) { pg.classList.remove('hidden'); pg.classList.add('active'); }
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));
  if (page === 'dashboard') loadDashboard();
  if (page === 'food') loadFoodPage();
  if (page === 'weekly') loadWeekly();
  if (page === 'profile') populateProfilePage();
}

function toggleMobileMenu() { document.getElementById('mobile-nav').classList.toggle('hidden'); }
function closeMobileMenu() { document.getElementById('mobile-nav').classList.add('hidden'); }

// ════════════════════════════════
// DASHBOARD
// ════════════════════════════════
async function loadDashboard() {
  try {
    dailySummary = await api('GET', '/food/daily');
    renderDashboard(dailySummary);
  } catch (e) { showToast('Could not load dashboard', 'error'); }
}

function renderDashboard(s) {
  if (!s) return;
  const pct = Math.min((s.calorieProgress || 0) / 100, 1);
  const circ = 502;
  const fillEl = document.getElementById('calorie-ring-fill');
  if (fillEl) fillEl.style.strokeDashoffset = circ * (1 - pct);
  setEl('ring-consumed', Math.round(s.consumedCalories || 0));
  const rem = Math.round(s.remainingCalories || 0);
  setEl('ring-remaining', rem > 0 ? `${rem} kcal left` : '🎯 Goal reached!');
  if (userData) setEl('ring-target-label', `of ${Math.round(userData.dailyCalorieTarget || 0)} kcal target`);

  const tPro = userData?.dailyProteinTarget || 1;
  const tCar = userData?.dailyCarbTarget || 1;
  const tFat = userData?.dailyFatTarget || 1;

  setEl('dash-protein', `${Math.round(s.consumedProtein || 0)}g`);
  setEl('dash-carbs', `${Math.round(s.consumedCarbs || 0)}g`);
  setEl('dash-fat', `${Math.round(s.consumedFat || 0)}g`);

  setStyle('dash-protein-bar', 'width', `${Math.min((s.consumedProtein/tPro)*100,100)}%`);
  setStyle('dash-carbs-bar', 'width', `${Math.min((s.consumedCarbs/tCar)*100,100)}%`);
  setStyle('dash-fat-bar', 'width', `${Math.min((s.consumedFat/tFat)*100,100)}%`);

  setEl('dash-protein-target', `of ${Math.round(tPro)}g`);
  setEl('dash-carbs-target', `of ${Math.round(tCar)}g`);
  setEl('dash-fat-target', `of ${Math.round(tFat)}g`);

  renderMealsList('today-meals-list', s.meals || []);
}

function renderMealsList(containerId, meals) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!meals || meals.length === 0) {
    container.innerHTML = `<div class="empty-state">No food logged yet. <a onclick="showPage('food')">Add your first meal →</a></div>`;
    return;
  }
  container.innerHTML = meals.map(meal => `
    <div class="meal-group">
      <div class="meal-group-header">
        <span>${mealEmoji(meal.mealType)} ${meal.mealType}</span>
        <span class="meal-group-kcal">${Math.round(meal.totalCalories || 0)} kcal</span>
      </div>
      ${(meal.items || []).map(item => `
        <div class="food-item">
          <div class="food-item-left">
            <div class="food-item-name">${item.foodName}</div>
            <div class="food-item-macros">${item.quantityGrams}g · P: ${Math.round(item.proteinGrams || 0)}g · C: ${Math.round(item.carbsGrams || 0)}g · F: ${Math.round(item.fatGrams || 0)}g</div>
          </div>
          <div class="food-item-cal">${Math.round(item.calories || 0)} kcal</div>
          <button class="btn-delete" onclick="deleteLog('${item.id}')" title="Remove">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function mealEmoji(t) {
  return { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙', SNACK: '🍿' }[t] || '🍽️';
}

// ════════════════════════════════
// FOOD SEARCH & LOG
// ════════════════════════════════
async function loadFoodPage() {
  try {
    dailySummary = await api('GET', '/food/daily');
    renderMealsList('food-log-list', dailySummary.meals || []);
  } catch (e) { console.error(e); }
}

async function searchFood() {
  const name = document.getElementById('food-name-input').value.trim();
  const qty = parseFloat(document.getElementById('food-qty-input').value) || 100;
  const errEl = document.getElementById('food-search-error');
  const loadEl = document.getElementById('food-search-loading');
  const resultEl = document.getElementById('food-search-result');
  if (!name) { showError(errEl, 'Please enter a food name.'); return; }
  errEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  loadEl.classList.remove('hidden');
  try {
    const data = await api('POST', '/food/search', { foodName: name, quantityGrams: qty });
    // Check AI success flag
    if (!data.success) {
      showError(errEl, data.errorMessage || 'AI could not analyze this food. Try again.');
      return;
    }
    currentFood = data;
    renderFoodResult(data);
  } catch (e) {
    showError(errEl, e.message);
  } finally { loadEl.classList.add('hidden'); }
}

function renderFoodResult(d) {
  setEl('result-name', d.foodName);
  setEl('result-qty', `${d.quantityGrams}g`);
  setEl('res-cal', Math.round(d.calories || 0));
  setEl('res-pro', `${Math.round(d.proteinGrams || 0)}g`);
  setEl('res-car', `${Math.round(d.carbsGrams || 0)}g`);
  setEl('res-fat', `${Math.round(d.fatGrams || 0)}g`);
  setEl('res-fib', `${Math.round(d.fiberGrams || 0)}g`);
  setEl('result-ai', d.aiAnalysis || '');
  document.getElementById('food-search-result').classList.remove('hidden');
}

async function addToLog() {
  if (!currentFood) return;
  const mealType = document.getElementById('meal-type-select').value;
  const today = new Date().toISOString().split('T')[0];
  const btn = document.querySelector('.add-to-log-row .btn-primary');
  setLoading(btn, true);
  try {
    await api('POST', '/food/log', {
      foodName: currentFood.foodName,
      quantityGrams: Number(currentFood.quantityGrams) || 100,
      mealType,
      logDate: today,
      calories: Number(currentFood.calories) || 0,
      proteinGrams: Number(currentFood.proteinGrams) || 0,
      carbsGrams: Number(currentFood.carbsGrams) || 0,
      fatGrams: Number(currentFood.fatGrams) || 0,
      fiberGrams: Number(currentFood.fiberGrams) || 0,
      aiAnalysis: currentFood.aiAnalysis || ''
    });
    showToast(`✓ ${currentFood.foodName} added to ${mealType.toLowerCase()}!`);
    currentFood = null;
    document.getElementById('food-search-result').classList.add('hidden');
    document.getElementById('food-name-input').value = '';
    document.getElementById('food-qty-input').value = '100';
    loadFoodPage();
  } catch (e) {
    showToast('Failed to add: ' + e.message, 'error');
  } finally { setLoading(btn, false); }
}

async function deleteLog(logId) {
  try {
    await api('DELETE', `/food/log/${logId}`);
    showToast('Removed from log');
    loadFoodPage();
    if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ════════════════════════════════
// WEEKLY
// ════════════════════════════════
async function loadWeekly() {
  try {
    const data = await api('GET', '/food/weekly');
    renderWeekly(data);
  } catch (e) { showToast('Could not load weekly data', 'error'); }
}

function renderWeekly(days) {
  if (!days || days.length === 0) return;
  const today = new Date().toISOString().split('T')[0];

  // Summary stats
  const activeDays = days.filter(d => d.consumedCalories > 0);
  const avgCal = activeDays.length ? Math.round(activeDays.reduce((a,d) => a + d.consumedCalories, 0) / activeDays.length) : 0;
  const avgPro = activeDays.length ? Math.round(activeDays.reduce((a,d) => a + (d.consumedProtein||0), 0) / activeDays.length) : 0;
  const goalHit = days.filter(d => d.calorieProgress >= 70).length;

  setEl('ws-avg-cal', avgCal || '—');
  setEl('ws-avg-pro', avgPro ? `${avgPro}g` : '—');
  setEl('ws-days-logged', `${activeDays.length}/7`);
  setEl('ws-goal-hit', `${Math.round((goalHit/7)*100)}%`);

  // Canvas chart
  const canvas = document.getElementById('weekly-chart');
  if (canvas) {
    const parent = canvas.parentElement;
    const W = parent.clientWidth - 48 || 600;
    const H = 200;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const maxCal = Math.max(...days.map(d => d.consumedCalories || 0), 1);
    const barW = Math.floor((W / days.length) * 0.55);
    const gap = W / days.length;

    days.forEach((d, i) => {
      const x = i * gap + (gap - barW) / 2;
      const calH = ((d.consumedCalories || 0) / maxCal) * (H - 50);
      const y = H - calH - 30;
      const isToday = d.date === today;

      // Bar gradient
      const grad = ctx.createLinearGradient(0, y, 0, H - 30);
      if (isToday) {
        grad.addColorStop(0, '#b9ff4b'); grad.addColorStop(1, 'rgba(185,255,75,0.3)');
      } else {
        grad.addColorStop(0, '#1e2a1e'); grad.addColorStop(1, 'rgba(30,42,30,0.2)');
      }

      ctx.fillStyle = grad;
      const r = 5;
      ctx.beginPath();
      if (calH > 0) {
        ctx.moveTo(x+r, y); ctx.lineTo(x+barW-r, y);
        ctx.arcTo(x+barW, y, x+barW, y+r, r);
        ctx.lineTo(x+barW, H-30); ctx.lineTo(x, H-30);
        ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
        ctx.closePath(); ctx.fill();
      }

      // Label
      ctx.fillStyle = isToday ? '#b9ff4b' : '#555d6b';
      ctx.font = `${isToday ? '600' : '400'} 11px Cabinet Grotesk, DM Sans, sans-serif`;
      ctx.textAlign = 'center';
      const label = new Date(d.date).toLocaleDateString('en', { weekday: 'short' });
      ctx.fillText(label, x + barW/2, H - 12);

      if (d.consumedCalories > 0) {
        ctx.fillStyle = isToday ? '#b9ff4b' : '#3a4248';
        ctx.font = `600 10px DM Mono, monospace`;
        ctx.fillText(Math.round(d.consumedCalories), x + barW/2, Math.max(y - 8, 14));
      }
    });
  }

  // Day cards
  const list = document.getElementById('weekly-list');
  const sorted = [...days].reverse();
  list.innerHTML = sorted.map(d => {
    const isToday = d.date === today;
    const pct = Math.min(d.calorieProgress || 0, 100);
    const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <div class="weekly-day-card ${isToday ? 'today' : ''}">
        <div class="weekly-day-label">${isToday ? '⚡ Today' : dayLabel}</div>
        <div class="weekly-day-bar-wrap"><div class="weekly-day-bar" style="width:${pct}%"></div></div>
        <div class="weekly-day-cal">${Math.round(d.consumedCalories || 0)} / ${Math.round(d.targetCalories || 0)} kcal</div>
      </div>
    `;
  }).join('');

  // Animate bars after paint
  setTimeout(() => {
    document.querySelectorAll('.weekly-day-bar').forEach((bar, i) => {
      bar.style.transition = `width 0.8s cubic-bezier(0.4,0,0.2,1) ${i * 0.06}s`;
    });
  }, 100);
}

// ════════════════════════════════
// PROFILE
// ════════════════════════════════
function populateProfilePage() {
  if (!userData) return;

  const bmi = userData.bmi || 0;
  setEl('profile-bmi', bmi.toFixed(1));
  setEl('profile-bmi-cat', userData.bmiCategory || bmiCategoryStr(bmi));
  const pct = Math.min(Math.max((bmi - 15) / 25, 0), 1) * 92;
  setStyle('bmi-indicator', 'left', `calc(${pct}% - 6px)`);

  setEl('pt-cal', `${Math.round(userData.dailyCalorieTarget || 0)} kcal`);
  setEl('pt-pro', `${Math.round(userData.dailyProteinTarget || 0)}g`);
  setEl('pt-car', `${Math.round(userData.dailyCarbTarget || 0)}g`);
  setEl('pt-fat', `${Math.round(userData.dailyFatTarget || 0)}g`);

  setEl('ps-name', userData.name || '—');
  setEl('ps-weight', `${userData.weightKg || '—'} kg`);
  setEl('ps-height', `${userData.heightCm || '—'} cm`);
  setEl('ps-goal', formatGoal(userData.goal));
  setEl('ps-activity', formatActivity(userData.activityLevel));

  const goalSel = document.getElementById('update-goal-sel');
  const actSel = document.getElementById('update-activity-sel');
  if (goalSel) goalSel.value = userData.goal || 'MAINTAIN';
  if (actSel) actSel.value = userData.activityLevel || 'MODERATE';
  const wInp = document.getElementById('update-weight-inp');
  if (wInp) wInp.value = userData.weightKg || '';
}

function bmiCategoryStr(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function formatGoal(g) {
  return { WEIGHT_LOSS:'Weight Loss', MUSCLE_GAIN:'Muscle Gain', MAINTAIN:'Maintain', RECOMPOSITION:'Recomposition' }[g] || g || '—';
}

function formatActivity(l) {
  return { SEDENTARY:'Sedentary', LIGHT:'Light', MODERATE:'Moderate', ACTIVE:'Active', VERY_ACTIVE:'Very Active' }[l] || l || '—';
}

function updateSidebarUser() {
  const el = document.getElementById('sidebar-user-badge');
  if (el && userData) el.innerHTML = `<strong>${userData.name || 'User'}</strong><br>${formatGoal(userData.goal)}`;
}

async function updateGoal() {
  const goal = document.getElementById('update-goal-sel').value;
  const activityLevel = document.getElementById('update-activity-sel').value;
  const wVal = document.getElementById('update-weight-inp').value;
  const weightKg = wVal ? parseFloat(wVal) : undefined;
  const msgEl = document.getElementById('update-goal-msg');
  const btn = document.querySelector('.update-goal-card .btn-primary');
  setLoading(btn, true); msgEl.classList.add('hidden');
  try {
    userData = await api('PUT', '/user/goal', { goal, activityLevel, ...(weightKg ? { weightKg } : {}) });
    msgEl.textContent = '✓ Targets updated successfully!';
    msgEl.classList.remove('hidden');
    populateProfilePage();
    updateSidebarUser();
    showToast('Goals updated!');
    setTimeout(() => msgEl.classList.add('hidden'), 3000);
  } catch (e) {
    showToast('Update failed: ' + e.message, 'error');
  } finally { setLoading(btn, false); }
}

// ════════════════════════════════
// UTILITIES
// ════════════════════════════════
function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function setStyle(id, prop, val) { const e = document.getElementById(id); if (e) e.style[prop] = val; }
function showError(el, msg) { if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  const t = btn.querySelector('.btn-text'), l = btn.querySelector('.btn-loader');
  if (t) t.style.opacity = on ? '0.4' : '1';
  if (l) l.classList.toggle('hidden', !on);
}

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--accent)';
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// Polyfill roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
    if (w < 2*r) r = w/2; if (h < 2*r) r = h/2;
    this.beginPath(); this.moveTo(x+r,y);
    this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+r,y,r);
    this.closePath(); return this;
  };
}
