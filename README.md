# ⚡ Smart EV Charging Slot Scheduling System

A full-stack web app to discover nearby EV charging stations, book time slots, manage reservations, and calculate energy requirements.

**Stack:** Python Flask · MySQL · Vanilla HTML/CSS/JS

---

## 📁 Project Structure

```
smart-ev-charging/
├── backend/
│   ├── app.py              # Flask entry point
│   ├── db.py               # MySQL connection helper
│   ├── migrate.py          # Database migration script
│   ├── routes/
│   │   ├── auth.py         # Login & Registration logic
│   │   ├── bookings.py     # Slot booking & cancellation logic
│   │   └── stations.py     # Station discovery & nearby search
│   ├── venv/               # Python Virtual Environment (Ignored)
│   ├── .env                # Local credentials (Ignored)
│   ├── .env.example        # Template for environment variables
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # SPA shell
│   ├── css/
│   │   ├── styles.css      # Dark EV theme
│   │   └── bg.png          # UI assets
│   ├── img/
│   │   └── ev_hero_bg.png  # Hero section visuals
│   └── js/
│       ├── admin.js        # Admin dashboard logic
│       ├── api.js          # Fetch helper + toast notifications
│       ├── app.js          # Page router + sidebar
│       ├── auth.js         # User authentication handling
│       ├── booking.js      # Slot booking flow
│       ├── calculator.js   # Energy & Duration calculator
│       ├── dashboard.js    # GPS + nearby stations logic
│       ├── my-bookings.js  # Booking management
│       ├── notifications.js # UI feedback system
│       └── stations.js     # Station table & filtering
└── README.md
```

---

## 🚀 Getting Started in VS Code

### 1 — Prerequisites

| Tool | Download |
|------|----------|
| Python 3.10+ | https://python.org |
| MySQL 8.0+ | https://dev.mysql.com/downloads/ |
| VS Code | https://code.visualstudio.com |

### 2 — Set Up the Database

Open your MySQL client and run the following commands to initialize the database:
```sql
CREATE DATABASE ev_charging_system;
USE ev_charging_system;
-- Run your table creation scripts here (user, station, chargingpoint, timeslot, booking)
```
### 3 — Configure Backend Environment

```bash
cd backend
copy .env.example .env     # Windows
# nano .env on Mac/Linux
```

Edit `.env` and set your MySQL credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password_here
DB_NAME=ev_charging
```

### 4 — Install Python Dependencies

Open a terminal in VS Code (`Ctrl+`` `) and run:

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
```

### 5 — Run the Backend

```bash
# (still inside backend/ with venv active)
python app.py
```

You should see:
```
🚗  Smart EV Charging API running on http://localhost:5000
```

### 6 — Open the Frontend

**Option A — Direct (simplest):**
Open `frontend/index.html` directly in your browser (double-click or drag to Chrome/Edge).

**Option B — Local server (recommended for GPS):**
```bash
cd frontend
python -m http.server 8080
# Open http://localhost:8080 in browser
```

> ⚠️ Browser GPS requires either `localhost` or HTTPS. Use Option B for the Dashboard GPS feature.

---

## 🔌 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/health` | Health check |Haversine formula
| `GET` | `/stations` | All stations with available point count |
| `GET` | `/nearby-stations?lat=&lng=` | Stations sorted by distance (Haversine) |
| `GET` | `/slots/<station_id>?date=YYYY-MM-DD` | Slot availability per point |
| `POST` | `/book-slot` | Create booking (JSON body) |
| `GET` | `/my-bookings?user_id=1` | User's bookings |
| `DELETE` | `/cancel-booking/<id>` | Cancel booking |

### POST /book-slot — Request Body

```json
{
  "user_id": 1,
  "point_id": 3,
  "slot_id": 5,
  "booking_date": "2026-03-14"
}
```

---

## ✅ Key Features

| Feature | Implementation |
|---------|---------------|
| **Double booking prevention** | MySQL `UNIQUE(point_id, slot_id, booking_date)` + `IntegrityError` catch |
| **Nearby station sort** | Haversine formula in Python — no external library |
| **Late cancellation** | Checks if now < 30 min before slot start → sets `Late Cancellation` status |
| **GPS detection** | `navigator.geolocation.getCurrentPosition()` |
| **Energy calculator** | `Energy = distance / efficiency`, `Duration = energy / charger_power` |

---

## 🧪 VS Code Extensions (Recommended)

- **Python** (Microsoft) — IntelliSense for Flask
- **Live Server** — Serve frontend with hot reload
- **REST Client** — Test API endpoints from `.http` files
- **MySQL** (cweijan) — Browse database in VS Code

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Database connection failed` | Check `.env` credentials and MySQL service is running |
| `CORS error` in browser | Ensure backend is running on port 5000 |
| GPS not working | Serve frontend via `http.server` on localhost |
| `Module not found` | Activate venv and run `pip install -r requirements.txt` |
| Double booking error | Expected — unique constraint is working correctly |
