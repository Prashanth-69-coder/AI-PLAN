import { useEffect, useState } from "react";

export interface TripFormValues {
  origin: string;
  destination: string;
  days: number;
  budgetLevel: string;
  travelers: number;
  travelMonth: string;
  preferences: string[];
  notes: string;
}

interface Props {
  onSubmit: (values: TripFormValues) => void;
  loading: boolean;
}

const defaultValues: TripFormValues = {
  origin: "",
  destination: "",
  days: 4,
  budgetLevel: "medium",
  travelers: 2,
  travelMonth: "",
  preferences: [],
  notes: "",
};

type RecognitionType = SpeechRecognition | null;

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

function TripForm({ onSubmit, loading }: Props) {
  const [values, setValues] = useState<TripFormValues>(defaultValues);
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionType>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setValues((prev) => ({
        ...prev,
        notes: prev.notes ? `${prev.notes}\n${transcript}` : transcript,
      }));
      setListening(false);
    };

    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    setRecognition(rec);

    return () => {
      rec.abort();
    };
  }, []);

  const handleChange = (field: keyof TripFormValues, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const togglePreference = (pref: string) => {
    setValues((prev) => {
      const exists = prev.preferences.includes(pref);
      return {
        ...prev,
        preferences: exists
          ? prev.preferences.filter((p) => p !== pref)
          : [...prev.preferences, pref],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const handleVoiceClick = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  return (
    <form className="card trip-form" onSubmit={handleSubmit}>
      <h2>Tell us about your trip</h2>

      <div className="field-row">
        <div className="field">
          <label>From (optional)</label>
          <input
            type="text"
            placeholder="E.g., Hyderabad"
            value={values.origin}
            onChange={(e) => handleChange("origin", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Destination *</label>
          <input
            required
            type="text"
            placeholder="E.g., Goa, Paris, Singapore"
            value={values.destination}
            onChange={(e) => handleChange("destination", e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Number of days</label>
          <input
            type="number"
            min={1}
            max={30}
            value={values.days}
            onChange={(e) => handleChange("days", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Travelers</label>
          <input
            type="number"
            min={1}
            max={10}
            value={values.travelers}
            onChange={(e) => handleChange("travelers", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Budget</label>
          <select
            value={values.budgetLevel}
            onChange={(e) => handleChange("budgetLevel", e.target.value)}
          >
            <option value="low">Low / Backpacker</option>
            <option value="medium">Medium / Comfortable</option>
            <option value="high">High / Luxury</option>
          </select>
        </div>
        <div className="field">
          <label>Month / Season</label>
          <input
            type="text"
            placeholder="E.g., May, Winter, Diwali"
            value={values.travelMonth}
            onChange={(e) => handleChange("travelMonth", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Preferences</label>
        <div className="chip-row">
          {["Sightseeing", "Beaches", "Adventure", "Nature", "Food", "Shopping", "Nightlife"].map(
            (pref) => (
              <button
                key={pref}
                type="button"
                className={
                  values.preferences.includes(pref.toLowerCase()) ? "chip chip-selected" : "chip"
                }
                onClick={() => togglePreference(pref.toLowerCase())}
              >
                {pref}
              </button>
            )
          )}
        </div>
      </div>

      <div className="field">
        <label>
          Extra details / voice input{" "}
          <button
            type="button"
            className={listening ? "mic-button mic-button-on" : "mic-button"}
            onClick={handleVoiceClick}
          >
            {listening ? "Listening..." : "Speak"}
          </button>
        </label>
        <textarea
          rows={4}
          placeholder="Tell the AI more about your trip: budget per day, must-visit places, pace of travel..."
          value={values.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
        />
      </div>

      <button type="submit" className="primary-button" disabled={loading}>
        {loading ? "Generating itinerary..." : "Generate Itinerary"}
      </button>
    </form>
  );
}

export default TripForm;

