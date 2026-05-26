# GymCal Frontend 🏋️⚡
> Premium AI-Powered Nutrition Tracker — Vanilla JS + HTML/CSS

---

## 📁 Files
```
gymcal-frontend/
├── index.html      — full single-page app
├── style.css       — premium dark industrial UI
├── app.js          — all logic + API calls
├── vercel.json     — Vercel deploy config
└── README.md
```

---

## 🔧 Local Setup

1. Update `API_BASE` in `app.js` if your backend runs elsewhere:
   ```js
   const API_BASE = 'http://localhost:8080/api';
   ```

2. Open `index.html` in a browser, OR serve locally:
   ```bash
   npx serve .
   # or
   python3 -m http.server 3000
   ```

---

## ☁️ Deploy FREE on Vercel

1. Push this folder to a **GitHub repo**
2. Go to https://vercel.com → New Project → Import repo
3. Framework: **Other** (Static)
4. Root directory: `gymcal-frontend`
5. Deploy!

After deploy, update your **backend** `CORS_ORIGINS` env var:
```
CORS_ORIGINS=https://your-app.vercel.app
```

---

## 🖥️ Features

| Feature | Description |
|---------|-------------|
| **Registration** | Name, email, password + BMI inputs + goal selection |
| **Login** | JWT auth, token stored in localStorage |
| **Dashboard** | Animated calorie ring, macro progress bars, today's meals |
| **AI Food Search** | Type any food → backend calls Anthropic API → shows full nutrition |
| **Add to Log** | Select meal type, add searched food to daily log |
| **Delete Entries** | Remove food items from log |
| **Weekly Chart** | Canvas bar chart showing 7-day calorie history |
| **Profile** | BMI display with category indicator, daily macro targets |
| **Update Goals** | Change goal/activity/weight → targets recalculated instantly |

---

## 🔗 API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/user/profile` | Load profile + targets |
| PUT | `/user/goal` | Update goal/activity/weight |
| POST | `/food/search` | AI nutrition lookup |
| POST | `/food/log` | Add food to daily log |
| GET | `/food/daily` | Today's summary + meals |
| GET | `/food/weekly` | Last 7 days summary |
| DELETE | `/food/log/{id}` | Remove log entry |

---

## 💡 Customization

- **Backend URL**: Change `API_BASE` at top of `app.js`
- **Theme**: All colors in `:root` in `style.css`
- **Branding**: Change `⚡ GymCal` in `index.html`
