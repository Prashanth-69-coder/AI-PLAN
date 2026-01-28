import Map, { Marker, NavigationControl } from "react-map-gl";

interface Props {
  destination: string;
  lat?: number;
  lng?: number;
}

const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India

function MapView({ destination, lat, lng }: Props) {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  if (!token) {
    return (
      <div className="card map-view" style={{ minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderStyle: 'dashed' }}>
        <div>
          <h3 style={{ color: '#9ca3af', border: 'none' }}>
            <i className="fa-regular fa-map" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }}></i>
            Map Configuration
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: '80%' }}>
            Add <code>VITE_MAPBOX_ACCESS_TOKEN</code> to your .env file to enable interactive maps.
          </p>
        </div>
      </div>
    );
  }

  const center = lat !== undefined && lng !== undefined ? { lat, lng } : defaultCenter;

  return (
    <div className="card map-view" style={{ overflow: 'hidden', padding: 0 }}>
      <Map
        mapboxAccessToken={token}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: 10,
        }}
        style={{ width: "100%", height: 400 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        <NavigationControl position="top-right" />
        <Marker latitude={center.lat} longitude={center.lng} color="#6366f1" />
      </Map>
    </div>
  );
}

export default MapView;

