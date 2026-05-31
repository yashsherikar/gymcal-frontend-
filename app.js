/* GymCal Premium App.js */
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://gymcal-backend-1.onrender.com/api';

let token = localStorage.getItem('gymcal_token') || null;
let userData = null, currentFood = null, currentPlan = null;

// ── ANIMATED BG ──────────────────────────────────────────────
(function(){
  const canvas = document.getElementById('bg-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W,H,pts=[];
  function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; }
  function init(){ pts=[]; const n=Math.floor(W*H/18000);
    for(let i=0;i<n;i++) pts.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.3,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,op:Math.random()*.35+.1,c:['#b9ff4b','#4bf5ff','#a78bfa'][Math.floor(Math.random()*3)]}); }
  function draw(){ ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(185,255,75,0.02)';ctx.lineWidth=1;
    for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.c;ctx.globalAlpha=p.op;ctx.fill();ctx.globalAlpha=1;p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;});
    requestAnimationFrame(draw); }
  resize();init();draw();
  addEventListener('resize',()=>{resize();init();});
})();

document.addEventListener('DOMContentLoaded',()=>{
  updateGreeting();
  if(token) showApp();
  setTimeout(()=>{
    const fi=document.getElementById('food-name-input');
    if(fi) fi.addEventListener('keydown',e=>{if(e.key==='Enter')searchFood();});
    const lp=document.getElementById('login-password');
    if(lp) lp.addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();});
  },300);
});

function updateGreeting(){
  const h=new Date().getHours();
  const g=h<12?'Good Morning 👋':h<17?'Good Afternoon 👋':'Good Evening 👋';
  setEl('greeting-text',g);
  setEl('greeting-date',new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
}

// ── API ──────────────────────────────────────────────────────
async function api(method,path,body=null){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(token) opts.headers['Authorization']=`Bearer ${token}`;
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch(`${API_BASE}${path}`,opts);
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||data.message||'Request failed');
  return data;
}

// ── AUTH ─────────────────────────────────────────────────────
function toggleAuth(mode){
  document.getElementById('login-form').classList.toggle('hidden',mode==='register');
  document.getElementById('register-form').classList.toggle('hidden',mode!=='register');
}
function selectGoal(el){
  document.querySelectorAll('.goal-card').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}
async function handleLogin(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  const btn=document.querySelector('#login-form .btn-primary');
  if(!email||!password){showError(errEl,'Fill all fields');return;}
  setLoading(btn,true); errEl.classList.add('hidden');
  try{ const d=await api('POST','/auth/login',{email,password});
    token=d.token; localStorage.setItem('gymcal_token',token); userData=d; showApp();
  }catch(e){showError(errEl,e.message);}finally{setLoading(btn,false);}
}
async function handleRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const password=document.getElementById('reg-password').value;
  const weightKg=parseFloat(document.getElementById('reg-weight').value);
  const heightCm=parseFloat(document.getElementById('reg-height').value);
  const age=parseInt(document.getElementById('reg-age').value);
  const gender=document.getElementById('reg-gender').value;
  const activityLevel=document.getElementById('reg-activity').value;
  const goalEl=document.querySelector('.goal-card.active');
  const goal=goalEl?goalEl.dataset.goal:'MAINTAIN';
  const errEl=document.getElementById('reg-error');
  const btn=document.querySelector('#register-form .btn-primary');
  if(!name||!email||!password||!weightKg||!heightCm||!age){showError(errEl,'Fill all fields');return;}
  setLoading(btn,true); errEl.classList.add('hidden');
  try{ const d=await api('POST','/auth/register',{name,email,password,weightKg,heightCm,age,gender,goal,activityLevel});
    token=d.token; localStorage.setItem('gymcal_token',token); userData=d; showApp();
  }catch(e){showError(errEl,e.message);}finally{setLoading(btn,false);}
}
function handleLogout(){
  token=null; userData=null; localStorage.removeItem('gymcal_token');
  document.getElementById('app-screen').className='screen hidden';
  document.getElementById('auth-screen').className='screen active';
}

