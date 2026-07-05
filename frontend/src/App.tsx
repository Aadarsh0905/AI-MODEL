import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline, Grid, Container, Box, AppBar, Toolbar, Typography, Alert, AlertTitle, Snackbar, Button, Link } from '@mui/material';
import axios from 'axios';

import { darkTheme } from './theme/theme';
import { TelemetryPanel } from './components/TelemetryPanel';
import { MapViewer } from './components/MapViewer';
import { AnalysisPanel } from './components/AnalysisPanel';

const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/api/v1/telemetry/ws';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [missionId, setMissionId] = useState<number | null>(null);
  const [rasterId, setRasterId] = useState<number | null>(null);
  const [detectionId, setDetectionId] = useState<number | null>(null);

  // States
  const [telemetry, setTelemetry] = useState({
    latitude: 27.702,
    longitude: 85.312,
    altitude: 0.0,
    pitch: 0.0,
    roll: 0.0,
    yaw: 0.0,
    battery_percentage: 100.0,
    state: 'LANDED'
  });

  const [flightPath, setFlightPath] = useState<Array<[number, number]>>([]);
  const [detections, setDetections] = useState<Array<any>>([]);
  const [hazardResult, setHazardResult] = useState<any>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);

  const [loadingStates, setLoadingStates] = useState({
    planning: false,
    simulating: false,
    photogrammetry: false,
    terrain: false,
    hazards: false,
    reporting: false
  });

  const [alertMsg, setAlertMsg] = useState<{ type: 'info' | 'success' | 'warning' | 'error'; text: string } | null>(null);

  // WebSocket ref
  const ws = useRef<WebSocket | null>(null);

  // 1. Initial Authentication & Project Setup
  useEffect(() => {
    const initSession = async () => {
      try {
        // Login
        const params = new URLSearchParams();
        params.append('username', 'admin@eos.org');
        params.append('password', 'admin123');

        const authRes = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const jwtToken = authRes.data.access_token;
        setToken(jwtToken);

        // Configure default axios token header
        axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;

        // Create initial Project
        const projRes = await axios.post(`${BACKEND_URL}/api/v1/projects/create`, {
          name: `PhD Thesis Project Area - Himalayan Valleys`,
          description: 'Geomorphology and River Migration research analysis.'
        });
        setProjectId(projRes.data.id);
        setAlertMsg({ type: 'success', text: 'Authenticated and setup active workspace successfully.' });

      } catch (err: any) {
        setAlertMsg({ type: 'error', text: 'Backend offline or connection error. Ensure Docker/FastAPI is running.' });
      }
    };
    initSession();
  }, []);

  // 2. Connect WebSocket for live flight telemetry updates
  useEffect(() => {
    if (!token) return;

    const connectWS = () => {
      ws.current = new WebSocket(WS_URL);

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'CAPTURE_ALERT') {
          setAlertMsg({ 
            type: 'info', 
            text: `Sensor trigger: Captured georeferenced ${msg.sensor} frame metadata.` 
          });
          // Mock fetch detections dynamically during flight
          if (msg.sensor === 'RGB') {
            triggerMockDetections(msg.lat, msg.lon);
          }
        } else if (msg.latitude) {
          setTelemetry({
            latitude: msg.latitude,
            longitude: msg.longitude,
            altitude: msg.altitude,
            pitch: msg.pitch,
            roll: msg.roll,
            yaw: msg.yaw,
            battery_percentage: msg.battery_percentage,
            state: msg.state
          });
        }
      };

      ws.current.onclose = () => {
        setTimeout(connectWS, 3000); // Auto reconnect
      };
    };

    connectWS();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [token]);

  // Mock detection polygons for real-time visualization when drone triggers RGB photos
  const triggerMockDetections = (lat: number, lon: number) => {
    // Generate a landslide polygon WKT slightly offset from the drone coordinate
    const offset = 0.0003;
    const wkt = `POLYGON((${lon - offset} ${lat - offset}, ${lon + offset} ${lat - offset}, ${lon + offset} ${lat + offset}, ${lon - offset} ${lat + offset}, ${lon - offset} ${lat - offset}))`;
    
    const newDet = {
      id: Date.now(),
      class_name: 'Landslide',
      geom: wkt,
      area_sqm: 140.2
    };
    setDetections(prev => [...prev, newDet]);
  };

  // 3. Command Triggers
  const handlePlanMission = async () => {
    if (!projectId) return;
    setLoadingStates(prev => ({ ...prev, planning: true }));
    try {
      const bbox = {
        min_lat: 27.700,
        max_lat: 27.705,
        min_lon: 85.310,
        max_lon: 85.315
      };

      // Plan Grid
      const planRes = await axios.post(`${BACKEND_URL}/api/v1/missions/plan-grid`, {
        bbox,
        altitude: 60.0,
        overlap: 0.75
      });
      const waypoints = planRes.data;

      // Create Mission in DB
      const missionRes = await axios.post(`${BACKEND_URL}/api/v1/missions/create`, {
        project_id: projectId,
        name: 'Autonomous Geomorphic Scan Survey',
        description: 'RGB and Multispectral mapping grids.',
        waypoints
      });
      setMissionId(missionRes.data.id);
      
      // Update local flight path map coordinates
      const coords: Array<[number, number]> = waypoints.map((w: any) => [w.latitude, w.longitude]);
      setFlightPath(coords);

      setAlertMsg({ type: 'success', text: 'Flight planning complete. Waypoint grid generated successfully.' });
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: 'Failed to plan flight grid.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, planning: false }));
    }
  };

  const handleStartSimulation = async () => {
    if (!missionId) {
      setAlertMsg({ type: 'warning', text: 'Please generate flight plan waypoints first.' });
      return;
    }
    setLoadingStates(prev => ({ ...prev, simulating: true }));
    try {
      await axios.post(`${BACKEND_URL}/api/v1/telemetry/${missionId}/start`);
      setAlertMsg({ type: 'success', text: 'Mission flight initiated. Watch map for coordinate updates.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Failed to launch drone simulator.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, simulating: false }));
    }
  };

  const handleRunPhotogrammetry = async () => {
    if (!missionId) {
      setAlertMsg({ type: 'warning', text: 'Run the drone flight simulation to capture images first.' });
      return;
    }
    setLoadingStates(prev => ({ ...prev, photogrammetry: true }));
    try {
      await axios.post(`${BACKEND_URL}/api/v1/photogrammetry/process-mission/${missionId}`);
      // Simulate backend creation delays
      setTimeout(async () => {
        // Query projects / lists to obtain generated raster IDs
        // For simplicity, we mock state updates:
        setRasterId(1);
        setAlertMsg({ type: 'success', text: 'Photogrammetry Orthomosaic & DEM GeoTIFF layers created.' });
        setLoadingStates(prev => ({ ...prev, photogrammetry: false }));
      }, 3000);
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Error in photogrammetry matching process.' });
      setLoadingStates(prev => ({ ...prev, photogrammetry: false }));
    }
  };

  const handleRunTerrainAnalysis = async () => {
    if (!rasterId) {
      setAlertMsg({ type: 'warning', text: 'Construct photogrammetry DEM layers first.' });
      return;
    }
    setLoadingStates(prev => ({ ...prev, terrain: true }));
    try {
      // Analyze DEM (ID 1 created by photogrammetry)
      const res = await axios.post(`${BACKEND_URL}/api/v1/terrain/analyze/1`);
      setAlertMsg({ 
        type: 'success', 
        text: `Elevation analyzed: min=${res.data.elevation_stats.min.toFixed(1)}m, max=${res.data.elevation_stats.max.toFixed(1)}m. Slope calculated.` 
      });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Error executing spatial slope algorithms.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, terrain: false }));
    }
  };

  const handleEvaluateHazards = async () => {
    setLoadingStates(prev => ({ ...prev, hazards: true }));
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/reporting/decision-support/hazard-evaluation?slope_mean=28.4&vegetation_loss_pct=18.5&max_erosion_depth_m=-0.45&low_elevation_zone=true`);
      setHazardResult(res.data);
      setAlertMsg({ type: 'success', text: 'Decision support warnings calculated.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Error matching risk models.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, hazards: false }));
    }
  };

  const handleExportReport = async () => {
    if (!projectId || !missionId) return;
    setLoadingStates(prev => ({ ...prev, reporting: true }));
    try {
      const payload = {
        project_id: projectId,
        mission_id: missionId,
        title: 'Geomorphology Elevation and Fluvial Hazard Report',
        table_data_json: [
          ["Parameter", "Metric", "Status"],
          ["Mean Terrain Slope", "28.4 degrees", "Unstable"],
          ["Vegetation Cover Loss", "18.5 %", "Degraded"],
          ["Channel Sedimentation Net", "120.4 m3", "Active deposition"],
          ["Landslide Hazard Assessment", "HIGH", "Immediate Mitigations Setbacks required"]
        ]
      };

      const res = await axios.post(`${BACKEND_URL}/api/v1/reporting/reports/create-mission-pdf`, payload);
      setPdfDownloadUrl(`${BACKEND_URL}${res.data.download_url}`);
      setAlertMsg({ type: 'success', text: 'Institutional sign-off PDF compilation successful.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Failed to compile report PDF.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, reporting: false }));
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header Appbar */}
        <AppBar position="static" sx={{ zIndex: 1201, background: 'rgba(17,24,39,0.9)', backdropFilter: 'blur(8px)' }}>
          <Toolbar>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 800, flexGrow: 1 }}>
              Real-Time Earth Observation System (EOS) <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>PhD Thesis Platform</span>
            </Typography>
            {projectId && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <b>Active Project ID:</b> {projectId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <b>UAV Link:</b> <span style={{ color: '#00e676' }}>● Connected</span>
                </Typography>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* Dashboard layout */}
        <Box sx={{ flexGrow: 1, p: 2, overflow: 'hidden' }}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            {/* Map column (Large 2D Leaflet space) */}
            <Grid item xs={12} md={7} sx={{ height: '100%' }}>
              <MapViewer dronePos={telemetry} flightPath={flightPath} detections={detections} />
            </Grid>

            {/* Sidebar columns (Telemetry values + Control triggers) */}
            <Grid item xs={12} md={5} sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ flexGrow: 1 }}>
                <TelemetryPanel data={telemetry} />
              </Box>
              <Box sx={{ flexGrow: 1.5 }}>
                <AnalysisPanel
                  onPlanMission={handlePlanMission}
                  onStartSimulation={handleStartSimulation}
                  onRunPhotogrammetry={handleRunPhotogrammetry}
                  onRunTerrainAnalysis={handleRunTerrainAnalysis}
                  onEvaluateHazards={handleEvaluateHazards}
                  onExportReport={handleExportReport}
                  loadingStates={loadingStates}
                  hazardResult={hazardResult}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Floating Download link for Report */}
        {pdfDownloadUrl && (
          <Snackbar open={true} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
            <Alert severity="success" sx={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <AlertTitle>Thesis Report Prepared</AlertTitle>
              Institutional PDF successfully compiled. 
              <Button href={pdfDownloadUrl} download target="_blank" variant="contained" size="small" color="primary" sx={{ ml: 2 }}>
                Download PDF
              </Button>
            </Alert>
          </Snackbar>
        )}

        {/* Alerts toast */}
        {alertMsg && (
          <Snackbar open={true} autoHideDuration={5000} onClose={() => setAlertMsg(null)}>
            <Alert severity={alertMsg.type} onClose={() => setAlertMsg(null)} sx={{ width: '100%' }}>
              {alertMsg.text}
            </Alert>
          </Snackbar>
        )}
      </Box>
    </ThemeProvider>
  );
}
