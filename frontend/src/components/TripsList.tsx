import type { TripPlan } from "../App";

export interface TripSummary {
  id: number;
  destination: string;
  days: number;
  budget_level: string;
  travelers: number;
  overview: string;
}

interface Props {
  trips: TripSummary[];
  selectedTripId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}

function TripsList({ trips, selectedTripId, onSelect, onDelete, loading }: Props) {
  return (
    <div className="card trips-list" style={{ marginTop: '2rem' }}>
      <div className="trips-header">
        <h3 style={{ border: 'none', marginBottom: 0, fontSize: '1rem', color: '#9ca3af' }}>
          <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '0.5rem' }}></i>
          History
        </h3>
        <span className="trips-count">{trips.length}</span>
      </div>
      {trips.length === 0 ? (
        <p className="trips-empty">Your generated trips will be saved here automatically.</p>
      ) : (
        <ul className="trips-items custom-scrollbar">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className={
                selectedTripId === trip.id ? "trips-item trips-item-selected" : "trips-item"
              }
            >
              <button
                type="button"
                className="trips-main"
                disabled={loading}
                onClick={() => onSelect(trip.id)}
              >
                <div className="trips-info">
                  <span className="trip-dest">{trip.destination}</span>
                  <span className="trip-meta">
                    {trip.days}d · {trip.budget_level}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="btn-delete"
                disabled={loading}
                onClick={() => onDelete(trip.id)}
                title="Delete trip"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TripsList;