// ── APP ──────────────────────────────────────────────────────
async function showApp(){
  document.getElementById('auth-screen').className='screen hidden';
  document.getElementById('app-screen').className='screen active';
  try{
    userData=await api('GET','/user/profile');
    updateSidebarUser(); populateProfilePage();
  }catch(e){ if(e.message.includes('401')){handleLogout();return;} }
  showPage('dashboard');
}
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.classList.add('hidden');});
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
  const pg=document.getElementById(`page-${page}`);
  if(pg){pg.classList.remove('hidden');pg.classList.add('active');}
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l=>l.classList.add('active'));
  if(page==='dashboard') loadDashboard();
  if(page==='food') loadFoodPage();
  if(page==='weekly') loadWeekly();
  if(page==='profile') populateProfilePage();
  if(page==='workout') loadWorkoutPage();
}
function toggleMobileMenu(){document.getElementById('mobile-nav').classList.toggle('hidden');}
function closeMobileMenu(){document.getElementById('mobile-nav').classList.add('hidden');}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard(){
  try{const s=await api('GET','/food/daily'); renderDashboard(s);}
  catch(e){showToast('Could not load dashboard','error');}
}
function renderDashboard(s){
  if(!s) return;
  const pct=Math.min((s.calorieProgress||0)/100,1);
  const fill=document.getElementById('calorie-ring-fill');
  if(fill) fill.style.strokeDashoffset=502*(1-pct);
  setEl('ring-consumed',Math.round(s.consumedCalories||0));
  const rem=Math.round(s.remainingCalories||0);
  setEl('ring-remaining',rem>0?`${rem} kcal left`:'🎯 Goal reached!');
  if(userData) setEl('ring-target-label',`of ${Math.round(userData.dailyCalorieTarget||0)} kcal target`);

  const tP=userData?.dailyProteinTarget||1,tC=userData?.dailyCarbTarget||1,tF=userData?.dailyFatTarget||1;
  setEl('dash-protein',`${Math.round(s.consumedProtein||0)}g`);
  setEl('dash-carbs',`${Math.round(s.consumedCarbs||0)}g`);
  setEl('dash-fat',`${Math.round(s.consumedFat||0)}g`);
  setStyle('dash-protein-bar','width',`${Math.min((s.consumedProtein/tP)*100,100)}%`);
  setStyle('dash-carbs-bar','width',`${Math.min((s.consumedCarbs/tC)*100,100)}%`);
  setStyle('dash-fat-bar','width',`${Math.min((s.consumedFat/tF)*100,100)}%`);
  setEl('dash-protein-target',`of ${Math.round(tP)}g`);
  setEl('dash-carbs-target',`of ${Math.round(tC)}g`);
  setEl('dash-fat-target',`of ${Math.round(tF)}g`);

  // Good/Bad calories
  const good=Math.round(s.goodCalories||0), bad=Math.round(s.badCalories||0), carb=Math.round(s.carbCalories||0);
  if(good+bad+carb>0){
    document.getElementById('calqual-row').style.display='grid';
    setEl('dash-good-cal',good+' kcal'); setEl('dash-bad-cal',bad+' kcal'); setEl('dash-carb-cal',carb+' kcal');
    const q=calcQuality(good,bad);
    setEl('dash-qual-text',q.label); setEl('dash-qual-emoji',q.emoji);
  }
  renderMealsList('today-meals-list',s.meals||[]);
}

function calcQuality(good,bad){
  if(bad===0&&good>0) return{label:'Excellent',emoji:'🌟'};
  if(good>bad*2)  return{label:'Excellent',emoji:'🌟'};
  if(good>bad)    return{label:'Good',emoji:'✅'};
  if(good>bad*.5) return{label:'Moderate',emoji:'⚠️'};
  return{label:'Poor',emoji:'❌'};
}

