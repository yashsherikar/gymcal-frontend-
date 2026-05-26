/* ═══════════════════════════════════════════
   GYMCAL FRONTEND — app.js
   Connects to Spring Boot backend via REST
═══════════════════════════════════════════ */

// ── CONFIG ──
// Change this to your deployed backend URL
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://gymcal-backend.onrender.com/api';

// ── STATE ──
let token = localStorage.getItem('gymcal_token') || null;
let userData = null;
let currentFood = null; // food search result in memory
let dailySummary = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  if (token) {
    showApp();
  }
});

function updateGreeting() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning 👋' : hour < 17 ? 'Good Afternoon 👋' : 'Good Evening 👋';
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = greet;
  const dateEl = document.getElementById('greeting-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ══════════════════════════════════════════
// API HELPER
// ══════════════════════════════════════════
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
function toggleAuth(mode) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  if (mode === 'register') {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
  } else {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  }
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

  setLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const data = await api('POST', '/auth/login', { email, password });
    token = data.token;
    localStorage.setItem('gymcal_token', token);
    userData = data;
    showApp();
  } catch (e) {
    showError(errEl, e.message);
  } finally {
    setLoading(btn, false);
  }
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

  setLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const data = await api('POST', '/auth/register', { name, email, password, weightKg, heightCm, age, gender, goal, activityLevel });
    token = data.token;
    localStorage.setItem('gymcal_token', token);
    userData = data;
    showApp();
  } catch (e) {
    showError(errEl, e.message);
  } finally {
    setLoading(btn, false);
  }
}

function handleLogout() {
  token = null;
  userData = null;
  localStorage.removeItem('gymcal_token');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-screen').classList.add('active');
}

// ══════════════════════════════════════════
// APP NAVIGATION
// ══════════════════════════════════════════
async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('active');

  // Load profile
  try {
    userData = await api('GET', '/user/profile');
    updateSidebarUser();
    populateProfilePage();
  } catch (e) {
    // token might be expired
    if (e.message.includes('401') || e.message.includes('Unauthorized')) {
      handleLogout(); return;
    }
  }

  showPage('dashboard');
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));

  if (page === 'dashboard') loadDashboard();
  if (page === 'food') loadFoodPage();
  if (page === 'weekly') loadWeekly();
  if (page === 'profile') populateProfilePage();
}

