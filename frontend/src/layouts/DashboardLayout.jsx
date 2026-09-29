import React from 'react';
import Sidebar from '../components/Sidebar';
import { FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './DashboardLayout.css';

export default function DashboardLayout({ children, farmer, pageTitle, onLogout }) {
  const navigate = useNavigate();
  return (
    <div className="dashboard-layout">
      <Sidebar farmer={farmer} onLogout={onLogout} />
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-title">{pageTitle}</div>
          <div className="dashboard-topbar-actions">
            <button
              className="topbar-icon-btn"
              onClick={() => navigate('/notifications')}
              title="Notifications"
            >
              <FaBell />
            </button>
            <div className="topbar-avatar" onClick={() => navigate('/profile')}>
              {farmer?.name?.charAt(0) || 'F'}
            </div>
          </div>
        </header>
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}
