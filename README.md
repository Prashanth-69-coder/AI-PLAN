## Personalized Intelligent Voice-Assisted AI Trip Planning System

This is a **major-project level** implementation of an AI-based travel planner that:

- Accepts **text and voice input** from users
- Uses **Google Gemini** to generate **personalized, day-wise itineraries**
- Stores itineraries in a **database** so they can be viewed later
- Shows the trip on an interactive **Google Map**
- Provides **budget estimation** for the whole trip and per person

Tech stack:

- **Frontend**: React + Vite + TypeScript, `@react-google-maps/api`
- **Backend**: FastAPI, Gemini API (`google-generativeai`), SQLite + SQLModel

---

## 1. Features (for major project report)

- **AI-powered itinerary generation**
  - User enters origin, destination, days, budget level, travellers, season, and preferences.
  - Optional **voice input** for free-form trip description.
  - Backend calls **Gemini** to generate a **day-wise JSON itinerary** with titles, summaries, and places.

- **Personalization**
  - Considers **budget level** (low / medium / high), **travel month/season**, **number of travellers**, and **preferences** (beaches, adventure, food, etc.).
  - Generates **tips** tailored to the route and constraints.

- **Persistence (Database)**
  - Every generated itinerary is stored in **SQLite** with:
    - User id (simple string in this version)
    - Origin, destination, days, travellers
    - Overview, daily plan, tips
    - Budget estimation
    - Geocoded latitude / longitude
  - APIs to:
    - **List** all trips for a user
    - **View** a specific trip
    - **Delete** a trip

- **Budget Estimation**
  - Simple model:
    - Low: ~40 units / person / day
    - Medium: ~80 units / person / day
    - High: ~150 units / person / day
  - Shows **approx total** and **per person** cost in the UI (you can present it as INR or generic currency).

- **Google Maps integration**
  - Backend uses **Google Geocoding API** to convert destination into **lat/lng**.
  - Frontend centers the map on that coordinate and shows a marker with the destination name.

- **Voice Interaction**
  - Uses browser **Web Speech API (SpeechRecognition / webkitSpeechRecognition)**.
  - User clicks “Speak” and talks about their trip; transcript is appended to the notes field.

---

## 2. How to run (for evaluation/demo)

### 2.1. Backend (FastAPI + Gemini + SQLite)

1. Go to backend folder and install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Create a `.env` file inside `backend/`:

```bash
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
DATABASE_URL=sqlite:///./trip_planner.db
```

> For demo without internet or API keys, omit `GEMINI_API_KEY`. The app will still work with a **dummy itinerary**, but major-project explanation should mention that real AI requires the key.

3. Run FastAPI server:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

- Health check: open `http://localhost:8000/health`
- Swagger docs: open `http://localhost:8000/docs`

Important endpoints:

- `POST /api/plan-trip` – generate + save an itinerary using Gemini.
- `GET /api/trips` – list trips, optional `?user_id=demo-user`.
- `GET /api/trips/{trip_id}` – fetch one saved trip.
- `DELETE /api/trips/{trip_id}` – delete a trip.

### 2.2. Frontend (React + Vite)

1. Go to frontend folder and install:

```bash
cd frontend
npm install
```

2. Create a `.env` file inside `frontend/`:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

3. Run React app:

```bash
npm run dev
```

Open the shown URL (usually `http://localhost:5173`).

---

## 3. How the system works (flow for viva/diagram)

1. **User interaction (React UI)**
   - User fills form: origin, destination, days, travellers, budget, month, preferences.
   - Optionally clicks **Speak** and gives voice description (`TripForm` component).
   - Clicks **Generate Itinerary**.

2. **Backend AI generation (FastAPI)**
   - React sends POST `/api/plan-trip` with all fields + a simple `user_id`.
   - FastAPI constructs a **structured prompt** (`build_prompt`) for Gemini.
   - Gemini returns a JSON string describing:
     - destination, days, budget_level, overview
     - `daily_plan`: list of day objects (day number, title, summary, places)
     - `tips`: list of strings
   - Backend **parses JSON**, enriches it with:
     - Budget prediction (`estimate_budget`)
     - Latitude/longitude via Google Geocoding (`geocode_destination`)
   - Backend stores data in SQLite via SQLModel:
     - `Trip` table (overview, budget, lat/lng, etc.)
     - `Day` table (each row is one day with places list)
   - Returns a `TripPlan` object to the frontend.

3. **Frontend rendering**
   - `ItineraryView` shows:
     - Overview
     - Day-wise plan with titles, summary, and places
     - Travel tips
     - Budget banner (total + per-person)
   - `MapView`:
     - Displays Google Map centered on the coordinates returned by backend.
     - Shows a marker with destination name.

4. **Saved trips management**
   - `TripsList` component:
     - On app load, calls `GET /api/trips?user_id=demo-user`.
     - Displays a list of previously generated itineraries.
     - Clicking an item calls `GET /api/trips/{id}` and shows that itinerary.
     - Delete button calls `DELETE /api/trips/{id}` to remove it.

---

## 4. Files to highlight in your presentation

- **Backend**
  - `backend/main.py`
    - `TripRequest`, `TripPlan`, `DayPlan` Pydantic models
    - `Trip` and `Day` SQLModel tables
    - `build_prompt`, `estimate_budget`, `geocode_destination`
    - Endpoints: `/api/plan-trip`, `/api/trips`, `/api/trips/{id}`

- **Frontend**
  - `frontend/src/components/TripForm.tsx` – voice + text trip input
  - `frontend/src/components/ItineraryView.tsx` – day-wise AI itinerary + budget
  - `frontend/src/components/MapView.tsx` – Google Maps integration
  - `frontend/src/components/TripsList.tsx` – saved itinerary management
  - `frontend/src/App.tsx` – ties everything together

---

## 5. Possible extensions (for extra marks)

- Add **user authentication** so each student/user has their own login.
- Add **export to PDF** of itinerary.
- Add **cost breakdown** (stay, food, transport, activities).
- Use **Places API** to validate and show real photos/ratings of each place.

