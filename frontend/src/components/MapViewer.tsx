import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, IconButton, Divider, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

interface MapViewerProps {
  dronePos: { latitude: number; longitude: number };
  flightPath: Array<[number, number]>;
  detections: Array<{ id: number; class_name: string; geom: string; area_sqm: number }>;
  defaultCenter?: [number, number];
}

// Custom Leaflet DivIcon representing the drone
const droneIcon = new L.DivIcon({
  html: `<div style="background-color: #00d2ff; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px #00d2ff; animation: pulse 1.5s infinite;"></div>`,
  className: 'custom-drone-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Custom Leaflet DivIcon representing the Launch Pad / Ground Control Station (GCS)
const launchPadIcon = new L.DivIcon({
  html: `<div style="background-color: #ff9100; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px #ff9100; animation: pulse 2s infinite; display: flex; align-items: center; justify-content: center;">
           <div style="background-color: #ffffff; width: 4px; height: 4px; border-radius: 50%;"></div>
         </div>`,
  className: 'custom-launchpad-icon',
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

const CustomZoomControl = () => {
  const map = useMap();
  const [zoom, setZoom] = React.useState(map.getZoom());

  React.useEffect(() => {
    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };
    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  return (
    <Box sx={{
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'rgba(17, 25, 40, 0.65)',
      backdropFilter: 'blur(16px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      p: 0.5,
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
    }}>
      <IconButton 
        onClick={() => map.zoomIn()}
        size="small"
        sx={{ 
          color: '#00e5ff', 
          p: 1,
          '&:hover': { background: 'rgba(255,255,255,0.08)' } 
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
      
      <Divider sx={{ width: '80%', bgcolor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 24, 
        height: 24, 
        borderRadius: '50%', 
        border: '1px solid rgba(0, 229, 255, 0.2)',
        bgcolor: 'rgba(0, 229, 255, 0.05)'
      }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#00e5ff', 
            fontWeight: 'bold', 
            fontSize: '0.7rem',
          }}
        >
          {zoom}
        </Typography>
      </Box>
      
      <Divider sx={{ width: '80%', bgcolor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
      
      <IconButton 
        onClick={() => map.zoomOut()}
        size="small"
        sx={{ 
          color: '#00e5ff', 
          p: 1,
          '&:hover': { background: 'rgba(255,255,255,0.08)' } 
        }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export const MapViewer: React.FC<MapViewerProps> = ({ dronePos, flightPath, detections, defaultCenter }) => {
  const center: [number, number] = dronePos.latitude !== 0 ? [dronePos.latitude, dronePos.longitude] : (defaultCenter ? defaultCenter : [27.7, 85.3]); // Default Himalayan foothills
  
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
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      borderRadius: '16px', 
      overflow: 'hidden', 
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
      background: 'rgba(17, 25, 40, 0.4)'
    }}>
      <MapContainer center={center} zoom={16} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Custom Glassmorphic Zoom Control Widget */}
        <CustomZoomControl />
        
        {/* Dynamic Center Tracking */}
        <AutoCenter coords={dronePos.latitude !== 0 ? [dronePos.latitude, dronePos.longitude] : (defaultCenter ? defaultCenter : [27.7, 85.3])} />

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

        {/* GCS Launch Pad Target Beacon (rendered when drone is not flying yet) */}
        {dronePos.latitude === 0 && (
          <Marker position={center} icon={launchPadIcon}>
            <Popup>
              <b>Ground Control Station (GCS)</b><br />
              Target Location Centered & Aligned.<br />
              Coordinates:<br />
              {center[0].toFixed(6)}, {center[1].toFixed(6)}
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
