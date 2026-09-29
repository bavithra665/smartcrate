import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaLeaf, FaTachometerAlt, FaSeedling, FaChartLine,
  FaStore, FaLightbulb, FaHistory, FaBell, FaUser,
  FaShieldAlt, FaSignOutAlt, FaTimes, FaBars
} from 'react-icons/fa';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Dashboard' },
  { path: '/add-harvest', icon: <FaSeedling />, label: 'Add Harvest' },
  { path: '/prediction', icon: <FaChartLine />, label: 'Prediction' },
  { path: '/markets', icon: <FaStore />, label: 'Markets' },
  { path: '/recommendation', icon: <FaLightbulb />, label: 'Recommendation' },
  { path: '/history', icon: <FaHistory />, label: 'History' },
  { path: '/notifications', icon: <FaBell />, label: 'Notifications' },
  { path: '/profile', icon: <FaUser />, label: 'Profile' },
  { path: '/admin', icon: <FaShieldAlt />, label: 'Admin' },
];

export default function Sidebar({ farmer, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login');
  };

  const renderSidebarContent = () => (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><FaLeaf /></div>
        <div>
          <div className="sidebar-logo-name">SmartCrate</div>
          <div className="sidebar-logo-tag">AgriTech Platform</div>
        </div>
        <button className="sidebar-close-btn" onClick={() => setMobileOpen(false)}>
          <FaTimes />
        </button>
      </div>

      <div className="sidebar-farmer">
        <div className="sidebar-farmer-avatar">
          {farmer?.name?.charAt(0) || 'F'}
        </div>
        <div>
          <div className="sidebar-farmer-name">{farmer?.name || 'Farmer'}</div>
          <div className="sidebar-farmer-loc">{farmer?.location || ''}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.filter((item) => item.path !== '/admin' || farmer?.role === 'admin').map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <FaSignOutAlt /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button className="sidebar-mobile-toggle" onClick={() => setMobileOpen(true)}>
        <FaBars />
      </button>

      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        {renderSidebarContent()}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}>
          <div className="sidebar-mobile" onClick={(e) => e.stopPropagation()}>
            {renderSidebarContent()}
          </div>
        </div>
      )}
    </>
  );
}
