import React from 'react';
import { Card, CardContent, Typography, Button, Stack, Box, Alert, CircularProgress, Skeleton } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TerrainIcon from '@mui/icons-material/Terrain';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AssessmentIcon from '@mui/icons-material/Assessment';

interface AnalysisPanelProps {
  onPlanMission: () => void;
  onStartSimulation: () => void;
  onRunPhotogrammetry: () => void;
  onRunTerrainAnalysis: () => void;
  onEvaluateHazards: () => void;
  onExportReport: () => void;
  loadingStates: {
    planning: boolean;
    simulating: boolean;
    photogrammetry: boolean;
    terrain: boolean;
    hazards: boolean;
    reporting: boolean;
  };
  hazardResult: any;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  onPlanMission,
  onStartSimulation,
  onRunPhotogrammetry,
  onRunTerrainAnalysis,
  onEvaluateHazards,
  onExportReport,
  loadingStates,
  hazardResult
}) => {
  return (
    <Card sx={{ 
      height: '100%', 
      overflowY: 'auto',
      background: 'rgba(17, 25, 40, 0.55)',
      backdropFilter: 'blur(16px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
      borderRadius: '16px'
    }}>
      <CardContent>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: '#00e676', 
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0, 230, 118, 0.3)'
          }}
        >
          <AutoFixHighIcon /> Earth Observation Control
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          {/* Phase 1: Mission Prep */}
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                textTransform: 'uppercase', 
                fontWeight: '800', 
                display: 'block', 
                mb: 1,
                color: '#29b6f6',
                letterSpacing: '0.5px'
              }}
            >
              Phase 1: Mission Preparation
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={loadingStates.planning ? <CircularProgress size={16} /> : <MapIcon />} 
                onClick={onPlanMission}
                disabled={loadingStates.planning}
              >
                Plan Flight Grid
              </Button>
              <Button 
                variant="contained" 
                color="success"
                fullWidth 
                startIcon={loadingStates.simulating ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />} 
                onClick={onStartSimulation}
                disabled={loadingStates.simulating}
              >
                Launch UAV
              </Button>
            </Stack>
            {loadingStates.planning && (
              <Box sx={{ mt: 1.5, p: 1, borderRadius: 2, border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.01)' }}>
                <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Skeleton variant="text" width="85%" height={14} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton variant="text" width="40%" height={14} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
              </Box>
            )}
          </Box>

          {/* Phase 2: Photogrammetry & DEM */}
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                textTransform: 'uppercase', 
                fontWeight: '800', 
                display: 'block', 
                mb: 1,
                color: '#e040fb',
                letterSpacing: '0.5px'
              }}
            >
              Phase 2: Spatial Reconstruction
            </Typography>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={loadingStates.photogrammetry ? <CircularProgress size={16} /> : <AutoFixHighIcon />} 
              onClick={onRunPhotogrammetry}
              disabled={loadingStates.photogrammetry}
              sx={{ mb: 1 }}
            >
              Generate Orthomosaic & DEM
            </Button>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={loadingStates.terrain ? <CircularProgress size={16} /> : <TerrainIcon />} 
              onClick={onRunTerrainAnalysis}
              disabled={loadingStates.terrain}
            >
              Calculate Slope & Contours
            </Button>
            {loadingStates.photogrammetry && (
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                <Skeleton variant="rectangular" width="50%" height={50} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
                <Skeleton variant="rectangular" width="50%" height={50} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
              </Box>
            )}
            {loadingStates.terrain && (
              <Box sx={{ mt: 1.5, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Skeleton variant="text" width="80%" height={18} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                  <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton variant="rectangular" height={6} width="85%" sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton variant="rectangular" height={6} width="70%" sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Phase 3: Hazard warnings & Decision Support */}
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                textTransform: 'uppercase', 
                fontWeight: '800', 
                display: 'block', 
                mb: 1,
                color: '#ffa726',
                letterSpacing: '0.5px'
              }}
            >
              Phase 3: Environmental Intelligence
            </Typography>
            <Button 
              variant="contained" 
              color="warning"
              fullWidth 
              startIcon={loadingStates.hazards ? <CircularProgress size={16} color="inherit" /> : <WarningAmberIcon />} 
              onClick={onEvaluateHazards}
              disabled={loadingStates.hazards}
              sx={{ mb: 1 }}
            >
              Evaluate Hazard Warning
            </Button>
            {loadingStates.hazards && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.05)', border: '1px dashed rgba(255, 152, 0, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Skeleton variant="circular" width={18} height={18} sx={{ bgcolor: 'rgba(255, 152, 0, 0.2)' }} />
                  <Skeleton variant="text" width="55%" height={18} sx={{ bgcolor: 'rgba(255, 152, 0, 0.15)' }} />
                </Box>
                <Skeleton variant="text" width="90%" height={12} sx={{ bgcolor: 'rgba(255, 152, 0, 0.08)' }} />
                <Skeleton variant="text" width="75%" height={12} sx={{ bgcolor: 'rgba(255, 152, 0, 0.08)' }} />
              </Box>
            )}

            {hazardResult && !loadingStates.hazards && (
              <Alert 
                severity={hazardResult.overall_hazard_level === 'HIGH' ? 'error' : 'warning'}
                sx={{ mt: 1, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Risk Assessment: {hazardResult.overall_hazard_level}
                </Typography>
                {hazardResult.triggered_alerts.map((alert: string, i: number) => (
                  <Typography key={i} variant="caption" display="block">
                    • {alert}
                  </Typography>
                ))}
              </Alert>
            )}
          </Box>

          {/* Phase 4: Sign-off Report */}
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                textTransform: 'uppercase', 
                fontWeight: '800', 
                display: 'block', 
                mb: 1,
                color: '#26a69a',
                letterSpacing: '0.5px'
              }}
            >
              Phase 4: Output Synthesis
            </Typography>
            <Button 
              variant="outlined" 
              color="primary"
              fullWidth 
              startIcon={loadingStates.reporting ? <CircularProgress size={16} /> : <AssessmentIcon />} 
              onClick={onExportReport}
              disabled={loadingStates.reporting}
            >
              Compile Thesis PDF Report
            </Button>
            {loadingStates.reporting && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', gap: 1.5, alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Skeleton variant="rectangular" width={28} height={36} sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton variant="text" width="75%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                  <Skeleton variant="text" width="40%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                </Box>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
