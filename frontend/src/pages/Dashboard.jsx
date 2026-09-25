import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import HarvestCard from '../components/HarvestCard';
import { getHarvests, normalizeHarvest } from '../api/harvestApi';
import {
  FaSeedling, FaChartLine, FaStore, FaHistory,
  FaExclamationTriangle, FaCheckCircle, FaLeaf, FaClock
} from 'react-icons/fa';
import './Dashboard.css';

const quickActions = [
  { label: 'Add Harvest', icon: <FaSeedling />, path: '/add-harvest', color: 'var(--primary)' },
  { label: 'Check Prediction', icon: <FaChartLine />, path: '/prediction', color: '#2b6cb0' },
  { label: 'View Markets', icon: <FaStore />, path: '/markets', color: '#c05621' },
  { label: 'View History', icon: <FaHistory />, path: '/history', color: '#6b46c1' },
];

export default function Dashboard({ farmer, onLogout }) {
  const navigate = useNavigate();
  const [activeHarvests, setActiveHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadHarvests = async () => {
      try {
        const response = await getHarvests('Active');
        if (mounted) setActiveHarvests(response.data.map(normalizeHarvest));
      } catch (apiError) {
        if (mounted) setError(apiError.response?.data?.message || 'Unable to load your harvests.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHarvests();
    return () => { mounted = false; };
  }, []);

  const highRisk = activeHarvests.filter(h => h.spoilageRisk === 'High').length;
  const medRisk = activeHarvests.filter(h => h.spoilageRisk === 'Medium').length;

  return (
    <DashboardLayout farmer={farmer} pageTitle="Dashboard" onLogout={onLogout}>
      <div className="page-content">
        {/* Welcome */}
        <div className="dashboard-welcome">
          <div>
            <h1 className="page-title">Welcome back, {farmer?.name?.split(' ')[0] || 'Farmer'}! 👋</h1>
            <p className="page-subtitle">Here's an overview of your harvest and market status today.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/add-harvest')}>
            <FaSeedling /> Add New Harvest
          </button>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <DashboardCard
            title="Active Batches"
            value={activeHarvests.length}
            subtitle="Currently being monitored"
            icon={<FaLeaf />}
            color="var(--primary)"
          />
          <DashboardCard
            title="High Risk Batches"
            value={highRisk}
            subtitle="Require immediate action"
            icon={<FaExclamationTriangle />}
            color="var(--risk-high)"
          />
          <DashboardCard
            title="Medium Risk"
            value={medRisk}
            subtitle="Monitor closely"
            icon={<FaClock />}
            color="var(--risk-medium)"
          />
          <DashboardCard
            title="Safe Batches"
            value={activeHarvests.length - highRisk - medRisk}
            subtitle="Good condition"
            icon={<FaCheckCircle />}
            color="var(--risk-low)"
          />
        </div>

        {/* Quick Actions */}
        <div className="section-header">
          <div className="section-title">Quick Actions</div>
        </div>
        <div className="grid-4" style={{ marginBottom: 32 }}>
          {quickActions.map((action) => (
            <button
              key={action.path}
              className="dashboard-quick-action"
              onClick={() => navigate(action.path)}
              style={{ '--action-color': action.color }}
            >
              <div className="quick-action-icon">{action.icon}</div>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Active Harvests */}
        <div className="section-header">
          <div className="section-title">Active Harvest Batches</div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/history')}>
            View All
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="empty-state"><span className="spinner" /><p>Loading active harvests...</p></div>
        ) : activeHarvests.length === 0 ? (
          <div className="empty-state">
            <FaSeedling />
            <p>No active harvest batches. Add your first harvest to get started.</p>
            <button className="btn btn-primary" onClick={() => navigate('/add-harvest')}>
              Add Harvest
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {activeHarvests.map((harvest) => (
              <HarvestCard key={harvest.id} harvest={harvest} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
