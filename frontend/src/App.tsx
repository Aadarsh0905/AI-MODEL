import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline, Grid, Container, Box, AppBar, Toolbar, Typography, Alert, AlertTitle, Snackbar, Button, Link, Divider, ButtonBase, Card, Stack, FormControl, Select, MenuItem, TextField, InputAdornment, CircularProgress } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LayersIcon from '@mui/icons-material/Layers';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import ArticleIcon from '@mui/icons-material/Article';
import axios from 'axios';

import { darkTheme } from './theme/theme';
import { TelemetryPanel } from './components/TelemetryPanel';
import { MapViewer } from './components/MapViewer';
import { AnalysisPanel } from './components/AnalysisPanel';
import { AuthPortal } from './components/AuthPortal';

const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/api/v1/telemetry/ws';

const MISSION_LOCATIONS = [
  {
    id: 'himalayan',
    name: 'Himalayan Foothills (Dehradun Grid)',
    center: [27.702, 85.312] as [number, number],
    bbox: { min_lat: 27.700, max_lat: 27.705, min_lon: 85.310, max_lon: 85.315 }
  },
  {
    id: 'kerala',
    name: 'Western Ghats Runoff (Munnar, Kerala)',
    center: [10.163, 77.060] as [number, number],
    bbox: { min_lat: 10.160, max_lat: 10.166, min_lon: 77.057, max_lon: 77.063 }
  },
  {
    id: 'thar',
    name: 'Thar Desert Sand Dunes (Jaisalmer)',
    center: [26.912, 70.908] as [number, number],
    bbox: { min_lat: 26.909, max_lat: 26.915, min_lon: 70.905, max_lon: 70.911 }
  },
  {
    id: 'sundarbans',
    name: 'Sundarbans Estuary Delta (West Bengal)',
    center: [21.949, 89.183] as [number, number],
    bbox: { min_lat: 21.946, max_lat: 21.952, min_lon: 89.180, max_lon: 89.186 }
  },
  {
    id: 'canyon',
    name: 'Grand Canyon Basin (Arizona, USA)',
    center: [36.054, -112.140] as [number, number],
    bbox: { min_lat: 36.051, max_lat: 36.057, min_lon: -112.143, max_lon: -112.137 }
  },
  {
    id: 'vesuvius',
    name: 'Vesuvius Volcano Slopes (Italy)',
    center: [40.822, 14.428] as [number, number],
    bbox: { min_lat: 40.819, max_lat: 40.825, min_lon: 14.425, max_lon: 14.431 }
  }
];

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userProfile, setUserProfile] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [missionId, setMissionId] = useState<number | null>(null);
  const [rasterId, setRasterId] = useState<number | null>(null);
  const [detectionId, setDetectionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'gis' | 'avionics' | 'reports'>('control');
  const [selectedLoc, setSelectedLoc] = useState(MISSION_LOCATIONS[0]);

  // States
  const [telemetry, setTelemetry] = useState({
    latitude: MISSION_LOCATIONS[0].center[0],
    longitude: MISSION_LOCATIONS[0].center[1],
    altitude: 0.0,
    pitch: 0.0,
    roll: 0.0,
    yaw: 0.0,
    battery_percentage: 100.0,
    state: 'LANDED'
  });

  const [flightPath, setFlightPath] = useState<Array<[number, number]>>([]);
  const [capturedFiles, setCapturedFiles] = useState<Array<{ name: string; type: string; url: string; time: string }>>([]);
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
  const missionIdRef = useRef<number | null>(null);
  const alertedLowBattery = useRef(false);
  const alertedCruiseReached = useRef(false);
  
  useEffect(() => {
    missionIdRef.current = missionId;
  }, [missionId]);

  // Auth Handlers
  const handleLoginSuccess = async (jwtToken: string) => {
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
    await fetchUserProfile(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserProfile(null);
    setProjectId(null);
    setMissionId(null);
    delete axios.defaults.headers.common['Authorization'];
    if (ws.current) {
      ws.current.close();
    }
    setAlertMsg({ type: 'info', text: 'Logged out of command terminal.' });
  };

  const fetchUserProfile = async (jwtToken: string) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      setUserProfile(res.data);
      setAlertMsg({ type: 'success', text: `Welcome back, ${res.data.full_name} (${res.data.role})` });
      
      // Initialize Project
      await initProject(jwtToken);
    } catch (err) {
      handleLogout();
    }
  };

  const initProject = async (jwtToken: string) => {
    let projectIdVal: number;
    try {
      const projRes = await axios.post(`${BACKEND_URL}/api/v1/projects/create`, {
        name: `PhD Thesis Project Area - Himalayan Valleys`,
        description: 'Geomorphology and River Migration research analysis.'
      }, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      projectIdVal = projRes.data.id;
    } catch (projErr: any) {
      if (projErr.response && projErr.response.status === 400) {
        const listRes = await axios.get(`${BACKEND_URL}/api/v1/projects/list`, {
          headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const existingProj = listRes.data.find(
          (p: any) => p.name === `PhD Thesis Project Area - Himalayan Valleys`
        );
        if (existingProj) {
          projectIdVal = existingProj.id;
        } else {
          return;
        }
      } else {
        return;
      }
    }
    setProjectId(projectIdVal);
  };

  // 1. Initial Silent Authentication & Project Setup
  useEffect(() => {
    const initSession = async () => {
      try {
        const params = new URLSearchParams();
        params.append('username', 'admin@eos.org');
        params.append('password', 'admin123');

        const authRes = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const jwtToken = authRes.data.access_token;
        setToken(jwtToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;

        // Fetch profile details
        const profileRes = await axios.get(`${BACKEND_URL}/api/v1/auth/me`);
        setUserProfile(profileRes.data);

        // Initialize Project
        await initProject(jwtToken);
      } catch (err) {
        setAlertMsg({ type: 'error', text: 'Auth link offline. Check if backend container is running.' });
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
        
        // Filter out incoming messages that belong to other/older missions
        if (msg.mission_id && missionIdRef.current && msg.mission_id !== missionIdRef.current) {
          return;
        }

        if (msg.type === 'CAPTURE_ALERT') {
          setAlertMsg({ 
            type: 'info', 
            text: `Sensor trigger: Captured georeferenced ${msg.sensor} frame metadata.` 
          });
          
          // Log captured file
          const fileUrl = `${BACKEND_URL}/static/images/${msg.filename}`;
          setCapturedFiles(prev => [
            { 
              name: msg.filename, 
              type: msg.sensor, 
              url: fileUrl,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            },
            ...prev
          ]);

          // Mock fetch detections dynamically during flight
          if (msg.sensor === 'RGB') {
            triggerMockDetections(msg.lat, msg.lon);
          }
        } else if (msg.latitude) {
          // Alert user when drone reaches cruise altitude (60m)
          if (msg.state === 'WAYPOINT' && !alertedCruiseReached.current) {
            alertedCruiseReached.current = true;
            setAlertMsg({
              type: 'info',
              text: `UAV reached target cruise altitude of 60m. Commencing grid waypoint survey tracks.`
            });
          }

          // Alert user when battery is critically low (5% or less)
          if (msg.battery_percentage <= 5.0 && !alertedLowBattery.current && msg.state !== 'LANDED' && msg.state !== 'COMPLETED') {
            alertedLowBattery.current = true;
            setAlertMsg({
              type: 'error',
              text: `CRITICAL BATTERY WARNING: UAV battery has dropped to ${msg.battery_percentage.toFixed(1)}%! Emergency auto-landing initiated.`
            });
          }

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
    setCapturedFiles([]); // Reset image stream
    alertedLowBattery.current = false; // Reset battery warning flag
    alertedCruiseReached.current = false; // Reset cruise alert flag
    setLoadingStates(prev => ({ ...prev, planning: true }));
    try {
      const bbox = selectedLoc.bbox;

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
      setAlertMsg({ type: 'success', text: 'UAV launched successfully! Starting takeoff climb from ground level to target 60m cruise altitude.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Failed to launch drone simulator.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, simulating: false }));
    }
  };

  const handleChargeBattery = async () => {
    if (!missionId) return;
    try {
      await axios.post(`${BACKEND_URL}/api/v1/telemetry/${missionId}/charge`);
      alertedLowBattery.current = false; // Reset battery warning flag so they can get alerted again
      setAlertMsg({ type: 'success', text: 'UAV Battery charged to 100% successfully.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Failed to charge UAV battery.' });
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
        setRasterId(1);
        setAlertMsg({ type: 'success', text: 'Photogrammetry Orthomosaic & DEM GeoTIFF layers created.' });
        
        // Add Orthomosaic and DEM preview images to the live gallery
        const orthoUrl = `${BACKEND_URL}/static/mission_${missionId}/orthomosaic_preview.png`;
        const demUrl = `${BACKEND_URL}/static/mission_${missionId}/dem_preview.png`;
        setCapturedFiles(prev => [
          {
            name: 'Stitched Orthomosaic (RGB)',
            type: 'RGB',
            url: orthoUrl,
            time: 'Mosaic'
          },
          {
            name: 'Digital Elevation Model (DEM)',
            type: 'MULTISPECTRAL',
            url: demUrl,
            time: 'DEM'
          },
          ...prev
        ]);
        
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

  const playDangerSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      
      const duration = 5.0;
      const now = audioCtx.currentTime;
      
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Siren frequency sweep: modulate frequency between 350Hz and 750Hz
      osc1.frequency.setValueAtTime(350, now);
      osc2.frequency.setValueAtTime(353, now); // slightly offset to create chorusing effect
      
      for (let i = 0; i < duration; i += 0.5) {
        osc1.frequency.linearRampToValueAtTime(750, now + i + 0.25);
        osc1.frequency.linearRampToValueAtTime(350, now + i + 0.5);
        
        osc2.frequency.linearRampToValueAtTime(753, now + i + 0.25);
        osc2.frequency.linearRampToValueAtTime(353, now + i + 0.5);
      }
      
      // Volume envelope: fade out at the end
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + duration - 0.3);
      gainNode.gain.linearRampToValueAtTime(0.001, now + duration);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {
      console.warn("Web Audio API not supported or blocked by autoplay constraints:", e);
    }
  };

  const handleEvaluateHazards = async () => {
    setLoadingStates(prev => ({ ...prev, hazards: true }));
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/reporting/decision-support/hazard-evaluation?slope_mean=28.4&vegetation_loss_pct=18.5&max_erosion_depth_m=-0.45&low_elevation_zone=true`);
      setHazardResult(res.data);
      setAlertMsg({ type: 'success', text: 'Decision support warnings calculated.' });
      playDangerSound();
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

  if (!token) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0f17' }}>
          <CircularProgress sx={{ color: '#00e5ff' }} />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'radial-gradient(circle at 10% 20%, rgba(26, 32, 53, 1) 0%, rgba(11, 16, 26, 1) 90%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }
      }}>
        {/* Header Appbar */}
        <AppBar position="static" sx={{ zIndex: 1201, background: 'rgba(17, 24, 39, 0.45)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none' }}>
          <Toolbar>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 900, 
                flexGrow: 1,
                background: 'linear-gradient(90deg, #00e5ff 0%, #00e676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '0.5px'
              }}
            >
              Real-Time Earth Observation System (EOS) <span style={{ fontSize: '0.75rem', color: '#9ca3af', WebkitTextFillColor: '#9ca3af', fontWeight: 400, marginLeft: '8px' }}>PhD Thesis Platform</span>
            </Typography>
            {projectId && (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {/* Geomorphic Research Site Selector */}
                <FormControl size="small" sx={{ 
                  minWidth: 260,
                  '& .MuiOutlinedInput-root': { 
                    color: '#00e5ff', 
                    borderRadius: '8px',
                    borderColor: 'rgba(0, 229, 255, 0.3)',
                    background: 'rgba(255,255,255,0.03)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    '& fieldset': { borderColor: 'rgba(0, 229, 255, 0.25)' },
                    '&:hover fieldset': { borderColor: '#00e5ff' },
                    '&.Mui-focused fieldset': { borderColor: '#00e5ff' }
                  },
                  '& .MuiSelect-icon': { color: '#00e5ff' }
                }}>
                  <Select
                    value={selectedLoc.id}
                    onChange={(e) => {
                      const newLoc = MISSION_LOCATIONS.find(l => l.id === e.target.value);
                      if (newLoc) {
                        setSelectedLoc(newLoc);
                        setTelemetry({
                          latitude: newLoc.center[0],
                          longitude: newLoc.center[1],
                          altitude: 0.0,
                          pitch: 0.0,
                          roll: 0.0,
                          yaw: 0.0,
                          battery_percentage: 100.0,
                          state: 'LANDED'
                        });
                        setFlightPath([]);
                        setCapturedFiles([]);
                        setDetections([]);
                        setHazardResult(null);
                        setMissionId(null);
                        setAlertMsg({ type: 'info', text: `Centered workspace to: ${newLoc.name}` });
                      }
                    }}
                  >
                    {MISSION_LOCATIONS.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id} sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {loc.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {/* Geocoding Search Bar */}
                <TextField
                  size="small"
                  placeholder="Search Earth location..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#00e5ff', fontSize: 18 }} />
                      </InputAdornment>
                    )
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const query = (e.target as HTMLInputElement).value;
                      if (!query) return;
                      
                      try {
                        const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
                          params: {
                            q: query,
                            format: 'json',
                            limit: 1
                          }
                        });
                        
                        if (res.data && res.data.length > 0) {
                          const place = res.data[0];
                          const lat = parseFloat(place.lat);
                          const lon = parseFloat(place.lon);
                          
                          const searchedLocation = {
                            id: 'custom_search',
                            name: place.display_name.split(',')[0] + ' (Search)',
                            center: [lat, lon] as [number, number],
                            bbox: {
                              min_lat: lat - 0.0025,
                              max_lat: lat + 0.0025,
                              min_lon: lon - 0.0025,
                              max_lon: lon + 0.0025
                            }
                          };
                          
                          setSelectedLoc(searchedLocation);
                          setTelemetry({
                            latitude: lat,
                            longitude: lon,
                            altitude: 0.0,
                            pitch: 0.0,
                            roll: 0.0,
                            yaw: 0.0,
                            battery_percentage: 100.0,
                            state: 'LANDED'
                          });
                          setFlightPath([]);
                          setCapturedFiles([]);
                          setDetections([]);
                          setHazardResult(null);
                          setMissionId(null);
                          setAlertMsg({ type: 'success', text: `Centered workspace to: ${searchedLocation.name}` });
                        } else {
                          setAlertMsg({ type: 'warning', text: `Location not found: "${query}"` });
                        }
                      } catch (err) {
                        setAlertMsg({ type: 'error', text: 'Error querying geolocation database.' });
                      }
                    }
                  }}
                  sx={{
                    width: 220,
                    '& .MuiOutlinedInput-root': {
                      color: '#00e5ff',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      height: 40,
                      '& fieldset': { borderColor: 'rgba(0, 229, 255, 0.25)' },
                      '&:hover fieldset': { borderColor: '#00e5ff' },
                      '&.Mui-focused fieldset': { borderColor: '#00e5ff' }
                    },
                    '& input::placeholder': {
                      color: 'rgba(0, 229, 255, 0.45)',
                      opacity: 1
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  <b>Active Project ID:</b> {projectId}
                </Typography>
                
                {userProfile && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5, 
                    px: 1.5, 
                    py: 0.5, 
                    borderRadius: '8px', 
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ff', animation: 'pulse 2s infinite' }} />
                    <Typography variant="caption" sx={{ color: '#00e5ff', fontWeight: 'bold' }}>
                      Admin
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary">
                  <b>UAV Link:</b> <span style={{ color: '#00e676' }}>● Connected</span>
                </Typography>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* Main Layout containing Left Sidebar + Active Workspace */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          
          {/* Left Vertical Navigation Menu */}
          <Box sx={{
            width: 72,
            background: 'rgba(17, 24, 39, 0.45)',
            backdropFilter: 'blur(16px)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
            gap: 2.5,
            flexShrink: 0
          }}>
            {/* Mission Control Tab */}
            <ButtonBase 
              onClick={() => setActiveTab('control')}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTab === 'control' ? '#00e5ff' : 'rgba(255,255,255,0.4)',
                background: activeTab === 'control' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                border: activeTab === 'control' ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid transparent',
                boxShadow: activeTab === 'control' ? '0 0 12px rgba(0, 229, 255, 0.2)' : 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  color: '#00e5ff',
                  background: 'rgba(0, 229, 255, 0.05)',
                }
              }}
            >
              <DashboardIcon />
            </ButtonBase>

            {/* GIS Layers Tab */}
            <ButtonBase 
              onClick={() => setActiveTab('gis')}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTab === 'gis' ? '#00e676' : 'rgba(255,255,255,0.4)',
                background: activeTab === 'gis' ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                border: activeTab === 'gis' ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid transparent',
                boxShadow: activeTab === 'gis' ? '0 0 12px rgba(0, 230, 118, 0.2)' : 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  color: '#00e676',
                  background: 'rgba(0, 230, 118, 0.05)',
                }
              }}
            >
              <LayersIcon />
            </ButtonBase>

            {/* UAV Config Tab */}
            <ButtonBase 
              onClick={() => setActiveTab('avionics')}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTab === 'avionics' ? '#ffa726' : 'rgba(255,255,255,0.4)',
                background: activeTab === 'avionics' ? 'rgba(255, 167, 38, 0.1)' : 'transparent',
                border: activeTab === 'avionics' ? '1px solid rgba(255, 167, 38, 0.3)' : '1px solid transparent',
                boxShadow: activeTab === 'avionics' ? '0 0 12px rgba(255, 167, 38, 0.2)' : 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  color: '#ffa726',
                  background: 'rgba(255, 167, 38, 0.05)',
                }
              }}
            >
              <FlightTakeoffIcon />
            </ButtonBase>

            {/* Reports Tab */}
            <ButtonBase 
              onClick={() => setActiveTab('reports')}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTab === 'reports' ? '#26a69a' : 'rgba(255,255,255,0.4)',
                background: activeTab === 'reports' ? 'rgba(38, 166, 154, 0.1)' : 'transparent',
                border: activeTab === 'reports' ? '1px solid rgba(38, 166, 154, 0.3)' : '1px solid transparent',
                boxShadow: activeTab === 'reports' ? '0 0 12px rgba(38, 166, 154, 0.2)' : 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  color: '#26a69a',
                  background: 'rgba(38, 166, 154, 0.05)',
                }
              }}
            >
              <ArticleIcon />
            </ButtonBase>
          </Box>

          {/* Active Workspace Viewport */}
          <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'control' && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                {/* Map column (Large 2D Leaflet space) */}
                <Grid item xs={12} md={7} sx={{ height: '100%' }}>
                  <MapViewer dronePos={telemetry} flightPath={flightPath} detections={detections} defaultCenter={selectedLoc.center} />
                </Grid>

                {/* Sidebar columns (Telemetry values + Control triggers) */}
                <Grid item xs={12} md={5} sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <TelemetryPanel 
                      data={telemetry} 
                      capturedFiles={capturedFiles} 
                      onChargeBattery={handleChargeBattery} 
                    />
                  </Box>
                  <Box sx={{ flexGrow: 1.5, minHeight: 0 }}>
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
            )}

            {activeTab === 'gis' && (
              <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', mt: 4 }}>
                <Card sx={{ 
                  background: 'rgba(17, 25, 40, 0.55)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
                  borderRadius: '16px',
                  p: 3
                }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#00e676', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LayersIcon /> Spatial & GIS Catalog
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Georeferenced DEM, orthomosaics, and derivative spatial slope raster catalog generated within the PhD Thesis research area.
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="subtitle2" sx={{ color: '#00e5ff', fontWeight: 'bold' }}>Orthomosaic Tile Map Layer</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">Format: GeoTIFF | SRID: EPSG:4326 (WGS84)</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', mt: 1, display: 'block' }}>
                        WKT Bounding Box: POLYGON((85.312 27.702, 85.315 27.702, 85.315 27.705, 85.312 27.705, 85.312 27.702))
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="subtitle2" sx={{ color: '#e040fb', fontWeight: 'bold' }}>Digital Elevation Model (DEM)</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">Resolution: 0.12m/pixel | Format: GeoTIFF</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', mt: 1, display: 'block' }}>
                        Raster Bounds: Min Z: 1120m | Max Z: 1480m (Himalayan foothills grid)
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="subtitle2" sx={{ color: '#ffa726', fontWeight: 'bold' }}>Derivative Slope Slope Map</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">Classification: Degree Slope Angle | Cast Method: PostGIS ST_Slope</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', mt: 1, display: 'block' }}>
                        Processing Status: Vectorized Gradient Field Created
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Box>
            )}

            {activeTab === 'avionics' && (
              <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', mt: 4 }}>
                <Card sx={{ 
                  background: 'rgba(17, 25, 40, 0.55)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
                  borderRadius: '16px',
                  p: 3
                }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ffa726', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlightTakeoffIcon /> UAV Avionics & Safety Config
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Active telemetry limits, flight controllers, and Return-to-Launch safety threshold parameters.
                  </Typography>

                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#00e5ff', fontWeight: 'bold', mb: 1 }}>Target Takeoff Cruise Altitude</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>Current Setting: <b>60.0 meters</b> (Above Ground Level)</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        The altitude the UAV automatically climbs to upon receiving the Takeoff simulation command.
                      </Typography>
                    </Box>

                    <Divider sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />

                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#ff5252', fontWeight: 'bold', mb: 1 }}>Critical Battery Threshold</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>Warning Limit: <b>5.0%</b> | RTL Trigger: <b>15.0%</b></Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Fires emergency warning alerts to the supervisor and triggers an autoland sequence.
                      </Typography>
                    </Box>

                    <Divider sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />

                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#00e676', fontWeight: 'bold', mb: 1 }}>Telemetry Status</Typography>
                      <Typography variant="body2" sx={{ color: '#00e676' }}>● Active (WS Connection Open)</Typography>
                    </Box>
                  </Stack>
                </Card>
              </Box>
            )}

            {activeTab === 'reports' && (
              <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', mt: 4 }}>
                <Card sx={{ 
                  background: 'rgba(17, 25, 40, 0.55)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
                  borderRadius: '16px',
                  p: 3
                }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#26a69a', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArticleIcon /> Departmental & Academic Reports
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Archived and compiled geomorphology safety thesis assessments signed off by the principal investigator.
                  </Typography>

                  <Stack spacing={2}>
                    <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Himalayan Watershed Assessment - Area A</Typography>
                        <Typography variant="caption" color="text.secondary">Compiled: July 2026 | Approved by Department head</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#26a69a', fontWeight: 'bold' }}>VERIFIED MD5</Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Slope Instability & Landslide Warning Report</Typography>
                        <Typography variant="caption" color="text.secondary">Trigger: Neural net classification high hazard</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#ffa726', fontWeight: 'bold' }}>AUDITED</Typography>
                    </Box>
                  </Stack>
                </Card>
              </Box>
            )}
          </Box>
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
          <Snackbar open={true} autoHideDuration={10000} onClose={() => setAlertMsg(null)}>
            <Alert severity={alertMsg.type} onClose={() => setAlertMsg(null)} sx={{ width: '100%' }}>
              {alertMsg.text}
            </Alert>
          </Snackbar>
        )}
      </Box>
    </ThemeProvider>
  );
}