function toggleMobileMenu() {
  document.getElementById('mobile-nav').classList.toggle('hidden');
}
function closeMobileMenu() {
  document.getElementById('mobile-nav').classList.add('hidden');
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard() {
  try {
    dailySummary = await api('GET', '/food/daily');
    renderDashboard(dailySummary);
  } catch (e) {
    showToast('Could not load dashboard: ' + e.message, 'error');
  }
}

function renderDashboard(s) {
  if (!s) return;

  // Calorie Ring
  const pct = Math.min(s.calorieProgress / 100, 1);
  const circumference = 502;
  document.getElementById('calorie-ring-fill').style.strokeDashoffset = circumference * (1 - pct);
  document.getElementById('ring-consumed').textContent = Math.round(s.consumedCalories);
  const remaining = Math.round(s.remainingCalories);
  document.getElementById('ring-remaining').textContent = remaining > 0 ? `${remaining} left` : 'Goal reached!';

  // Macro bars
  const proteinPct = userData ? Math.min((s.consumedProtein / userData.dailyProteinTarget) * 100, 100) : 0;
  const carbsPct = userData ? Math.min((s.consumedCarbs / userData.dailyCarbTarget) * 100, 100) : 0;
  const fatPct = userData ? Math.min((s.consumedFat / userData.dailyFatTarget) * 100, 100) : 0;

  document.getElementById('dash-protein').textContent = `${Math.round(s.consumedProtein)}g`;
  document.getElementById('dash-carbs').textContent = `${Math.round(s.consumedCarbs)}g`;
  document.getElementById('dash-fat').textContent = `${Math.round(s.consumedFat)}g`;

  document.getElementById('dash-protein-bar').style.width = `${proteinPct}%`;
  document.getElementById('dash-carbs-bar').style.width = `${carbsPct}%`;
  document.getElementById('dash-fat-bar').style.width = `${fatPct}%`;

  if (userData) {
    document.getElementById('dash-protein-target').textContent = `of ${Math.round(userData.dailyProteinTarget)}g`;
    document.getElementById('dash-carbs-target').textContent = `of ${Math.round(userData.dailyCarbTarget)}g`;
    document.getElementById('dash-fat-target').textContent = `of ${Math.round(userData.dailyFatTarget)}g`;
  }

  // Meals
  renderMealsList('today-meals-list', s.meals || []);
}

function renderMealsList(containerId, meals) {
  const container = document.getElementById(containerId);
  if (!meals || meals.length === 0) {
    container.innerHTML = `<div class="empty-state">No food logged yet today. <a onclick="showPage('food')">Add your first meal →</a></div>`;
    return;
  }
  container.innerHTML = meals.map(meal => `
    <div class="meal-group">
      <div class="meal-group-header">
        <span>${mealEmoji(meal.mealType)} ${meal.mealType}</span>
        <span class="meal-group-kcal">${Math.round(meal.totalCalories)} kcal</span>
      </div>
      ${(meal.items || []).map(item => `
        <div class="food-item">
          <div class="food-item-left">
            <div class="food-item-name">${item.foodName}</div>
            <div class="food-item-macros">${item.quantityGrams}g · P: ${item.proteinGrams}g · C: ${item.carbsGrams}g · F: ${item.fatGrams}g</div>
          </div>
          <div class="food-item-cal">${item.calories} kcal</div>
          <button class="btn-delete" onclick="deleteLog('${item.id}')" title="Remove">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function mealEmoji(type) {
  const map = { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙', SNACK: '🍿' };
  return map[type] || '🍽️';
}

// ══════════════════════════════════════════
// FOOD SEARCH & LOG
// ══════════════════════════════════════════
async function loadFoodPage() {
  try {
    dailySummary = await api('GET', '/food/daily');
    renderMealsList('food-log-list', dailySummary.meals || []);
  } catch (e) {
    console.error(e);
  }
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
    currentFood = data;
    renderFoodResult(data);
  } catch (e) {
    showError(errEl, e.message);
  } finally {
    loadEl.classList.add('hidden');
  }
}

// Allow Enter key to trigger search
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const inp = document.getElementById('food-name-input');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') searchFood(); });
  }, 500);
});

