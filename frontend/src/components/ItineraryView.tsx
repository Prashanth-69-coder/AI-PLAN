import { useState } from "react";
import type { TripPlan } from "../App";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue with Leaflet in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  plan: TripPlan;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  hover: {
    scale: 1.03,
    y: -8,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

const tabContentVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.3, ease: "easeIn" }
  }
};

function ItineraryView({ plan }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'explore'>('overview');

  const handleSpeak = () => {
    const synth = window.speechSynthesis;
    if (!synth) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const text = `Here is your ${plan.days} day trip to ${plan.destination}. ${plan.overview}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  const handleDownloadPdf = async () => {
    if (!plan.id) {
      alert("Trip must be saved before downloading PDF");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:8000/api/trips/${plan.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Trip_to_${plan.destination}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("PDF Download error", e);
      alert("Failed to download PDF. Please try again.");
    }
  };

  return (
    <motion.div
      className="itinerary-view"
      style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Header with Glassmorphism */}
      <motion.div
        variants={itemVariants}
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
          backdropFilter: 'blur(20px)',
          borderRadius: '2rem',
          padding: '2.5rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              letterSpacing: '-0.02em'
            }}>
              <motion.i
                className="fa-solid fa-location-dot"
                style={{ color: '#6366f1' }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              ></motion.i>
              {plan.destination}
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 500 }}>{plan.days} Days • {plan.budget_level} Budget</p>
          </motion.div>

          <motion.div
            style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.button
              onClick={handleSpeak}
              whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)' }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '1rem 1.75rem',
                background: speaking ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '1rem',
                cursor: 'pointer',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '1rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
              }}
            >
              <motion.i
                className={speaking ? "fa-solid fa-stop" : "fa-solid fa-volume-high"}
                animate={speaking ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 0.5, repeat: speaking ? Infinity : 0 }}
              ></motion.i>
              {speaking ? 'Stop' : 'Listen'}
            </motion.button>
            {plan.id && (
              <motion.button
                onClick={handleDownloadPdf}
                whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)' }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '1rem 1.75rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '1rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '1rem',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                }}
              >
                <i className="fa-solid fa-file-pdf"></i>
                Download PDF
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Animated Stats Grid */}
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '2rem' }}
          variants={containerVariants}
        >
          {plan.weather_summary && (
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}
            >
              <motion.div
                style={{ fontSize: '2rem', marginBottom: '0.5rem' }}
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <i className="fa-solid fa-cloud-sun" style={{ color: '#3b82f6' }}></i>
              </motion.div>
              <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 500 }}>{plan.weather_summary.split(":")[1] || plan.weather_summary}</div>
            </motion.div>
          )}
          {plan.estimated_total_budget && (
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.05) 100%)',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}
            >
              <motion.div
                style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e', marginBottom: '0.5rem' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
              >
                ₹{Math.round(plan.estimated_total_budget).toLocaleString()}
              </motion.div>
              <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 500 }}>Total Budget</div>
            </motion.div>
          )}
          {plan.estimated_per_person && (
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(147, 51, 234, 0.05) 100%)',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}
            >
              <motion.div
                style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', marginBottom: '0.5rem' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.6 }}
              >
                ₹{Math.round(plan.estimated_per_person).toLocaleString()}
              </motion.div>
              <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 500 }}>Per Person</div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Premium Tab Navigation */}
      <motion.div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2.5rem',
          flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0.75rem',
          borderRadius: '1.5rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        variants={itemVariants}
      >
        {[
          { id: 'overview', icon: 'fa-compass', label: 'Overview' },
          { id: 'itinerary', icon: 'fa-calendar-days', label: 'Day-by-Day' },
          { id: 'explore', icon: 'fa-map-location-dot', label: 'Hotels & Dining' }
        ].map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                : 'rgba(30, 41, 59, 0.6)',
              color: activeTab === tab.id ? 'white' : '#94a3b8'
            }}
            transition={{ duration: 0.3 }}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              borderRadius: '1rem',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 600,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: activeTab === tab.id ? '0 8px 20px rgba(99, 102, 241, 0.4)' : 'none',
            }}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            {tab.label}
          </motion.button>
        ))}
      </motion.div>

      {/* Animated Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Overview content with stagger animations */}
            <motion.div variants={containerVariants}>
              <motion.div
                variants={itemVariants}
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  padding: '2.5rem',
                  borderRadius: '1.5rem',
                  marginBottom: '2rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                }}
              >
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <motion.i
                    className="fa-solid fa-lightbulb"
                    style={{ color: '#fbbf24' }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  ></motion.i>
                  Trip Overview
                </h2>
                <p style={{ color: '#e2e8f0', lineHeight: '1.9', fontSize: '1.1rem' }}>{plan.overview}</p>
              </motion.div>

              {plan.lat && plan.lng && (
                <motion.div
                  variants={itemVariants}
                  style={{
                    marginBottom: '2rem',
                    borderRadius: '1.5rem',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.15)',
                    height: '500px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                  }}
                >
                  <MapContainer center={[plan.lat, plan.lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[plan.lat, plan.lng]}>
                      <Popup><strong>{plan.destination}</strong><br />Your destination</Popup>
                    </Marker>
                  </MapContainer>
                </motion.div>
              )}

              {plan.budget_breakdown && (
                <motion.div
                  variants={itemVariants}
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.06) 100%)',
                    padding: '2.5rem',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    marginBottom: '2rem',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                  }}
                >
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <i className="fa-solid fa-wallet"></i>
                    Budget Breakdown
                  </h3>
                  <motion.div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}
                    variants={containerVariants}
                  >
                    {Object.entries(plan.budget_breakdown).map(([key, value], idx) => (
                      <motion.div
                        key={key}
                        variants={cardVariants}
                        whileHover="hover"
                        custom={idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.8)',
                          padding: '1.5rem',
                          borderRadius: '1.25rem',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'capitalize', marginBottom: '0.75rem', fontWeight: 600 }}>{key}</div>
                        <motion.div
                          style={{ fontSize: '1.75rem', fontWeight: 800, color: key === 'total' ? '#22c55e' : 'white' }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: idx * 0.1 }}
                        >
                          ₹{value}
                        </motion.div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {plan.events && plan.events.length > 0 && (
                <motion.div
                  variants={itemVariants}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '2.5rem',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    marginBottom: '2rem',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                  }}
                >
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <i className="fa-solid fa-calendar-star"></i>
                    Happening During Your Trip
                  </h3>
                  <motion.div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}
                    variants={containerVariants}
                  >
                    {plan.events.map((event, idx) => (
                      <motion.div
                        key={idx}
                        variants={cardVariants}
                        whileHover="hover"
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          borderRadius: '1.25rem',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                        }}
                      >
                        {event.thumbnail && <motion.img whileHover={{ scale: 1.05 }} transition={{ duration: 0.3 }} src={event.thumbnail} alt={event.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />}
                        <div style={{ padding: '1.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '1rem', lineHeight: '1.4' }}>{event.title}</h4>
                          {event.date && <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}><i className="fa-solid fa-clock" style={{ marginRight: '0.5rem', color: '#4ade80' }}></i>{event.date}</p>}
                          {event.address && <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.25rem' }}><i className="fa-solid fa-location-dot" style={{ marginRight: '0.5rem', color: '#4ade80' }}></i>{event.address}</p>}
                          {event.link && (
                            <motion.a
                              href={event.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              whileHover={{ x: 5 }}
                              style={{ fontSize: '0.95rem', color: '#4ade80', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              View Details <i className="fa-solid fa-arrow-right"></i>
                            </motion.a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              <motion.div
                variants={itemVariants}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.06) 100%)',
                  padding: '2.5rem',
                  borderRadius: '1.5rem',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                }}
              >
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <i className="fa-solid fa-lightbulb"></i>
                  Travel Tips
                </h3>
                <motion.ul
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                  variants={containerVariants}
                >
                  {plan.tips.map((tip, idx) => (
                    <motion.li
                      key={idx}
                      variants={itemVariants}
                      whileHover={{ x: 10 }}
                      style={{
                        padding: '1.25rem 0',
                        borderBottom: idx < plan.tips.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        color: '#e2e8f0',
                        lineHeight: '1.7',
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '1.05rem'
                      }}
                    >
                      <motion.i
                        className="fa-solid fa-circle-check"
                        style={{ color: '#818cf8', marginTop: '0.25rem', flexShrink: 0 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: idx * 0.1 }}
                      ></motion.i>
                      <span>{tip}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'itinerary' && (
          <motion.div
            key="itinerary"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div variants={containerVariants}>
              {plan.daily_plan.map((day, idx) => (
                <motion.div
                  key={day.day}
                  variants={cardVariants}
                  whileHover={{ scale: 1.01 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.7) 100%)',
                    padding: '2.5rem',
                    borderRadius: '1.5rem',
                    marginBottom: '2rem',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <motion.div
                      style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: 'white',
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.75rem',
                        boxShadow: '0 8px 25px rgba(99, 102, 241, 0.5)'
                      }}
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                    >
                      {day.day}
                    </motion.div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', margin: 0 }}>{day.title}</h3>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '1.15rem', marginBottom: '2rem', lineHeight: '1.7' }}>{day.summary}</p>
                  <motion.div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}
                    variants={containerVariants}
                  >
                    {day.places.map((place, placeIdx) => (
                      <motion.div
                        key={placeIdx}
                        variants={itemVariants}
                        whileHover={{ scale: 1.05, x: 10 }}
                        style={{
                          background: 'rgba(15, 23, 42, 0.8)',
                          padding: '1.25rem',
                          borderRadius: '1rem',
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                      >
                        <motion.i
                          className="fa-solid fa-location-dot"
                          style={{ color: '#6366f1', fontSize: '1.5rem' }}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: placeIdx * 0.2 }}
                        ></motion.i>
                        <span style={{ color: 'white', fontWeight: 600, fontSize: '1.05rem' }}>{place}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'explore' && (
          <motion.div
            key="explore"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div variants={containerVariants}>
              {plan.hotels && plan.hotels.length > 0 && (
                <motion.div variants={itemVariants} style={{ marginBottom: '4rem' }}>
                  <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <i className="fa-solid fa-hotel" style={{ color: '#60a5fa' }}></i>
                    Recommended Hotels
                  </h2>
                  <motion.div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}
                    variants={containerVariants}
                  >
                    {plan.hotels.map((hotel, idx) => (
                      <motion.div
                        key={idx}
                        variants={cardVariants}
                        whileHover="hover"
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          borderRadius: '1.5rem',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                        }}
                      >
                        {hotel.image && (
                          <div style={{ overflow: 'hidden', height: '220px' }}>
                            <motion.img
                              whileHover={{ scale: 1.1 }}
                              transition={{ duration: 0.4 }}
                              src={hotel.image}
                              alt={hotel.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        )}
                        <div style={{ padding: '2rem' }}>
                          <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '1rem', lineHeight: '1.3' }}>{hotel.name}</h4>
                          {hotel.rating > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{ color: '#fbbf24', fontSize: '1.25rem' }}>
                                {Array.from({ length: 5 }, (_, i) => (
                                  <motion.span
                                    key={i}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                  >
                                    {i < Math.floor(hotel.rating) ? '★' : '☆'}
                                  </motion.span>
                                ))}
                              </div>
                              <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}>({hotel.rating})</span>
                            </div>
                          )}
                          {hotel.price && (
                            <motion.p
                              style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', marginBottom: '1.5rem' }}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", delay: 0.3 }}
                            >
                              ₹{hotel.price} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>/ night</span>
                            </motion.p>
                          )}
                          <motion.a
                            href={`https://www.agoda.com${hotel.link.includes('agoda.com') ? hotel.link.split('agoda.com')[1] : '/search'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'center',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: 'white',
                              padding: '1rem',
                              borderRadius: '1rem',
                              textDecoration: 'none',
                              fontWeight: 700,
                              fontSize: '1.05rem',
                              boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)'
                            }}
                          >
                            Book on Agoda →
                          </motion.a>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {plan.restaurants && plan.restaurants.length > 0 && (
                <motion.div variants={itemVariants}>
                  <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <i className="fa-solid fa-utensils" style={{ color: '#fb923c' }}></i>
                    Restaurants & Street Food
                  </h2>
                  <motion.div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}
                    variants={containerVariants}
                  >
                    {plan.restaurants.map((restaurant, idx) => (
                      <motion.div
                        key={idx}
                        variants={cardVariants}
                        whileHover="hover"
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          borderRadius: '1.5rem',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                        }}
                      >
                        {restaurant.thumbnail && (
                          <div style={{ overflow: 'hidden', height: '200px' }}>
                            <motion.img
                              whileHover={{ scale: 1.1 }}
                              transition={{ duration: 0.4 }}
                              src={restaurant.thumbnail}
                              alt={restaurant.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        )}
                        <div style={{ padding: '2rem' }}>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem', lineHeight: '1.3' }}>{restaurant.name}</h4>
                          {restaurant.type && <p style={{ fontSize: '0.9rem', color: '#fb923c', marginBottom: '1rem', fontWeight: 700 }}>{restaurant.type}</p>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {restaurant.rating > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: '#fbbf24', fontSize: '1.25rem' }}>★</span>
                                <span style={{ fontSize: '1.05rem', color: 'white', fontWeight: 700 }}>{restaurant.rating}</span>
                              </div>
                            )}
                            {restaurant.reviews > 0 && <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>({restaurant.reviews} reviews)</span>}
                            {restaurant.price && <span style={{ fontSize: '1.05rem', color: '#4ade80', fontWeight: 800 }}>{restaurant.price}</span>}
                          </div>
                          {restaurant.address && <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.6' }}><i className="fa-solid fa-location-dot" style={{ marginRight: '0.5rem', color: '#fb923c' }}></i>{restaurant.address}</p>}
                          <motion.a
                            href={restaurant.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'center',
                              background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                              color: 'white',
                              padding: '0.9rem',
                              borderRadius: '1rem',
                              textDecoration: 'none',
                              fontWeight: 700,
                              fontSize: '1rem',
                              boxShadow: '0 6px 20px rgba(251, 146, 60, 0.4)'
                            }}
                          >
                            View on Google Maps →
                          </motion.a>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ItineraryView;
