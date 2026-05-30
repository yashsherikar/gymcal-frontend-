/* ═══════════════════════════════════════════
   GYMCAL FRONTEND — app.js (UPDATED)
   New: Workout Plan, Good/Bad Calories,
        Flexible Food Quantity (grams + count)
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
let workoutPlan = null;
let currentQtyMode = 'grams'; // 'grams' or 'count'

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

  setTimeout(() => {
    const inp = document.getElementById('food-name-input');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') searchFood(); });
    const inp2 = document.getElementById('food-name-count');
    if (inp2) inp2.addEventListener('keydown', e => { if (e.key === 'Enter') searchFoodCount(); });
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
  token = null; userData = null; workoutPlan = null;
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
  if (page === 'workout') loadWorkoutPlan();
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

  // ── Good vs Bad Calories Dashboard ──
  renderDashCalorieQuality(s);

  renderMealsList('today-meals-list', s.meals || []);
}

function renderDashCalorieQuality(s) {
  const total = s.consumedCalories || 0;
  const good = s.goodCalories || 0;
  const bad = s.badCalories || 0;
  const neutral = s.neutralCalories || 0;
  const goodPct = s.goodCaloriePercent || 0;
  const badPct = s.badCaloriePercent || 0;
  const neutralPct = total > 0 ? Math.round(100 - goodPct - badPct) : 0;

  // Animate bars (delay so DOM is ready)
  setTimeout(() => {
    setStyle('dash-good-bar', 'width', `${Math.min(goodPct, 100)}%`);
    setStyle('dash-neutral-bar', 'width', `${Math.min(neutralPct, 100)}%`);
    setStyle('dash-bad-bar', 'width', `${Math.min(badPct, 100)}%`);
  }, 200);

  setEl('dash-good-cal', `${Math.round(good)} kcal`);
  setEl('dash-neutral-cal', `${Math.round(neutral)} kcal`);
  setEl('dash-bad-cal', `${Math.round(bad)} kcal`);

  let summary = '';
  if (total === 0) {
    summary = 'Log food to see calorie quality breakdown';
  } else if (badPct <= 15 && goodPct >= 45) {
    summary = `🌟 Excellent day! ${Math.round(goodPct)}% of your calories are high-quality.`;
  } else if (badPct <= 30) {
    summary = `✅ Good balance. Keep focusing on protein-rich, whole foods.`;
  } else if (badPct <= 50) {
    summary = `⚠️ ${Math.round(badPct)}% of calories are from saturated fat/sugar. Balance with more protein.`;
  } else {
    summary = `🚨 High bad-calorie intake today. Try adding more lean protein and vegetables.`;
  }
  setEl('dash-cq-summary', summary);
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
        <div style="display:flex;align-items:center;gap:0.6rem">
          <span style="font-size:0.72rem;color:var(--success)">✅ ${Math.round(meal.goodCalories||0)}</span>
          <span style="font-size:0.72rem;color:var(--danger)">⚠️ ${Math.round(meal.badCalories||0)}</span>
          <span class="meal-group-kcal">${Math.round(meal.totalCalories || 0)} kcal</span>
        </div>
      </div>
      ${(meal.items || []).map(item => `
        <div class="food-item">
          <div class="food-item-left">
            <div class="food-item-name">
              ${item.foodName}
              <span class="food-item-qty">${item.quantityDisplay || item.quantityGrams + 'g'}</span>
              <span class="quality-dot ${item.calorieQuality || 'MODERATE'}" title="${item.calorieQuality||''}"></span>
            </div>
            <div class="food-item-macros">P: ${Math.round(item.proteinGrams||0)}g · C: ${Math.round(item.carbsGrams||0)}g · F: ${Math.round(item.fatGrams||0)}g</div>
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
// FOOD SEARCH — QUANTITY MODE
// ════════════════════════════════
function switchQtyMode(mode) {
  currentQtyMode = mode;
  document.getElementById('qty-mode-grams').classList.toggle('hidden', mode !== 'grams');
  document.getElementById('qty-mode-count').classList.toggle('hidden', mode !== 'count');
  document.getElementById('tab-grams').classList.toggle('active', mode === 'grams');
  document.getElementById('tab-count').classList.toggle('active', mode === 'count');
  // Clear results
  document.getElementById('food-search-result').classList.add('hidden');
  document.getElementById('food-search-error').classList.add('hidden');
  currentFood = null;
}

// ── Search by grams ──
async function searchFood() {
  const name = document.getElementById('food-name-input').value.trim();
  const qty = parseFloat(document.getElementById('food-qty-input').value) || 100;
  await runFoodSearch({ foodName: name, quantityGrams: qty });
}

// ── Search by count/unit ──
async function searchFoodCount() {
  const name = document.getElementById('food-name-count').value.trim();
  const amount = parseFloat(document.getElementById('food-amount-count').value) || 1;
  const unit = document.getElementById('food-unit-count').value;
  await runFoodSearch({ foodName: name, quantityAmount: amount, quantityUnit: unit });
}

async function runFoodSearch(requestBody) {
  if (!requestBody.foodName) {
    const errEl = document.getElementById('food-search-error');
    showError(errEl, 'Please enter a food name.'); return;
  }
  const errEl = document.getElementById('food-search-error');
  const loadEl = document.getElementById('food-search-loading');
  const resultEl = document.getElementById('food-search-result');
  errEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  loadEl.classList.remove('hidden');
  try {
    const data = await api('POST', '/food/search', requestBody);
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
  setEl('result-qty', d.quantityDisplay || `${d.quantityGrams}g`);
  setEl('res-cal', Math.round(d.calories || 0));
  setEl('res-pro', `${Math.round(d.proteinGrams || 0)}g`);
  setEl('res-car', `${Math.round(d.carbsGrams || 0)}g`);
  setEl('res-fat', `${Math.round(d.fatGrams || 0)}g`);
  setEl('res-fib', `${Math.round(d.fiberGrams || 0)}g`);
  setEl('result-ai', d.aiAnalysis || '');

  // ── Good vs Bad calories in result ──
  renderResultCalorieQuality(d);

  document.getElementById('food-search-result').classList.remove('hidden');
}

function renderResultCalorieQuality(d) {
  const total = d.calories || 1;
  const good = d.goodCalories || 0;
  const bad = d.badCalories || 0;
  const neutral = d.neutralCalories || 0;

  const goodPct = Math.round((good / total) * 100);
  const badPct  = Math.round((bad  / total) * 100);
  const neutralPct = Math.max(0, 100 - goodPct - badPct);

  const badge = document.getElementById('rcq-badge');
  if (badge) {
    badge.textContent = d.calorieQuality || 'MODERATE';
    badge.className = `rcq-badge ${d.calorieQuality || 'MODERATE'}`;
  }
  setEl('rcq-reason', d.qualityReason || '');
  setEl('rcq-good-num', `${Math.round(good)} kcal`);
  setEl('rcq-neutral-num', `${Math.round(neutral)} kcal`);
  setEl('rcq-bad-num', `${Math.round(bad)} kcal`);

  setTimeout(() => {
    setStyle('rcq-good-bar', 'width', `${goodPct}%`);
    setStyle('rcq-neutral-bar', 'width', `${neutralPct}%`);
    setStyle('rcq-bad-bar', 'width', `${badPct}%`);
  }, 100);
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
      quantityDisplay: currentFood.quantityDisplay || '',
      quantityUnit: currentFood.quantityUnit || 'grams',
      quantityAmount: currentFood.quantityAmount || currentFood.quantityGrams,
      mealType,
      logDate: today,
      calories: Number(currentFood.calories) || 0,
      proteinGrams: Number(currentFood.proteinGrams) || 0,
      carbsGrams: Number(currentFood.carbsGrams) || 0,
      fatGrams: Number(currentFood.fatGrams) || 0,
      fiberGrams: Number(currentFood.fiberGrams) || 0,
      goodCalories: Number(currentFood.goodCalories) || 0,
      badCalories: Number(currentFood.badCalories) || 0,
      neutralCalories: Number(currentFood.neutralCalories) || 0,
      calorieQuality: currentFood.calorieQuality || 'MODERATE',
      aiAnalysis: currentFood.aiAnalysis || ''
    });
    showToast(`✓ ${currentFood.foodName} added to ${mealType.toLowerCase()}!`);
    currentFood = null;
    document.getElementById('food-search-result').classList.add('hidden');
    document.getElementById('food-name-input').value = '';
    document.getElementById('food-qty-input').value = '100';
    document.getElementById('food-name-count').value = '';
    loadFoodPage();
  } catch (e) {
    showToast('Failed to add: ' + e.message, 'error');
  } finally { setLoading(btn, false); }
}

async function loadFoodPage() {
  try {
    dailySummary = await api('GET', '/food/daily');
    renderMealsList('food-log-list', dailySummary.meals || []);
  } catch (e) { console.error(e); }
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
// WORKOUT PLAN (NEW)
// ════════════════════════════════
async function loadWorkoutPlan() {
  // Use cached if available
  if (workoutPlan) { renderWorkoutPlan(workoutPlan); return; }
  await fetchWorkoutPlan();
}

async function regenerateWorkoutPlan() {
  workoutPlan = null;
  await fetchWorkoutPlan();
}

async function fetchWorkoutPlan() {
  const loadEl = document.getElementById('workout-loading');
  const wrapEl = document.getElementById('workout-plan-wrap');
  const regenBtn = document.getElementById('regen-btn-text');
  const regenLoader = document.getElementById('regen-loader');

  loadEl.classList.remove('hidden');
  wrapEl.classList.add('hidden');
  if (regenBtn) regenBtn.style.opacity = '0.4';
  if (regenLoader) regenLoader.classList.remove('hidden');

  try {
    workoutPlan = await api('GET', '/food/workout-plan');
    renderWorkoutPlan(workoutPlan);
  } catch (e) {
    showToast('Could not load workout plan: ' + e.message, 'error');
  } finally {
    loadEl.classList.add('hidden');
    if (regenBtn) regenBtn.style.opacity = '1';
    if (regenLoader) regenLoader.classList.add('hidden');
  }
}

function renderWorkoutPlan(plan) {
  if (!plan) return;
  const wrapEl = document.getElementById('workout-plan-wrap');
  wrapEl.classList.remove('hidden');

  // Overview
  setEl('woc-title', plan.planTitle || 'Your Weekly Plan');
  setEl('woc-desc', plan.planDescription || '');
  setEl('woc-note', plan.weeklyNote || '');

  // Update subtitle with gender/goal
  const genderEmoji = (plan.gender || '').toLowerCase() === 'female' ? '👩' : '👨';
  const sub = document.getElementById('workout-subtitle');
  if (sub) sub.textContent = `${genderEmoji} ${formatGoal(plan.goal)} · ${formatActivity(plan.activityLevel)}`;

  // Stats
  const statsEl = document.getElementById('woc-stats');
  if (statsEl && plan.days) {
    const trainingDays = plan.days.filter(d => d.type === 'TRAINING').length;
    const totalMins = plan.days.reduce((a,d) => a + (d.estimatedMinutes || 0), 0);
    const totalCals = plan.days.reduce((a,d) => a + (d.estimatedCaloriesBurn || 0), 0);
    statsEl.innerHTML = `
      <div class="woc-stat">
        <div class="woc-stat-val" style="color:var(--accent)">${trainingDays}</div>
        <div class="woc-stat-lbl">Training Days</div>
      </div>
      <div class="woc-stat">
        <div class="woc-stat-val" style="color:var(--accent2)">${totalMins} min</div>
        <div class="woc-stat-lbl">Total Weekly</div>
      </div>
      <div class="woc-stat">
        <div class="woc-stat-val" style="color:var(--fat)">~${totalCals} kcal</div>
        <div class="woc-stat-lbl">Weekly Burn</div>
      </div>
    `;
  }

  // Day cards
  const grid = document.getElementById('workout-days-grid');
  if (grid && plan.days) {
    grid.innerHTML = plan.days.map(day => renderDayCard(day)).join('');
  }

  // Tips
  if (plan.generalTips && plan.generalTips.length > 0) {
    const tipsCard = document.getElementById('workout-tips-card');
    const tipsList = document.getElementById('tips-list');
    if (tipsCard) tipsCard.style.display = 'block';
    if (tipsList) {
      tipsList.innerHTML = plan.generalTips.map(tip => `<li>${tip}</li>`).join('');
    }
  }
}

function renderDayCard(day) {
  const isRest = day.type === 'REST';
  const typeClass = day.type || 'TRAINING';
  const intensityClass = day.intensity || 'Medium';

  const exercisesHtml = isRest
    ? `<div class="wdc-rest-day">
        <div class="rest-icon">😴</div>
        <div class="rest-text">Complete rest day — let your muscles recover!</div>
      </div>`
    : (day.exercises || []).map((ex, i) => `
        <div class="wdc-exercise">
          <div class="wdc-ex-num">${i + 1}</div>
          <div class="wdc-ex-info">
            <div class="wdc-ex-name">${ex.name}</div>
            <div class="wdc-ex-detail">
              <span>🔄 ${ex.sets}</span>
              <span>⚡ ${ex.reps}</span>
              <span>⏱ ${ex.rest}</span>
            </div>
          </div>
          <span class="wdc-muscle">${ex.muscleGroup || ''}</span>
        </div>
      `).join('');

  const metaHtml = !isRest ? `
    <div class="wdc-meta">
      <span>⏱ ${day.estimatedMinutes || 0} min</span>
      <span>🔥 ~${day.estimatedCaloriesBurn || 0} kcal</span>
    </div>` : '';

  const notesHtml = day.notes ? `<div class="wdc-notes">💬 ${day.notes}</div>` : '';

  return `
    <div class="workout-day-card">
      <div class="wdc-header">
        <div>
          <div class="wdc-day">${day.day}</div>
          <div class="wdc-focus">${day.focus}</div>
        </div>
        <div class="wdc-badges">
          <span class="wdc-type-badge ${typeClass}">${typeClass.replace('_', ' ')}</span>
          <span class="wdc-intensity ${intensityClass}">${intensityClass}</span>
        </div>
      </div>
      ${metaHtml}
      <div class="wdc-exercises">${exercisesHtml}</div>
      ${notesHtml}
    </div>
  `;
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

  const activeDays = days.filter(d => d.consumedCalories > 0);
  const avgCal = activeDays.length ? Math.round(activeDays.reduce((a,d) => a + d.consumedCalories, 0) / activeDays.length) : 0;
  const avgPro = activeDays.length ? Math.round(activeDays.reduce((a,d) => a + (d.consumedProtein||0), 0) / activeDays.length) : 0;
  const goalHit = days.filter(d => d.calorieProgress >= 70).length;

  setEl('ws-avg-cal', avgCal || '—');
  setEl('ws-avg-pro', avgPro ? `${avgPro}g` : '—');
  setEl('ws-days-logged', `${activeDays.length}/7`);
  setEl('ws-goal-hit', `${Math.round((goalHit/7)*100)}%`);

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

  const list = document.getElementById('weekly-list');
  const sorted = [...days].reverse();
  list.innerHTML = sorted.map(d => {
    const isToday = d.date === today;
    const pct = Math.min(d.calorieProgress || 0, 100);
    const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const badPct = d.badCaloriePercent || 0;
    const badColor = badPct > 40 ? 'var(--danger)' : badPct > 20 ? 'var(--fat)' : 'var(--success)';
    return `
      <div class="weekly-day-card ${isToday ? 'today' : ''}">
        <div class="weekly-day-label">${isToday ? '⚡ Today' : dayLabel}</div>
        <div class="weekly-day-bar-wrap"><div class="weekly-day-bar" style="width:${pct}%"></div></div>
        <div style="text-align:right">
          <div class="weekly-day-cal">${Math.round(d.consumedCalories || 0)} / ${Math.round(d.targetCalories || 0)} kcal</div>
          ${d.consumedCalories > 0 ? `<div style="font-size:0.66rem;color:${badColor}">⚠️ bad: ${Math.round(d.badCalories||0)} kcal</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

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
  setEl('ps-gender', userData.gender === 'MALE' ? '👨 Male' : '👩 Female');
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
  return { WEIGHT_LOSS:'🔥 Weight Loss', MUSCLE_GAIN:'💪 Muscle Gain', MAINTAIN:'⚖️ Maintain', RECOMPOSITION:'🔄 Recomp' }[g] || g || '—';
}

function formatActivity(l) {
  return { SEDENTARY:'Sedentary', LIGHT:'Light', MODERATE:'Moderate', ACTIVE:'Active', VERY_ACTIVE:'Very Active' }[l] || l || '—';
}

function updateSidebarUser() {
  const el = document.getElementById('sidebar-user-badge');
  if (el && userData) {
    const genderIcon = userData.gender === 'FEMALE' ? '👩' : '👨';
    el.innerHTML = `<strong>${genderIcon} ${userData.name || 'User'}</strong><br>${formatGoal(userData.goal)}`;
  }
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
    showToast('Goals updated! Workout plan will regenerate.');
    workoutPlan = null; // Force regenerate workout plan
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