function renderFoodResult(d) {
  document.getElementById('result-name').textContent = d.foodName;
  document.getElementById('result-qty').textContent = `${d.quantityGrams}g`;
  document.getElementById('res-cal').textContent = Math.round(d.calories);
  document.getElementById('res-pro').textContent = `${d.proteinGrams}g`;
  document.getElementById('res-car').textContent = `${d.carbsGrams}g`;
  document.getElementById('res-fat').textContent = `${d.fatGrams}g`;
  document.getElementById('res-fib').textContent = `${d.fiberGrams || 0}g`;
  document.getElementById('result-ai').textContent = d.aiAnalysis || '';
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
      quantityGrams: currentFood.quantityGrams,
      mealType,
      logDate: today,
      calories: currentFood.calories,
      proteinGrams: currentFood.proteinGrams,
      carbsGrams: currentFood.carbsGrams,
      fatGrams: currentFood.fatGrams,
      fiberGrams: currentFood.fiberGrams || 0,
      aiAnalysis: currentFood.aiAnalysis
    });

    showToast(`${currentFood.foodName} added to ${mealType.toLowerCase()}!`);
    currentFood = null;
    document.getElementById('food-search-result').classList.add('hidden');
    document.getElementById('food-name-input').value = '';
    document.getElementById('food-qty-input').value = '100';

    // Refresh food log list
    loadFoodPage();
  } catch (e) {
    showToast('Failed to add: ' + e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function deleteLog(logId) {
  try {
    await api('DELETE', `/food/log/${logId}`);
    showToast('Removed from log');
    loadFoodPage();
    // Also refresh dashboard if it's visible
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      loadDashboard();
    }
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════
// WEEKLY
// ══════════════════════════════════════════
async function loadWeekly() {
  try {
    const data = await api('GET', '/food/weekly');
    renderWeekly(data);
  } catch (e) {
    showToast('Could not load weekly data', 'error');
  }
}

function renderWeekly(days) {
  const maxCal = Math.max(...days.map(d => d.consumedCalories || 0), 1);

  // Simple bar chart with canvas
  const canvas = document.getElementById('weekly-chart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 48;
    const H = 240;
    canvas.width = W; canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    const barW = Math.floor(W / days.length) - 16;
    days.forEach((d, i) => {
      const x = i * (W / days.length) + 8;
      const calH = ((d.consumedCalories || 0) / maxCal) * (H - 60);
      const y = H - calH - 30;

      // Bar
      ctx.fillStyle = i === days.length - 1 ? '#c8ff00' : '#1e2229';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, calH, 6);
      ctx.fill();

      // Label
      ctx.fillStyle = '#8a909c';
      ctx.font = '500 11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      const label = new Date(d.date).toLocaleDateString('en', { weekday: 'short' });
      ctx.fillText(label, x + barW / 2, H - 10);

      // Value
      if (d.consumedCalories > 0) {
        ctx.fillStyle = i === days.length - 1 ? '#c8ff00' : '#555d6b';
        ctx.font = '600 10px DM Mono, monospace';
        ctx.fillText(Math.round(d.consumedCalories), x + barW / 2, y - 6);
      }
    });
  }

  // List below
  const list = document.getElementById('weekly-list');
  list.innerHTML = days.reverse().map(d => {
    const pct = (d.calorieProgress || 0);
    const barW = Math.min(pct, 100);
    const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <div class="weekly-day-card">
        <div class="weekly-day-label">${dayLabel}</div>
        <div class="weekly-day-bar-wrap"><div class="weekly-day-bar" style="width:${barW}%"></div></div>
        <div class="weekly-day-cal">${Math.round(d.consumedCalories)} / ${Math.round(d.targetCalories)} kcal</div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════
function populateProfilePage() {
  if (!userData) return;

  // BMI
  const bmi = userData.bmi || 0;
  document.getElementById('profile-bmi').textContent = bmi.toFixed(1);
  document.getElementById('profile-bmi-cat').textContent = userData.bmiCategory || bmiCategory(bmi);

  // BMI indicator position (scale: 15 to 40)
  const pct = Math.min(Math.max((bmi - 15) / 25, 0), 1) * 100;
  document.getElementById('bmi-indicator').style.left = `calc(${pct}% - 5px)`;

  // Targets
  document.getElementById('pt-cal').textContent = `${Math.round(userData.dailyCalorieTarget)} kcal`;
  document.getElementById('pt-pro').textContent = `${Math.round(userData.dailyProteinTarget)}g`;
  document.getElementById('pt-car').textContent = `${Math.round(userData.dailyCarbTarget)}g`;
  document.getElementById('pt-fat').textContent = `${Math.round(userData.dailyFatTarget)}g`;

  // Stats
  document.getElementById('ps-name').textContent = userData.name || '—';
  document.getElementById('ps-weight').textContent = `${userData.weightKg || '—'} kg`;
  document.getElementById('ps-height').textContent = `${userData.heightCm || '—'} cm`;
  document.getElementById('ps-activity').textContent = formatActivity(userData.activityLevel);

  // Pre-fill update form
  document.getElementById('update-goal-sel').value = userData.goal || 'MAINTAIN';
  document.getElementById('update-activity-sel').value = userData.activityLevel || 'MODERATE';
  document.getElementById('update-weight-inp').value = userData.weightKg || '';
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function formatActivity(level) {
  const map = {
    SEDENTARY: 'Sedentary', LIGHT: 'Light', MODERATE: 'Moderate',
    ACTIVE: 'Active', VERY_ACTIVE: 'Very Active'
  };
  return map[level] || level || '—';
}

function updateSidebarUser() {
  const el = document.getElementById('sidebar-user-badge');
  if (el && userData) {
    el.textContent = `${userData.name || 'User'} · ${userData.goal?.replace('_', ' ') || ''}`;
  }
}

async function updateGoal() {
  const goal = document.getElementById('update-goal-sel').value;
  const activityLevel = document.getElementById('update-activity-sel').value;
  const weightKg = parseFloat(document.getElementById('update-weight-inp').value) || undefined;
  const msgEl = document.getElementById('update-goal-msg');
  const btn = document.querySelector('.update-goal-card .btn-primary');

  setLoading(btn, true);
  msgEl.classList.add('hidden');

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
  } finally {
    setLoading(btn, false);
  }
}

// ══════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.opacity = loading ? '0.4' : '1';
  if (loader) loader.classList.toggle('hidden', !loading);
}

let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--accent)';
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// Polyfill for roundRect (older browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
