import React, { useState } from 'react';
import { Card, CardContent, Typography, Grid, LinearProgress, Box, Divider, ButtonBase, Dialog, DialogContent, DialogTitle, IconButton, Button } from '@mui/material';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import SpeedIcon from '@mui/icons-material/Speed';
import HeightIcon from '@mui/icons-material/Height';
import ExploreIcon from '@mui/icons-material/Explore';
import CloseIcon from '@mui/icons-material/Close';
import FlashOnIcon from '@mui/icons-material/FlashOn';

const DroneIcon = () => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{
      width: 20,
      height: 20,
      display: 'inline-block',
      verticalAlign: 'middle',
      filter: 'drop-shadow(0 0 4px #00e5ff)',
      '@keyframes hoverFloat': {
        '0%': { transform: 'translateY(0px) rotate(0deg)' },
        '50%': { transform: 'translateY(-2px) rotate(3deg)' },
        '100%': { transform: 'translateY(0px) rotate(0deg)' }
      },
      animation: 'hoverFloat 3s ease-in-out infinite'
    }}
  >
    {/* Diagonal Quadcopter Arms */}
    <line x1="4" y1="4" x2="20" y2="20" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    <line x1="20" y1="4" x2="4" y2="20" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    
    {/* Rotor spinning ellipse discs */}
    <ellipse cx="4" cy="4" rx="4" ry="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
    <ellipse cx="20" cy="4" rx="4" ry="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
    <ellipse cx="4" cy="20" rx="4" ry="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
    <ellipse cx="20" cy="20" rx="4" ry="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />

    {/* Rotor Hubs */}
    <circle cx="4" cy="4" r="1.5" fill="#00e5ff" />
    <circle cx="20" cy="4" r="1.5" fill="#00e5ff" />
    <circle cx="4" cy="20" r="1.5" fill="#00e5ff" />
    <circle cx="20" cy="20" r="1.5" fill="#00e5ff" />

    {/* Fuselage / Core Flight Controller */}
    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#111827" stroke="#00e5ff" strokeWidth="2" />
    <circle cx="12" cy="12" r="1.2" fill="#00ff66" />
  </Box>
);

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

interface CapturedFile {
  name: string;
  type: string;
  url: string;
  time: string;
}

interface TelemetryPanelProps {
  data: TelemetryData;
  capturedFiles: CapturedFile[];
  onChargeBattery: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ data, capturedFiles, onChargeBattery }) => {
  const [selectedFile, setSelectedFile] = useState<CapturedFile | null>(null);

  const getBatteryColor = (pct: number) => {
    if (pct > 50) return 'success';
    if (pct > 20) return 'warning';
    return 'error';
  };

  const handleImageClick = (file: CapturedFile) => {
    setSelectedFile(file);
  };

  const handleClose = () => {
    setSelectedFile(null);
  };

  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'rgba(17, 25, 40, 0.55)',
      backdropFilter: 'blur(16px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
      borderRadius: '16px'
    }}>
      <CardContent sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: '#00e5ff', 
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0, 229, 255, 0.3)'
          }}
        >
          <DroneIcon /> Drone Live Telemetry
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
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#29b6f6', fontWeight: 'bold', fontSize: '0.8rem' }}>
                <HeightIcon fontSize="small" /> Altitude
              </Typography>
              <Typography variant="h6" sx={{ color: '#81d4fa', fontWeight: 800 }}>{data.altitude.toFixed(2)} m</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#ffa726', fontWeight: 'bold', fontSize: '0.8rem' }}>
                <SpeedIcon fontSize="small" /> Heading (Yaw)
              </Typography>
              <Typography variant="h6" sx={{ color: '#ffb74d', fontWeight: 800 }}>{data.yaw.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" sx={{ color: '#aeea00', fontWeight: 'bold', fontSize: '0.8rem' }}>Pitch</Typography>
              <Typography variant="h6" sx={{ color: '#d4e157', fontWeight: 800 }}>{data.pitch.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="body2" sx={{ color: '#c6ff00', fontWeight: 'bold', fontSize: '0.8rem' }}>Roll</Typography>
              <Typography variant="h6" sx={{ color: '#e6ee9c', fontWeight: 800 }}>{data.roll.toFixed(1)}°</Typography>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BatteryChargingFullIcon fontSize="small" /> Battery Capacity
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight="bold">{data.battery_percentage.toFixed(1)}%</Typography>
                  {data.state !== 'LANDED' && data.state !== 'COMPLETED' && (
                    <Button 
                      size="small" 
                      variant="text" 
                      startIcon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                      onClick={onChargeBattery}
                      sx={{ py: 0, px: 1, minWidth: 0, fontSize: '0.65rem', textTransform: 'none', color: '#ffb74d', fontWeight: 'bold' }}
                    >
                      Recharge
                    </Button>
                  )}
                </Box>
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
            <Box sx={{ p: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 1, border: '1px solid rgba(38, 166, 154, 0.15)' }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#26a69a', fontWeight: 'bold', fontSize: '0.8rem' }}>
                <ExploreIcon fontSize="small" /> GNSS Coordinates
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#80cbc4', fontWeight: 'bold', mt: 0.5 }}>
                {data.latitude.toFixed(7)}, {data.longitude.toFixed(7)}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#00e5ff', textShadow: '0 0 5px rgba(0, 229, 255, 0.2)' }}>
            Captured Payload Stream ({capturedFiles.length})
          </Typography>

          {capturedFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2, flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No sensor captures yet. Launch UAV to start stream.
            </Typography>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              gap: 1.5, 
              overflowX: 'auto', 
              pb: 1, 
              pt: 0.5,
              '&::-webkit-scrollbar': { height: 6 }, 
              '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 } 
            }}>
              {capturedFiles.map((file, idx) => (
                <ButtonBase 
                  key={idx} 
                  onClick={() => handleImageClick(file)}
                  disabled={file.type !== 'RGB' && file.type !== 'MULTISPECTRAL'}
                  sx={{ 
                    flexShrink: 0, 
                    width: 80, 
                    height: 80, 
                    borderRadius: 1.5, 
                    overflow: 'hidden', 
                    position: 'relative', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.05)', border: '1px solid #00e5ff' }
                  }}
                >
                  {file.type === 'RGB' || file.type === 'MULTISPECTRAL' ? (
                    <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', p: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 'bold', color: file.type === 'LIDAR' ? '#ffeb3b' : '#ff5722', lineHeight: 1.1 }}>
                        {file.type}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.5rem', opacity: 0.6, mt: 0.5 }}>
                        {file.time}
                      </Typography>
                    </Box>
                  )}
                  
                  {(file.type === 'RGB' || file.type === 'MULTISPECTRAL') && (
                    <Box sx={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      background: 'rgba(15,23,42,0.75)', 
                      py: 0.2, 
                      px: 0.5, 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      backdropFilter: 'blur(2px)'
                    }}>
                      <Typography variant="caption" sx={{ fontSize: '0.5rem', fontWeight: 'bold' }}>{file.type}</Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.5rem', opacity: 0.8 }}>{file.time}</Typography>
                    </Box>
                  )}
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>
      </CardContent>

      <Dialog open={!!selectedFile} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', color: '#fff' }}>
          <Typography variant="h6" component="div">
            {selectedFile?.type} Sensor Capture: {selectedFile?.name}
          </Typography>
          <IconButton onClick={handleClose} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {selectedFile && (
            <img 
              src={selectedFile.url} 
              alt={selectedFile.name} 
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', padding: '10px' }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
