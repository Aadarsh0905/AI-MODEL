import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, MenuItem, Select, FormControl, InputLabel, Tabs, Tab, CircularProgress, Alert, Stack } from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import axios from 'axios';

interface AuthPortalProps {
  onLoginSuccess: (token: string) => void;
  BACKEND_URL: string;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onLoginSuccess, BACKEND_URL }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('RESEARCHER');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please fill in all credentials.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      
      const res = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = res.data.access_token;
      onLoginSuccess(token);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName || !role) {
      setErrorMsg('Please complete all registration fields.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
        email,
        password,
        full_name: fullName,
        role,
        is_active: true
      });
      setSuccessMsg('Account registered successfully! You can now log in.');
      setTabIndex(0); // Redirect to Login Tab
      setPassword(''); // clear password field
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Registration failed. User may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, rgba(26, 32, 53, 1) 0%, rgba(11, 16, 26, 1) 90%)',
      position: 'relative',
      overflow: 'hidden',
      p: 2,
      '&::before': {
        content: '""',
        position: 'absolute',
        top: '-15%',
        left: '-15%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, rgba(0, 229, 255, 0) 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '-15%',
        right: '-15%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }
    }}>
      <Card sx={{ 
        width: '100%', 
        maxWidth: 460, 
        zIndex: 1,
        background: 'rgba(17, 25, 40, 0.55)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.5)',
        borderRadius: '24px'
      }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo / Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box sx={{ 
              width: 50, 
              height: 50, 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, #00e5ff 0%, #00e676 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 229, 255, 0.4)',
              mb: 2
            }}>
              <LockOpenIcon sx={{ color: '#111827', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, background: 'linear-gradient(90deg, #00e5ff 0%, #00e676 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 0.5 }}>
              EOS Terminal
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '1px', textTransform: 'uppercase' }}>
              Earth Observation Control Portal
            </Typography>
          </Box>

          {/* Form Tabs */}
          <Tabs 
            value={tabIndex} 
            onChange={handleTabChange} 
            variant="fullWidth" 
            sx={{ 
              mb: 3, 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '12px',
              p: 0.5,
              '& .MuiTabs-indicator': {
                height: '100%',
                borderRadius: '10px',
                background: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                zIndex: 0
              },
              '& .MuiTab-root': {
                zIndex: 1,
                minHeight: 40,
                textTransform: 'none',
                fontWeight: 'bold',
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#00e5ff'
                }
              }
            }}
          >
            <Tab label="Access Control" icon={<LockOpenIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Officer Registration" icon={<PersonAddIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', border: '1px solid rgba(244, 67, 54, 0.15)' }}>
              {errorMsg}
            </Alert>
          )}

          {successMsg && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.15)' }}>
              {successMsg}
            </Alert>
          )}

          {/* Tab 0: Login Form */}
          {tabIndex === 0 && (
            <form onSubmit={handleLogin}>
              <Stack spacing={2.5}>
                <TextField
                  label="Mission Email"
                  type="email"
                  fullWidth
                  variant="outlined"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@eos.org"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                    }
                  }}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  sx={{
                    height: 48,
                    borderRadius: '12px',
                    background: 'linear-gradient(90deg, #00e5ff 0%, #00e676 100%)',
                    color: '#111827',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)',
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #00b8d4 0%, #00c853 100%)',
                    }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Authenticate Credentials'}
                </Button>

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button 
                    type="button"
                    variant="text" 
                    size="small" 
                    onClick={() => {
                      setEmail('admin@eos.org');
                      setPassword('admin123');
                    }}
                    sx={{ 
                      fontSize: '0.7rem', 
                      textTransform: 'none', 
                      color: 'rgba(0, 229, 255, 0.85)', 
                      fontWeight: 'bold',
                      border: '1px solid rgba(0, 229, 255, 0.25)',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 0.5,
                      background: 'rgba(0, 229, 255, 0.05)',
                      '&:hover': {
                        background: 'rgba(0, 229, 255, 0.12)',
                        border: '1px solid rgba(0, 229, 255, 0.45)'
                      }
                    }}
                  >
                    ⚡ Quick Access: Use Seeded Admin Account
                  </Button>
                </Box>
              </Stack>
            </form>
          )}

          {/* Tab 1: Register Form */}
          {tabIndex === 1 && (
            <form onSubmit={handleRegister}>
              <Stack spacing={2.5}>
                <TextField
                  label="Full Name & Title"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Sarah Stone"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                    }
                  }}
                />
                <TextField
                  label="Officer Email"
                  type="email"
                  fullWidth
                  variant="outlined"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@eos.org"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                    }
                  }}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                    }
                  }}
                />
                <FormControl fullWidth variant="outlined">
                  <InputLabel id="role-select-label">Command Duty Role</InputLabel>
                  <Select
                    labelId="role-select-label"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    label="Command Duty Role"
                    sx={{ borderRadius: '12px' }}
                  >
                    <MenuItem value="RESEARCHER">RESEARCHER (Field PI)</MenuItem>
                    <MenuItem value="GIS_ANALYST">GIS_ANALYST (Spatial Reconstruction)</MenuItem>
                    <MenuItem value="FIELD_ENGINEER">FIELD_ENGINEER (UAV Controller)</MenuItem>
                    <MenuItem value="ENVIRONMENTAL_OFFICER">ENVIRONMENTAL_OFFICER (Auditor)</MenuItem>
                    <MenuItem value="ADMIN">ADMIN (Full Security Command)</MenuItem>
                  </Select>
                </FormControl>
                
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  sx={{
                    height: 48,
                    borderRadius: '12px',
                    background: 'linear-gradient(90deg, #00e5ff 0%, #00e676 100%)',
                    color: '#111827',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)',
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #00b8d4 0%, #00c853 100%)',
                    }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Register Officer Credentials'}
                </Button>
              </Stack>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
