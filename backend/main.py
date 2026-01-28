import os
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlmodel import Field, Session, SQLModel, create_engine, select
import requests

import google.generativeai as genai
from fastapi.responses import StreamingResponse
from pdf_export import generate_trip_pdf


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# -----------------------
# Database models
# -----------------------


class Trip(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    origin: Optional[str] = None
    destination: str
    days: int
    budget_level: str
    travelers: int
    travel_month: Optional[str] = None
    overview: str
    tips: str  # stored as newline-separated text
    estimated_total_budget: Optional[float] = None
    estimated_per_person: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    weather_summary: Optional[str] = None
    budget_breakdown: Optional[str] = None # JSON string for breakdown


class Day(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: int = Field(foreign_key="trip.id", index=True)
    day_number: int
    title: str
    summary: str
    places: str  # stored as newline-separated text


from database import get_session, init_db
from auth import router as auth_router, get_current_user, User


# -----------------------
# API models
# -----------------------


class TripRequest(BaseModel):
    origin: Optional[str] = None
    destination: str
    days: int
    budget_level: Optional[str] = "medium"  # low, medium, high
    travelers: Optional[int] = 1
    travel_month: Optional[str] = None
    preferences: Optional[List[str]] = None
    notes: Optional[str] = None
    user_id: Optional[str] = None


class DayPlan(BaseModel):
    day: int
    title: str
    summary: str
    places: List[str]


class TripPlan(BaseModel):
    id: Optional[int] = None
    destination: str
    days: int
    budget_level: str
    overview: str
    daily_plan: List[DayPlan]
    tips: List[str]
    estimated_total_budget: Optional[float] = None
    estimated_per_person: Optional[float] = None
    budget_breakdown: Optional[dict] = None # New field
    lat: Optional[float] = None
    lng: Optional[float] = None
    weather_summary: Optional[str] = None
    events: Optional[List[dict]] = None  # Google Events data
    hotels: Optional[List[dict]] = None  # Hotel recommendations
    restaurants: Optional[List[dict]] = None  # Restaurant recommendations


class TripSummary(BaseModel):
    id: int
    destination: str
    days: int
    budget_level: str
    travelers: int
    overview: str


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # List of {role: "user"|"model", content: "..."}
    user_id: Optional[str] = None




app = FastAPI(title="AI Trip Planner API")
app.include_router(auth_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_google_events(destination: str, lat: float = None, lng: float = None) -> List[dict]:
    """
    Fetch upcoming events from Google Events using SerpApi.
    Returns a list of event dictionaries with title, date, link, thumbnail.
    """
    if not SERPAPI_API_KEY:
        return []
    
    try:
        from serpapi import GoogleSearch
        
        params = {
            "engine": "google_events",
            "q": f"Events in {destination}",
            "api_key": SERPAPI_API_KEY,
            "hl": "en"
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        events_results = results.get("events_results", [])
        
        # Extract top 5 events
        events = []
        for event in events_results[:5]:
            events.append({
                "title": event.get("title", ""),
                "date": event.get("date", {}).get("when", ""),
                "address": event.get("address", [""])[0] if event.get("address") else "",
                "link": event.get("link", ""),
                "thumbnail": event.get("thumbnail", "")
            })
        
        return events
    except Exception as e:
        print(f"Error fetching events: {e}")
        return []


def fetch_hotels(destination: str, check_in: str = None, check_out: str = None) -> List[dict]:
    """
    Fetch hotel recommendations using SerpApi Google Hotels.
    Returns list of hotels with name, rating, price, image, link.
    """
    if not SERPAPI_API_KEY:
        return []
    
    try:
        from serpapi import GoogleSearch
        
        params = {
            "engine": "google_hotels",
            "q": f"Hotels in {destination}",
            "api_key": SERPAPI_API_KEY,
            "hl": "en",
            "currency": "INR"
        }
        
        if check_in:
            params["check_in_date"] = check_in
        if check_out:
            params["check_out_date"] = check_out
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        properties = results.get("properties", [])
        
        # Extract top 6 hotels
        hotels = []
        for prop in properties[:6]:
            hotels.append({
                "name": prop.get("name", ""),
                "rating": prop.get("overall_rating", 0),
                "price": prop.get("rate_per_night", {}).get("extracted_lowest", "N/A"),
                "image": prop.get("images", [{}])[0].get("thumbnail", "") if prop.get("images") else "",
                "link": prop.get("link", ""),
                "description": prop.get("description", "")
            })
        
        return hotels
    except Exception as e:
        print(f"Error fetching hotels: {e}")
        return []


def fetch_restaurants(destination: str) -> List[dict]:
    """
    Fetch restaurant and street food recommendations using SerpApi Google Local.
    Returns list of restaurants with name, rating, price, image, type.
    """
    if not SERPAPI_API_KEY:
        return []
    
    try:
        from serpapi import GoogleSearch
        
        # Search for restaurants and street food
        params = {
            "engine": "google_maps",
            "q": f"restaurants and street food in {destination}",
            "type": "search",
            "api_key": SERPAPI_API_KEY,
            "hl": "en"
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        local_results = results.get("local_results", [])
        
        # Extract top 8 restaurants
        restaurants = []
        for place in local_results[:8]:
            restaurants.append({
                "name": place.get("title", ""),
                "rating": place.get("rating", 0),
                "reviews": place.get("reviews", 0),
                "price": place.get("price", ""),
                "type": place.get("type", "Restaurant"),
                "address": place.get("address", ""),
                "thumbnail": place.get("thumbnail", ""),
                "link": place.get("link", "")
            })
        
        return restaurants
    except Exception as e:
        print(f"Error fetching restaurants: {e}")
        return []


def build_prompt(payload: TripRequest) -> str:
    prefs = ", ".join(payload.preferences) if payload.preferences else "general sightseeing"
    return f"""
You are an expert travel planner.
Create a highly personalized, day-wise trip itinerary in JSON only (no extra text).

User details:
- Origin: {payload.origin or "Not specified"}
- Destination: {payload.destination}
- Days: {payload.days}
- Budget level: {payload.budget_level}
- Number of travelers: {payload.travelers}
- Travel month/season: {payload.travel_month or "Not specified"}
- Preferences: {prefs}
- Extra notes: {payload.notes or "None"}

Return JSON with this exact structure:
{{
  "destination": "...",
  "days": {payload.days},
  "budget_level": "{payload.budget_level}",
  "overview": "High-level summary of the trip tailored to the user.",
  "daily_plan": [
    {{
      "day": 1,
      "title": "Short title",
      "summary": "1-2 sentence summary of the day.",
      "places": ["Place 1", "Place 2", "Place 3"]
    }}
  ],
  "budget_breakdown": {{
      "accommodation": "Numerical value (INR)",
      "transport": "Numerical value (INR) (Include travel from {payload.origin or 'Origin'} to {payload.destination})",
      "food": "Numerical value (INR)",
      "activities": "Numerical value (INR)",
      "total": "Sum of above"
  }},
  "tips": [
    "Travel / packing / safety / budget optimization tips tailored to this trip"
  ]
}}
Ensure there are exactly {payload.days} entries in "daily_plan".
"""

def analyze_chat_intent(message: str, history: List[dict]) -> dict:
    """
    Uses Gemini to analyze the chat conversation.
    Returns a dict with 'action' (continue|plan_ready) and relevant data.
    """
    if not GEMINI_API_KEY:
        return {"action": "error", "response": "AI not configured."}
    
    model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    model = genai.GenerativeModel(model_name)
    
    # Construct context from history
    conversation_text = ""
    for msg in history[-5:]: # Use last 5 messages for context
        role = "User" if msg.get("role") == "user" else "Assistant"
        conversation_text += f"{role}: {msg.get('content')}\n"
    
    conversation_text += f"User: {message}\n"
    
    prompt = f"""
    You are a helpful AI travel assistant. Analyze the conversation below.
    Your goal is to gather these 5 pieces of information to plan a perfect trip:
    1. Origin (Where are they traveling from?)
    2. Destination (Where do they want to go?)
    3. Number of Days
    4. Number of Travelers
    5. Budget Level (low, medium, high)

    Conversation:
    {conversation_text}

    Instructions:
    - You must gather ALL 5 pieces of information.
    - Do NOT assume defaults for Origin, Travelers, or Budget. You must ask the user for these.
    - Defaults: You MAY assume "3 days" if the user doesn't specify duration but gives everything else.
    - If any information is missing, ask a natural, friendly follow-up question to get it. Group questions if multiple things are missing.
    - JSON Output Format:
      - If you need more info: {{ "action": "continue", "response": "Your natural language response asking for the missing details." }}
      - If you have enough info to plan: {{ "action": "plan_ready", "params": {{ "origin": "...", "destination": "...", "days": N, "travelers": N, "budget_level": "..." }} }}
    
    Return ONLY VALID JSON.
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text
        # Clean up code blocks if any
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        import json
        return json.loads(text.strip())
    except Exception as e:
        print(f"Chat Analysis Error: {e}")
        return {"action": "continue", "response": "I'm having trouble understanding. Could you please clarify where you want to go?"}



def estimate_budget(days: int, travelers: int, level: str) -> tuple[float, float]:
    base_per_day = {"low": 40.0, "medium": 80.0, "high": 150.0}.get(level, 80.0)
    total = base_per_day * days * travelers
    return total, total / max(travelers, 1)


def geocode_destination(destination: str) -> tuple[Optional[float], Optional[float]]:
    if not MAPBOX_ACCESS_TOKEN:
        return None, None
    try:
        resp = requests.get(
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{destination}.json",
            params={"access_token": MAPBOX_ACCESS_TOKEN, "limit": 1},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features") or []
        if features:
            # Mapbox returns [lng, lat]
            coords = features[0].get("center") or []
            if len(coords) == 2:
                return float(coords[1]), float(coords[0])
    except Exception:
        # Best-effort only
        return None, None
    return None, None


def geocode_place_nominatim(place: str, city: str) -> tuple[Optional[float], Optional[float]]:
    """
    Geocode a place using Nominatim (OpenStreetMap's free geocoding API).
    Returns (lat, lng) tuple.
    """
    try:
        query = f"{place}, {city}"
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": query,
                "format": "json",
                "limit": 1
            },
            headers={"User-Agent": "AI-Trip-Planner/1.0"},
            timeout=5
        )
        resp.raise_for_status()
        data = resp.json()
        if data and len(data) > 0:
            return float(data[0]["lat"]), float(data[0]["lon"])
        return None, None
    except Exception as e:
        print(f"Geocoding error for {place}: {e}")
        return None, None


def fetch_weather(lat: Optional[float], lng: Optional[float]) -> Optional[str]:
    if not WEATHER_API_KEY or lat is None or lng is None:
        return None
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"lat": lat, "lon": lng, "appid": WEATHER_API_KEY, "units": "metric"},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        main = data.get("weather", [{}])[0].get("description", "")
        temp = data.get("main", {}).get("temp")
        feels = data.get("main", {}).get("feels_like")
        if temp is not None and feels is not None:
            return f"Current weather: {main}, {temp:.1f}°C (feels like {feels:.1f}°C)"
        if main:
            return f"Current weather: {main}"
    except Exception:
        return None
    return None


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/plan-trip", response_model=TripPlan)
async def plan_trip(request: TripRequest, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Override user_id from the authenticated user
    request.user_id = current_user.username

    def create_and_save_dummy_trip() -> TripPlan:
        """
        Build a demo / fallback itinerary and persist it.
        Used when GEMINI_API_KEY is missing or Gemini API fails.
        """
        total, per_person = estimate_budget(
            request.days, request.travelers or 1, request.budget_level or "medium"
        )
        lat, lng = geocode_destination(request.destination)
        weather = fetch_weather(lat, lng)
        dummy = TripPlan(
            destination=request.destination,
            days=request.days,
            budget_level=request.budget_level or "medium",
            overview=(
                "Demo itinerary because the AI trip planner is not fully configured. "
                "Set GEMINI_API_KEY / GEMINI_MODEL for real AI planning."
            ),
            daily_plan=[
                DayPlan(
                    day=i + 1,
                    title=f"Day {i + 1} in {request.destination}",
                    summary="Sample summary. Configure GEMINI_API_KEY for real AI planning.",
                    places=[f"Sample place {j + 1}" for j in range(3)],
                )
                for i in range(request.days)
            ],
            tips=[
                "Set GEMINI_API_KEY in your backend environment.",
                "Optionally set GEMINI_MODEL (e.g. gemini-3-flash-preview).",
                "Restart the FastAPI server after setting the vars.",
            ],
            estimated_total_budget=total,
            estimated_per_person=per_person,
            lat=lat,
            lng=lng,
            weather_summary=weather,
        )
        # Persist even demo trips
        db_trip = Trip(
            user_id=request.user_id,
            origin=request.origin,
            destination=dummy.destination,
            days=dummy.days,
            budget_level=dummy.budget_level,
            travelers=request.travelers or 1,
            travel_month=request.travel_month,
            overview=dummy.overview,
            tips="\n".join(dummy.tips),
            estimated_total_budget=total,
            estimated_per_person=per_person,
            lat=lat,
            lng=lng,
            weather_summary=weather,
        )
        session.add(db_trip)
        session.commit()
        session.refresh(db_trip)
        for d in dummy.daily_plan:
            db_day = Day(
                trip_id=db_trip.id,
                day_number=d.day,
                title=d.title,
                summary=d.summary,
                places="\n".join(d.places),
            )
            session.add(db_day)
        session.commit()
        dummy.id = db_trip.id
        return dummy

    # If there's no API key configured at all, immediately fall back to demo data.
    if not GEMINI_API_KEY:
        return create_and_save_dummy_trip()

    # Use a valid, current Gemini model name.
    # Default to Gemini 3 Flash Preview. If this model isn't enabled in your
    # project/region, set GEMINI_MODEL to a supported ID from Google AI Studio.
    # Example: GEMINI_MODEL=gemini-3-flash-preview (or whatever exact string
    # your account shows) and restart the backend.
    model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    try:
        model = genai.GenerativeModel(model_name)
        prompt = build_prompt(request)
        response = model.generate_content(prompt)
    except Exception:
        # If Gemini fails for any reason (bad model, key, quota, etc.),
        # gracefully fall back to a demo itinerary instead of returning 5xx.
        return create_and_save_dummy_trip()
    text = response.text or "{}"

    # Very simple JSON extraction; in production, add stronger parsing/validation
    import json

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON between first and last curly brace
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = json.loads(text[start : end + 1])
        else:
            raise

    # Enrich with budget + geocoding
    total, per_person = estimate_budget(
        request.days, request.travelers or 1, request.budget_level or "medium"
    )
    lat, lng = geocode_destination(request.destination)
    weather = fetch_weather(lat, lng)
    events = fetch_google_events(request.destination, lat, lng)
    hotels = fetch_hotels(request.destination)
    restaurants = fetch_restaurants(request.destination)

    data.setdefault("budget_level", request.budget_level or "medium")
    data["estimated_total_budget"] = total
    data["estimated_per_person"] = per_person
    data["lat"] = lat
    data["lng"] = lng
    data["weather_summary"] = weather
    data["events"] = events
    data["hotels"] = hotels
    data["restaurants"] = restaurants

    trip_plan = TripPlan(**data)

    # Persist in DB
    db_trip = Trip(
        user_id=request.user_id,
        origin=request.origin,
        destination=trip_plan.destination,
        days=trip_plan.days,
        budget_level=trip_plan.budget_level,
        travelers=request.travelers or 1,
        travel_month=request.travel_month,
        overview=trip_plan.overview,
        tips="\n".join(trip_plan.tips),
        estimated_total_budget=trip_plan.estimated_total_budget,
        estimated_per_person=trip_plan.estimated_per_person,
        lat=trip_plan.lat,
        lng=trip_plan.lng,
        weather_summary=trip_plan.weather_summary,
        budget_breakdown=json.dumps(trip_plan.budget_breakdown) if trip_plan.budget_breakdown else None,
    )
    session.add(db_trip)
    session.commit()
    session.refresh(db_trip)

    for d in trip_plan.daily_plan:
        db_day = Day(
            trip_id=db_trip.id,
            day_number=d.day,
            title=d.title,
            summary=d.summary,
            places="\n".join(d.places),
        )
        session.add(db_day)
    session.commit()

    trip_plan.id = db_trip.id
    return trip_plan


@app.get("/api/trips", response_model=List[TripSummary])
async def list_trips(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    statement = select(Trip).where(Trip.user_id == current_user.username)
    trips = session.exec(statement).all()
    return [
        TripSummary(
            id=t.id,
            destination=t.destination,
            days=t.days,
            budget_level=t.budget_level,
            travelers=t.travelers,
            overview=t.overview,
        )
        for t in trips
    ]


@app.get("/api/trips/{trip_id}", response_model=TripPlan)
async def get_trip(trip_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    trip = session.get(Trip, trip_id)
    if not trip or trip.user_id != current_user.username:
        raise HTTPException(status_code=404, detail="Trip not found")

    days = session.exec(select(Day).where(Day.trip_id == trip_id).order_by(Day.day_number)).all()
    daily_plan = [
        DayPlan(
            day=d.day_number,
            title=d.title,
            summary=d.summary,
            places=d.places.split("\n") if d.places else [],
        )
        for d in days
    ]
    tips = trip.tips.split("\n") if trip.tips else []

    return TripPlan(
        id=trip.id,
        destination=trip.destination,
        days=trip.days,
        budget_level=trip.budget_level,
        overview=trip.overview,
        daily_plan=daily_plan,
        tips=tips,
        estimated_total_budget=trip.estimated_total_budget,
        estimated_per_person=trip.estimated_per_person,
        lat=trip.lat,
        lng=trip.lng,
        weather_summary=trip.weather_summary,
        budget_breakdown=json.loads(trip.budget_breakdown) if trip.budget_breakdown else None,
    )



@app.get("/api/trips/{trip_id}/pdf")
async def get_trip_pdf(trip_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    trip_data = await get_trip(trip_id, session, current_user)
    # get_trip returns a TripPlan Pydantic model
    
    # We also need to fetch travelers/travel_month for the header, which might be missing in TripPlan if not strictly persisted in that model
    # but TripPlan has 'travelers' in the Pydantic definition in main.py? 
    # Let's check TripPlan definition. 
    # main.py TripPlan definition:
    # class TripPlan(BaseModel): ... travelers is MISSING from TripPlan but present in TripSummary/TripRequest. 
    # Let's fix TripPlan first or just look up the DB model again here.
    
    db_trip = session.get(Trip, trip_id) # Re-fetch DB object to be sure
    if not db_trip: 
        raise HTTPException(status_code=404)
        
    # We need to construct a robust object for the PDF generator
    # We can reuse the same object structure or passable dict
    # Converting db_trip (SQLModel) to a structure pdf_export expects
    
    # Let's rely on the DB object + daily plans
    days = session.exec(select(Day).where(Day.trip_id == trip_id).order_by(Day.day_number)).all()
    
    # Monkey-patching / constructing a simple object for the PDF function
    class PdfTripData:
        destination = db_trip.destination
        days = db_trip.days
        budget_level = db_trip.budget_level
        travelers = db_trip.travelers
        overview = db_trip.overview
        estimated_total_budget = db_trip.estimated_total_budget
        tips = db_trip.tips.split('\n') if db_trip.tips else []
        daily_plan = days # list of Day objects (day_number, title, summary, places)

    pdf_buffer = generate_trip_pdf(PdfTripData())
    
    filename = f"Trip_to_{db_trip.destination}_{db_trip.days}Days.pdf".replace(" ", "_")
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/chat")
async def chat_interaction(request: ChatRequest, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """
    Conversational endpoint.
    Returns:
    - { "action": "continue", "response": "..." } (Assistant asks for more info)
    - { "action": "plan_ready", "response": "...", "plan": TripPlanObj } (Assistant generates plan)
    """
    analysis = analyze_chat_intent(request.message, request.history)
    
    if analysis.get("action") == "plan_ready":
        params = analysis.get("params", {})
        
        # Build the TripRequest
        trip_req = TripRequest(
            origin=params.get("origin"),
            destination=params.get("destination"),
            days=params.get("days", 3),
            travelers=params.get("travelers", 1),
            budget_level=params.get("budget_level", "medium"),
            user_id=current_user.username
        )
        
        # Call plan_trip logic (we reuse the logic but avoiding HTTP call overhead by extracting function or calling directly if feasible. 
        # Refactoring plan_trip is better, but for now we'll duplicate the call logic or simulate an internal call)
        
        # NOTE: To keep it DRY, we should have refactored plan_trip logic to a service function.
        # For now, let's just Instantiate the TripRequest and run the logic inline or call a helper.
        # Since 'plan_trip' is an endpoint that depends on Session, we can't easily call it directly without mocking Depends.
        # So I will replicate the core logic briefly or ideally refactor.
        # Let's Refactor slightly: we'll call a helper function `generate_trip_core`.
        
        # Validating params
        if not trip_req.destination:
             return {"action": "continue", "response": "I couldn't detect a destination. Where would you like to go?"}
             
        # Generate Plan
        # We need to use the `plan_trip` implementation manually here.
        # For simplicity in this step, I will execute the generation code here directly.
        
        # 1. Budget
        total, per_person = estimate_budget(trip_req.days, trip_req.travelers, trip_req.budget_level)
        # 2. Geocode
        lat, lng = geocode_destination(trip_req.destination)
        # 3. Weather
        weather = fetch_weather(lat, lng)
        # 4. Gemini Gen
        model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
        try:
             model = genai.GenerativeModel(model_name)
             prompt = build_prompt(trip_req)
             response = model.generate_content(prompt)
             text = response.text
             import json
             clean_text = text.strip()
             if clean_text.startswith("```json"): clean_text = clean_text[7:-3]
             data = json.loads(clean_text)
        except Exception as e:
             # Fallback
             print(f"Gen AI Error: {e}")
             return {
                 "action": "continue", 
                 "response": "I'm having trouble generating the plan right now. Please try again or provide more specific details."
             }

        data.setdefault("budget_level", trip_req.budget_level)
        data["estimated_total_budget"] = total
        data["estimated_per_person"] = per_person
        data["lat"] = lat
        data["lng"] = lng
        data["weather_summary"] = weather
        
        trip_plan = TripPlan(**data)
        
        # Persist
        db_trip = Trip(
            user_id=current_user.username,
            origin=trip_req.origin,
            destination=trip_plan.destination,
            days=trip_plan.days,
            budget_level=trip_plan.budget_level,
            travelers=trip_req.travelers,
            travel_month=trip_req.travel_month,
            overview=trip_plan.overview,
            tips="\n".join(trip_plan.tips),
            estimated_total_budget=trip_plan.estimated_total_budget,
            estimated_per_person=trip_plan.estimated_per_person,
            lat=trip_plan.lat,
            lng=trip_plan.lng,
            weather_summary=trip_plan.weather_summary,
        )
        session.add(db_trip)
        session.commit()
        session.refresh(db_trip)
        
        for d in trip_plan.daily_plan:
            db_day = Day(trip_id=db_trip.id, day_number=d.day, title=d.title, summary=d.summary, places="\n".join(d.places))
            session.add(db_day)
        session.commit()
        
        trip_plan.id = db_trip.id
        
        return {
            "action": "plan_ready",
            "response": f"I've planned a {trip_plan.days}-day trip to {trip_plan.destination} for you!",
            "plan": trip_plan
        }
    
    else:
        # Just continue conversation
        return {"action": "continue", "response": analysis.get("response", "Can you tell me more?")}



@app.delete("/api/trips/{trip_id}")
async def delete_trip(trip_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    trip = session.get(Trip, trip_id)
    if not trip or trip.user_id != current_user.username:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Delete child days first, then the trip
    days = session.exec(select(Day).where(Day.trip_id == trip_id)).all()
    for d in days:
        session.delete(d)
    session.delete(trip)
    session.commit()
    return {"status": "deleted", "trip_id": trip_id}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

