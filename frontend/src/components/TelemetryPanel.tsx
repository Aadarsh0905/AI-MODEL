import React from 'react';
import { Card, CardContent, Typography, Grid, LinearProgress, Box } from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import SpeedIcon from '@mui/icons-material/Speed';
import HeightIcon from '@mui/icons-material/Height';
import ExploreIcon from '@mui/icons-material/Explore';

interface TelemetryData {
  latitude: number;
  longitude: number;
  altitude: number;
  pitch: number;
  roll: number;
  yaw: number;
  battery_percentage: number;
  state: string;
  speed?: number;
}

interface TelemetryPanelProps {
  data: TelemetryData;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ data }) => {
  const getBatteryColor = (pct: number) => {
    if (pct > 50) return 'success';
    if (pct > 20) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlightTakeoffIcon /> Drone Live Telemetry
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Mission State</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: data.state === 'RTL' ? 'warning.main' : 'success.main' }}>
            {data.state}
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <HeightIcon fontSize="small" /> Altitude
              </Typography>
              <Typography variant="h6">{data.altitude.toFixed(2)} m</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SpeedIcon fontSize="small" /> Heading (Yaw)
              </Typography>
              <Typography variant="h6">{data.yaw.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" color="text.secondary">Pitch</Typography>
              <Typography variant="h6">{data.pitch.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" color="text.secondary">Roll</Typography>
              <Typography variant="h6">{data.roll.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BatteryChargingFullIcon fontSize="small" /> Battery Capacity
                </Typography>
                <Typography variant="body2" fontWeight="bold">{data.battery_percentage.toFixed(1)}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={data.battery_percentage} 
                color={getBatteryColor(data.battery_percentage)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ mt: 1, p: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ExploreIcon fontSize="small" /> GNSS Coordinates
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {data.latitude.toFixed(7)}, {data.longitude.toFixed(7)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
