
import { useEffect, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import TripForm, { TripFormValues } from "./components/TripForm"; // Keeping for explicit fallback if needed, or remove
import ChatInterface from "./components/ChatInterface";
import ItineraryView from "./components/ItineraryView";
import MapView from "./components/MapView";
import TripsList, { TripSummary } from "./components/TripsList";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import { fetchDestinationImage } from "./services/imageService";

export interface DayPlan {
  day: number;
  title: string;
  summary: string;
  places: string[];
}

export interface TripPlan {
  id?: number;
  destination: string;
  days: number;
  budget_level: string;
  overview: string;
  daily_plan: DayPlan[];
  tips: string[];
  estimated_total_budget?: number;
  estimated_per_person?: number;
  budget_breakdown?: {
    accommodation: string;
    transport: string;
    food: string;
    activities: string;
    total: string;
  };
  lat?: number | null;
  lng?: number | null;
  weather_summary?: string | null;
  events?: Array<{
    title: string;
    date: string;
    address: string;
    link: string;
    thumbnail: string;
  }>;
  hotels?: Array<{
    name: string;
    rating: number;
    price: string | number;
    image: string;
    link: string;
    description: string;
  }>;
  restaurants?: Array<{
    name: string;
    rating: number;
    reviews: number;
    price: string;
    type: string;
    address: string;
    thumbnail: string;
    link: string;
  }>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const DEFAULT_BG = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop";

function Dashboard() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [bgImage, setBgImage] = useState(DEFAULT_BG);

  const { username, logout } = useAuth();

  // Animation Variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const loadTrips = async () => {
    try {
      const res = await axios.get<TripSummary[]>(`${API_BASE_URL}/api/trips`);
      setTrips(res.data);
    } catch (e) {
      console.error("Failed to load trips", e);
    }
  };

  const loadTripById = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get<TripPlan>(`${API_BASE_URL}/api/trips/${id}`);
      setPlan(res.data);
      setSelectedTripId(id);

      // Fetch dynamic image
      fetchDestinationImage(res.data.destination).then(setBgImage);

    } catch (e) {
      setError("Failed to load saved trip.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (id: number) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/trips/${id}`);
      if (selectedTripId === id) {
        setPlan(null);
        setSelectedTripId(null);
        setBgImage(DEFAULT_BG);
      }
      loadTrips();
    } catch (e) {
      console.error("Failed to delete trip", e);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  // Handler for Chat Interface completion
  const handlePlanReady = (newPlan: TripPlan) => {
    setPlan(newPlan);
    setSelectedTripId(newPlan.id || null);
    fetchDestinationImage(newPlan.destination).then(setBgImage);
    loadTrips();
  };

  const handleSubmit = async (values: TripFormValues) => {
    try {
      setLoading(true);
      setError(null);
      setPlan(null);

      const res = await axios.post<TripPlan>(`${API_BASE_URL}/api/plan-trip`, {
        origin: values.origin,
        destination: values.destination,
        days: values.days,
        budget_level: values.budgetLevel,
        travelers: values.travelers,
        travel_month: values.travelMonth,
        preferences: values.preferences.filter(Boolean),
        notes: values.notes,
      });

      setPlan(res.data);
      setSelectedTripId(res.data.id ?? null);

      // Fetch dynamic image
      fetchDestinationImage(res.data.destination).then(setBgImage);

      loadTrips();
    } catch (e: unknown) {
      setError("Failed to generate trip plan. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    setPlan(null);
    setBgImage(DEFAULT_BG);
  };

  return (
    <div className="app-shell" style={{ overflowX: 'hidden' }}>
      {/* Dynamic Background */}
      <div className="fixed-bg" style={{
        backgroundImage: `url(${bgImage})`,
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: -1, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 1s ease-in-out'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}></div>
      </div>

      <header className="app-header glass-header" style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(10px)', background: 'rgba(23, 23, 23, 0.5)' }}>
        <div className="brand" onClick={handleBackToHome} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <i className="fa-solid fa-plane-up"></i>
          </div>
          <h1>AI Trip Planner</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="header-subtitle mobile-hide" style={{ display: 'flex', alignItems: 'center' }}>
            <i className="fa-solid fa-user-circle" style={{ marginRight: '0.4rem', color: '#06b6d4' }}></i>
            <span>Hello, {username || 'Traveler'}</span>
          </div>
          <button onClick={logout} className="primary-button" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <AnimatePresence mode="wait">
          {!plan ? (
            // LANDING / FORM VIEW
            <motion.div
              key="landing"
              initial="initial" animate="animate" exit="exit" variants={pageVariants}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 1fr', gap: '4rem', alignItems: 'center', minHeight: '80vh' }}
            >
              <div className="landing-content">
                <h2 style={{ fontSize: '3.5rem', lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Your Next Adventure Awaits
                </h2>
                <p style={{ fontSize: '1.2rem', color: '#cbd5e1', marginBottom: '3rem', maxWidth: '600px' }}>
                  Experience the future of travel planning. Intelligent itineraries, smart budgeting, and seamless visualization—powered by AI.
                </p>

                {/* Chat Interface for Landing */}
                <ChatInterface onPlanReady={handlePlanReady} />

              </div>

              <div className="landing-visuals" style={{ position: 'relative' }}>
                {/* Recent Trips List for Quick Access */}
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <TripsList
                    trips={trips}
                    selectedTripId={selectedTripId}
                    onSelect={loadTripById}
                    onDelete={deleteTrip}
                    loading={loading}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            // ITINERARY / RESULT VIEW
            <motion.div
              key="itinerary"
              initial="initial" animate="animate" exit="exit" variants={pageVariants}
              style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%' }}
            >
              <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <button onClick={() => setPlan(null)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.8rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fa-solid fa-arrow-left"></i> New Trip
                </button>

                <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '1.5rem', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9ca3af' }}>Your Trip Config</h3>
                  <div className="pill-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="pill-sm">{plan.days} Days</span>
                    <span className="pill-sm">{plan.budget_level} Budget</span>
                    <span className="pill-sm">{plan.destination}</span>
                  </div>
                </div>

                <TripsList
                  trips={trips}
                  selectedTripId={selectedTripId}
                  onSelect={loadTripById}
                  onDelete={deleteTrip}
                  loading={loading}
                />
              </aside>

              <section className="content-area" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="hero-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <h2 style={{ fontSize: '3rem', margin: 0 }}>{plan.destination}</h2>
                    <p style={{ fontSize: '1.2rem', color: '#9ca3af' }}>{plan.overview.split('.')[0]}.</p>
                  </div>
                  <div className="weather-badge" style={{ textAlign: 'right' }}>
                    {plan.weather_summary && (
                      <span><i className="fa-solid fa-cloud-sun"></i> {plan.weather_summary.split('Currently')[0]}</span>
                    )}
                  </div>
                </div>

                <div className="map-container custom-shadow">
                  <MapView
                    destination={plan.destination}
                    lat={plan.lat ?? undefined}
                    lng={plan.lng ?? undefined}
                  />
                </div>

                <ItineraryView plan={plan} />
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="error-toast" style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#ef4444', color: 'white', padding: '1rem 2rem', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.5rem' }}></i>
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

function AppContent() {
  const { token } = useAuth();
  return token ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

