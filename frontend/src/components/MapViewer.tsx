import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box } from '@mui/material';

interface MapViewerProps {
  dronePos: { latitude: number; longitude: number };
  flightPath: Array<[number, number]>;
  detections: Array<{ id: number; class_name: string; geom: string; area_sqm: number }>;
}

// Custom Leaflet DivIcon representing the drone
const droneIcon = new L.DivIcon({
  html: `<div style="background-color: #00d2ff; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px #00d2ff; animation: pulse 1.5s infinite;"></div>`,
  className: 'custom-drone-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Component to dynamically re-center map if drone coordinates change
const AutoCenter: React.FC<{ coords: [number, number] }> = ({ coords }) => {
  const map = useMap();
  React.useEffect(() => {
    if (coords[0] !== 0 && coords[1] !== 0) {
      map.setView(coords, map.getZoom());
    }
  }, [coords, map]);
  return null;
};

// Helper to parse WKT Polygon string "POLYGON((lon lat, lon lat, ...))" to Leaflet array [[lat, lon], ...]
const parseWKTToLatLng = (wkt: string): Array<[number, number]> => {
  try {
    const coordsStr = wkt.replace("POLYGON((", "").replace("))", "").replace("POLYGON ( (", "").replace(" ) )", "");
    const pairs = coordsStr.split(",");
    return pairs.map(p => {
      const parts = p.trim().split(" ");
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lat, lon];
    });
  } catch (e) {
    return [];
  }
};

export const MapViewer: React.FC<MapViewerProps> = ({ dronePos, flightPath, detections }) => {
  const center: [number, number] = dronePos.latitude !== 0 ? [dronePos.latitude, dronePos.longitude] : [27.7, 85.3]; // Default Himalayan foothills
  
  const getDetectionColor = (className: string) => {
    switch (className.toLowerCase()) {
      case 'river': return '#0070f3';
      case 'landslide': return '#f50057';
      case 'erosion': return '#ffab00';
      case 'vegetation': return '#00e676';
      default: return '#9ca3af';
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Dynamic Center Tracking */}
        {dronePos.latitude !== 0 && <AutoCenter coords={[dronePos.latitude, dronePos.longitude]} />}

        {/* Flight Grid Plan Line */}
        {flightPath.length > 0 && (
          <Polyline positions={flightPath} color="#00e5ff" weight={3} dashArray="5, 10" />
        )}

        {/* Live Drone coordinate indicator */}
        {dronePos.latitude !== 0 && (
          <Marker position={[dronePos.latitude, dronePos.longitude]} icon={droneIcon}>
            <Popup>
              UAV Coordinates: <br />
              {dronePos.latitude.toFixed(6)}, {dronePos.longitude.toFixed(6)}
            </Popup>
          </Marker>
        )}

        {/* AI Geomorphic Detections overlays */}
        {detections.map((det) => {
          const positions = parseWKTToLatLng(det.geom);
          if (positions.length === 0) return null;
          return (
            <Polygon 
              key={det.id} 
              positions={positions} 
              pathOptions={{ color: getDetectionColor(det.class_name), fillColor: getDetectionColor(det.class_name), fillOpacity: 0.35 }}
            >
              <Popup>
                <b>Geomorphic Feature:</b> {det.class_name} <br />
                <b>Calculated Area:</b> {det.area_sqm.toFixed(1)} m²
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </Box>
  );
};
