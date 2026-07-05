import React from 'react';
import { Card, CardContent, Typography, Button, Stack, Box, TextField, Alert, CircularProgress } from '@mui/material';
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
    <Card sx={{ height: '100%', overflowY: 'auto' }}>
      <CardContent>
        <Typography variant="h6" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon /> Earth Observation Control
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          {/* Phase 1: Mission Prep */}
          <Box>
            <Typography variant="caption" color="text.secondary" uppercase sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
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
          </Box>

          {/* Phase 2: Photogrammetry & DEM */}
          <Box>
            <Typography variant="caption" color="text.secondary" uppercase sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
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
          </Box>

          {/* Phase 3: Hazard warnings & Decision Support */}
          <Box>
            <Typography variant="caption" color="text.secondary" uppercase sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
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

            {hazardResult && (
              <Alert 
                severity={hazardResult.overall_hazard_level === 'HIGH' ? 'error' : 'warning'}
                sx={{ mt: 1, borderRadius: 2 }}
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
            <Typography variant="caption" color="text.secondary" uppercase sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
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
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
