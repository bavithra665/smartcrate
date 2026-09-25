import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { mockFarmer } from './data/mockData';
import { getCurrentFarmer } from './api/authApi';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddHarvest from './pages/AddHarvest';
import Prediction from './pages/Prediction';
import Markets from './pages/Markets';
import Recommendation from './pages/Recommendation';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

import './styles/global.css';

// Protected route wrapper
function ProtectedRoute({ children, isLoggedIn }) {
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [farmer, setFarmer] = useState(mockFarmer);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const handleAuthExpired = () => {
      localStorage.removeItem('sc_auth');
      setIsLoggedIn(false);
      setFarmer(mockFarmer);
    };

    const restoreSession = async () => {
      const auth = localStorage.getItem('sc_auth');
      if (!auth) {
        setAuthLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(auth);
        if (!parsed.token) throw new Error('Invalid stored session');
        const response = await getCurrentFarmer();
        setFarmer(response.data);
        setIsLoggedIn(true);
      } catch {
        handleAuthExpired();
      } finally {
        setAuthLoading(false);
      }
    };

    window.addEventListener('sc-auth-expired', handleAuthExpired);
    restoreSession();
    return () => window.removeEventListener('sc-auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = ({ token, farmer: authenticatedFarmer }) => {
    localStorage.setItem('sc_auth', JSON.stringify({ token }));
    setFarmer(authenticatedFarmer);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('sc_auth');
    setIsLoggedIn(false);
  };

  const handleAddHarvest = (newHarvest) => {
    // Future: POST /api/harvest — for now just update local state
    console.log('New harvest added:', newHarvest);
  };

  const handleUpdateFarmer = (updatedFarmer) => {
    // Future: PUT /api/farmer/profile
    setFarmer(updatedFarmer);
  };

  const dashboardProps = { farmer, onLogout: handleLogout };

  if (authLoading) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={
          isLoggedIn ? <Navigate to="/dashboard" replace /> :
            <Login onLogin={handleLogin} />
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Dashboard {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/add-harvest" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <AddHarvest {...dashboardProps} onAddHarvest={handleAddHarvest} />
          </ProtectedRoute>
        } />
        <Route path="/prediction" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Prediction {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/markets" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Markets {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/recommendation" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Recommendation {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <History {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Notifications {...dashboardProps} />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Profile {...dashboardProps} onUpdateFarmer={handleUpdateFarmer} />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <Admin {...dashboardProps} />
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