function renderMealsList(cid,meals){
  const c=document.getElementById(cid); if(!c) return;
  if(!meals||!meals.length){c.innerHTML=`<div class="empty-state">No food logged yet. <a onclick="showPage('food')">Add your first meal →</a></div>`;return;}
  c.innerHTML=meals.map(m=>`
    <div class="meal-group">
      <div class="meal-group-header"><span>${mealEmoji(m.mealType)} ${m.mealType}</span><span class="meal-group-kcal">${Math.round(m.totalCalories||0)} kcal</span></div>
      ${(m.items||[]).map(i=>`
        <div class="food-item">
          <div class="food-item-left">
            <div class="food-item-name">${i.foodName}</div>
            <div class="food-item-macros">${fmtQty(i)} · P:${Math.round(i.proteinGrams||0)}g · C:${Math.round(i.carbsGrams||0)}g · F:${Math.round(i.fatGrams||0)}g</div>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="food-item-cal">${Math.round(i.calories||0)} kcal</div>
            ${i.goodCalories>0?`<span class="cal-badge good">🟢${Math.round(i.goodCalories)}</span>`:''}
            <button class="btn-delete" onclick="deleteLog('${i.id}')" title="Remove">✕</button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}
function fmtQty(i){
  if(i.quantityUnit&&i.quantityUnit!=='grams') return `${i.quantityAmount}${i.quantityUnit} (${i.quantityGrams}g)`;
  return `${i.quantityGrams||i.quantityAmount}g`;
}
function mealEmoji(t){return{BREAKFAST:'🌅',LUNCH:'☀️',DINNER:'🌙',SNACK:'🍿'}[t]||'🍽️';}

// ── FOOD ─────────────────────────────────────────────────────
async function loadFoodPage(){
  try{const s=await api('GET','/food/daily'); renderMealsList('food-log-list',s.meals||[]);}
  catch(e){console.error(e);}
}
async function searchFood(){
  const name=document.getElementById('food-name-input').value.trim();
  const qty=parseFloat(document.getElementById('food-qty-input').value)||100;
  const unit=document.getElementById('food-unit-select').value;
  const errEl=document.getElementById('food-search-error');
  const loadEl=document.getElementById('food-search-loading');
  const resultEl=document.getElementById('food-search-result');
  if(!name){showError(errEl,'Enter food name');return;}
  errEl.classList.add('hidden'); resultEl.classList.add('hidden');
  loadEl.classList.remove('hidden');
  try{
    const d=await api('POST','/food/search',{foodName:name,quantityAmount:qty,quantityUnit:unit});
    currentFood=d; renderFoodResult(d);
  }catch(e){showError(errEl,e.message);}
  finally{loadEl.classList.add('hidden');}
}
function renderFoodResult(d){
  setEl('result-name',d.foodName);
  const qLabel=d.quantityUnit&&d.quantityUnit!=='grams'?`${d.quantityAmount} ${d.quantityUnit} (${d.quantityGrams}g)`:`${d.quantityGrams}g`;
  setEl('result-qty',qLabel);
  const q=d.calQuality||''; 
  const qEl=document.getElementById('result-quality');
  if(qEl){qEl.textContent=q;qEl.className='result-quality '+q.toLowerCase();}
  setEl('res-cal',Math.round(d.calories||0));
  setEl('res-pro',`${Math.round(d.proteinGrams||0)}g`);
  setEl('res-car',`${Math.round(d.carbsGrams||0)}g`);
  setEl('res-fat',`${Math.round(d.fatGrams||0)}g`);
  setEl('res-fib',`${Math.round(d.fiberGrams||0)}g`);
  setEl('res-good-cal',Math.round(d.goodCalories||0));
  setEl('res-bad-cal',Math.round(d.badCalories||0));
  setEl('res-carb-cal',Math.round(d.carbCalories||0));
  setEl('result-ai',d.aiAnalysis||'');
  document.getElementById('food-search-result').classList.remove('hidden');
}
async function addToLog(){
  if(!currentFood) return;
  const mealType=document.getElementById('meal-type-select').value;
  const today=new Date().toISOString().split('T')[0];
  const btn=document.querySelector('.add-to-log-row .btn-primary');
  setLoading(btn,true);
  try{
    await api('POST','/food/log',{
      foodName:currentFood.foodName,
      quantityAmount:currentFood.quantityAmount, quantityUnit:currentFood.quantityUnit,
      quantityGrams:currentFood.quantityGrams,
      mealType,logDate:today,
      calories:currentFood.calories, proteinGrams:currentFood.proteinGrams,
      carbsGrams:currentFood.carbsGrams, fatGrams:currentFood.fatGrams,
      fiberGrams:currentFood.fiberGrams||0,
      goodCalories:currentFood.goodCalories||0, badCalories:currentFood.badCalories||0,
      carbCalories:currentFood.carbCalories||0,
      aiAnalysis:currentFood.aiAnalysis
    });
    showToast(`✓ ${currentFood.foodName} added!`);
    currentFood=null;
    document.getElementById('food-search-result').classList.add('hidden');
    document.getElementById('food-name-input').value='';
    document.getElementById('food-qty-input').value='100';
    document.getElementById('food-unit-select').value='grams';
    loadFoodPage();
  }catch(e){showToast('Failed: '+e.message,'error');}
  finally{setLoading(btn,false);}
}
async function deleteLog(id){
  try{await api('DELETE',`/food/log/${id}`); showToast('Removed'); loadFoodPage(); loadDashboard();}
  catch(e){showToast('Delete failed','error');}
}

// ── WORKOUT ──────────────────────────────────────────────────
async function loadWorkoutPage(){
  try{
    const plan=await api('GET','/workout/active');
    if(plan&&plan.weeklyPlan&&plan.weeklyPlan.length>0){currentPlan=plan;showWorkoutPlan(plan);}
    else showWorkoutForm();
  }catch(e){showWorkoutForm();}
}
function showWorkoutForm(){
  document.getElementById('workout-form-section').classList.remove('hidden');
  document.getElementById('workout-plan-section').classList.add('hidden');
}
function showWorkoutPlan(plan){
  document.getElementById('workout-form-section').classList.add('hidden');
  document.getElementById('workout-plan-section').classList.remove('hidden');
  renderWorkoutPlan(plan);
}

const selectedConditions=new Set();
function toggleCondition(el){
  const val=el.dataset.val;
  if(val==='none'){selectedConditions.clear();document.querySelectorAll('.condition-chip').forEach(c=>c.classList.remove('active'));}
  else{document.querySelector('[data-val="none"]').classList.remove('active');}
  if(el.classList.contains('active')){el.classList.remove('active');selectedConditions.delete(val);}
  else{el.classList.add('active');selectedConditions.add(val);}
}

async function generateWorkoutPlan(){
  const btn=document.getElementById('generate-plan-btn');
  const errEl=document.getElementById('workout-gen-error');
  const conditions=[...selectedConditions].filter(c=>c!=='none');
  const fitnessLevel=document.getElementById('fitness-level-sel').value;
  const workoutDaysPerWeek=parseInt(document.getElementById('workout-days-sel').value);
  const equipment=[document.getElementById('equipment-sel').value];
  const additionalNotes=document.getElementById('workout-notes').value;
  setLoading(btn,true); errEl.classList.add('hidden');
  try{
    const plan=await api('POST','/workout/generate',{healthConditions:conditions,fitnessLevel,workoutDaysPerWeek,equipment,additionalNotes});
    currentPlan=plan; showWorkoutPlan(plan); showToast('✓ Workout plan generated!');
  }catch(e){showError(errEl,e.message);}
  finally{setLoading(btn,false);}
}

function renderWorkoutPlan(plan){
  setEl('plan-name',plan.planName||'My Workout Plan');
  setEl('plan-difficulty',plan.difficultyLevel||'');
  setEl('plan-goal',fmtGoal(plan.goal));
  setEl('plan-cals-burned',`~${plan.estimatedWeeklyCaloriesBurned||0} kcal/week`);

  const advEl=document.getElementById('plan-advice');
  if(advEl&&plan.generalAdvice){advEl.innerHTML=`<span class="advice-icon">💡</span><p>${plan.generalAdvice}</p>`;}

  const safeEl=document.getElementById('plan-safety');
  if(safeEl&&plan.safetyNotes&&plan.safetyNotes.trim()){
    safeEl.classList.remove('hidden');
    safeEl.innerHTML=`<span class="advice-icon">⚠️</span><p>${plan.safetyNotes}</p>`;
  }

  const today=new Date().toLocaleDateString('en',{weekday:'long'});
  const grid=document.getElementById('weekly-workout-grid'); if(!grid) return;
  grid.innerHTML=(plan.weeklyPlan||[]).map(day=>{
    const isToday=today.startsWith(day.day);
    if(day.isRestDay) return `
      <div class="workout-day-card rest ${isToday?'today':''}">
        <div class="day-header"><div class="day-name">${day.day}</div><div class="day-focus rest-badge">😴 Rest Day</div></div>
        <p class="rest-msg">Recovery is part of the plan. Stay hydrated!</p>
      </div>`;
    return `
      <div class="workout-day-card ${isToday?'today':''}">
        <div class="day-header">
          <div class="day-name">${day.day}${isToday?' <span class="today-chip">Today</span>':''}</div>
          <div class="day-focus">${day.focus||''}</div>
        </div>
        <div class="day-meta">
          <span>⏱ ${day.estimatedDuration||0} min</span>
          <span>🔥 ${day.estimatedCaloriesBurned||0} kcal</span>
        </div>
        <div class="exercises-list">
          ${(day.exercises||[]).map(ex=>`
            <div class="exercise-item">
              <div class="ex-header">
                <span class="ex-name">${ex.name}</span>
                <span class="ex-cat">${ex.category||''}</span>
              </div>
              <div class="ex-meta">
                ${ex.sets?`<span>📦 ${ex.sets} sets</span>`:''}
                ${ex.reps?`<span>🔁 ${ex.reps} reps</span>`:''}
                ${ex.duration?`<span>⏱ ${ex.duration}</span>`:''}
                ${ex.rest?`<span>💤 ${ex.rest} rest</span>`:''}
              </div>
              ${ex.instructions?`<div class="ex-instructions">${ex.instructions}</div>`:''}
              ${ex.modification?`<div class="ex-modification">💡 Easier: ${ex.modification}</div>`:''}
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}
function fmtGoal(g){return{WEIGHT_LOSS:'🔥 Weight Loss',MUSCLE_GAIN:'💪 Muscle Gain',MAINTAIN:'⚖️ Maintain',RECOMPOSITION:'🔄 Recomp'}[g]||g||'';}

// ── WEEKLY ───────────────────────────────────────────────────
async function loadWeekly(){
  try{const d=await api('GET','/food/weekly'); renderWeekly(d);}
  catch(e){showToast('Could not load weekly','error');}
}
function renderWeekly(days){
  if(!days||!days.length) return;
  const today=new Date().toISOString().split('T')[0];
  const active=days.filter(d=>d.consumedCalories>0);
  const avgCal=active.length?Math.round(active.reduce((a,d)=>a+d.consumedCalories,0)/active.length):0;
  const avgPro=active.length?Math.round(active.reduce((a,d)=>a+(d.consumedProtein||0),0)/active.length):0;
  setEl('ws-avg-cal',avgCal||'—'); setEl('ws-avg-pro',avgPro?`${avgPro}g`:'—');
  setEl('ws-days-logged',`${active.length}/7`);
  setEl('ws-goal-hit',`${Math.round((days.filter(d=>d.calorieProgress>=70).length/7)*100)}%`);

  const canvas=document.getElementById('weekly-chart');
  if(canvas){
    const W=canvas.parentElement.clientWidth-48||600,H=200;
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const max=Math.max(...days.map(d=>d.consumedCalories||0),1);
    const bW=Math.floor((W/days.length)*.55),gap=W/days.length;
    days.forEach((d,i)=>{
      const x=i*gap+(gap-bW)/2,cH=((d.consumedCalories||0)/max)*(H-50),y=H-cH-30;
      const isT=d.date===today;
      const g=ctx.createLinearGradient(0,y,0,H-30);
      isT?(g.addColorStop(0,'#b9ff4b'),g.addColorStop(1,'rgba(185,255,75,.3)')):(g.addColorStop(0,'#1e2a1e'),g.addColorStop(1,'rgba(30,42,30,.2)'));
      ctx.fillStyle=g;
      if(cH>0){ctx.beginPath();const r=5;ctx.moveTo(x+r,y);ctx.arcTo(x+bW,y,x+bW,y+r,r);ctx.lineTo(x+bW,H-30);ctx.lineTo(x,H-30);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();ctx.fill();}
      ctx.fillStyle=isT?'#b9ff4b':'#555d6b';ctx.font=`${isT?'600':'400'} 11px DM Sans,sans-serif`;ctx.textAlign='center';
      ctx.fillText(new Date(d.date).toLocaleDateString('en',{weekday:'short'}),x+bW/2,H-12);
      if(d.consumedCalories>0){ctx.fillStyle=isT?'#b9ff4b':'#3a4248';ctx.font='600 10px DM Mono,monospace';ctx.fillText(Math.round(d.consumedCalories),x+bW/2,Math.max(y-8,14));}
    });
  }
  const list=document.getElementById('weekly-list');
  list.innerHTML=[...days].reverse().map(d=>{
    const isT=d.date===today;
    const pct=Math.min(d.calorieProgress||0,100);
    return `<div class="weekly-day-card ${isT?'today':''}">
      <div class="weekly-day-label">${isT?'⚡ Today':new Date(d.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</div>
      <div class="weekly-day-bar-wrap"><div class="weekly-day-bar" style="width:${pct}%"></div></div>
      <div class="weekly-day-cal">${Math.round(d.consumedCalories||0)} / ${Math.round(d.targetCalories||0)} kcal</div>
    </div>`; }).join('');
}

// ── PROFILE ──────────────────────────────────────────────────
function populateProfilePage(){
  if(!userData) return;
  const bmi=userData.bmi||0;
  setEl('profile-bmi',bmi.toFixed(1)); setEl('profile-bmi-cat',userData.bmiCategory||'');
  setStyle('bmi-indicator','left',`calc(${Math.min(Math.max((bmi-15)/25,0),1)*92}% - 6px)`);
  setEl('pt-cal',`${Math.round(userData.dailyCalorieTarget||0)} kcal`);
  setEl('pt-pro',`${Math.round(userData.dailyProteinTarget||0)}g`);
  setEl('pt-car',`${Math.round(userData.dailyCarbTarget||0)}g`);
  setEl('pt-fat',`${Math.round(userData.dailyFatTarget||0)}g`);
  setEl('ps-name',userData.name||'—'); setEl('ps-weight',`${userData.weightKg||'—'} kg`);
  setEl('ps-height',`${userData.heightCm||'—'} cm`); setEl('ps-goal',fmtGoal(userData.goal));
  setEl('ps-activity',userData.activityLevel||'—');
  const gs=document.getElementById('update-goal-sel'),as=document.getElementById('update-activity-sel');
  if(gs) gs.value=userData.goal||'MAINTAIN'; if(as) as.value=userData.activityLevel||'MODERATE';
  const wi=document.getElementById('update-weight-inp'); if(wi) wi.value=userData.weightKg||'';
}
function updateSidebarUser(){
  const el=document.getElementById('sidebar-user-badge');
  if(el&&userData) el.innerHTML=`<strong>${userData.name||'User'}</strong><br>${fmtGoal(userData.goal)}`;
}
async function updateGoal(){
  const goal=document.getElementById('update-goal-sel').value;
  const activityLevel=document.getElementById('update-activity-sel').value;
  const wv=document.getElementById('update-weight-inp').value;
  const weightKg=wv?parseFloat(wv):undefined;
  const btn=document.querySelector('.update-goal-card .btn-primary');
  const msgEl=document.getElementById('update-goal-msg');
  setLoading(btn,true); msgEl.classList.add('hidden');
  try{
    userData=await api('PUT','/user/goal',{goal,activityLevel,...(weightKg?{weightKg}:{})});
    msgEl.textContent='✓ Updated!'; msgEl.classList.remove('hidden');
    populateProfilePage(); updateSidebarUser(); showToast('Goals updated!');
    setTimeout(()=>msgEl.classList.add('hidden'),3000);
  }catch(e){showToast('Failed: '+e.message,'error');}
  finally{setLoading(btn,false);}
}

// ── UTILS ────────────────────────────────────────────────────
function setEl(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function setStyle(id,p,v){const e=document.getElementById(id);if(e)e.style[p]=v;}
function showError(el,msg){if(el){el.textContent=msg;el.classList.remove('hidden');}}
function setLoading(btn,on){
  if(!btn) return; btn.disabled=on;
  const t=btn.querySelector('.btn-text'),l=btn.querySelector('.btn-loader');
  if(t) t.style.opacity=on?.4:1; if(l) l.classList.toggle('hidden',!on);
}
let toastTimer;
function showToast(msg,type='success'){
  const t=document.getElementById('toast'); t.textContent=msg;
  t.style.borderLeftColor=type==='error'?'var(--danger)':'var(--accent)';
  t.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.add('hidden'),3500);
}
