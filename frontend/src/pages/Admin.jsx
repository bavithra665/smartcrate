import React, { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import { mockAdminStats } from '../data/mockData';
import { getPredictionEvaluation } from '../api/adminApi';
import {
  FaUsers, FaSeedling, FaLeaf, FaExclamationTriangle, FaStore, FaClock
} from 'react-icons/fa';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import './Admin.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Admin({ farmer, onLogout }) {
  const stats = mockAdminStats;
  const [evaluation, setEvaluation] = useState(null);
  const [evaluationError, setEvaluationError] = useState('');
  const [evaluationLoading, setEvaluationLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPredictionEvaluation()
      .then((response) => {
        if (mounted) setEvaluation(response.data);
      })
      .catch((error) => {
        if (mounted) setEvaluationError(error.response?.data?.message || 'Unable to load prediction evaluation.');
      })
      .finally(() => {
        if (mounted) setEvaluationLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const cropChartData = {
    labels: stats.cropDistribution.map(c => c.crop),
    datasets: [{
      data: stats.cropDistribution.map(c => c.count),
      backgroundColor: ['#2d7a3a', '#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9'],
      borderWidth: 0,
    }],
  };

  const riskChartData = {
    labels: stats.riskDistribution.map(r => r.risk),
    datasets: [{
      label: 'Batches',
      data: stats.riskDistribution.map(r => r.count),
      backgroundColor: ['#38a169', '#dd6b20', '#e53e3e'],
      borderRadius: 6,
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    maintainAspectRatio: false,
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
    maintainAspectRatio: false,
  };

  return (
    <DashboardLayout farmer={farmer} pageTitle="Admin Dashboard" onLogout={onLogout}>
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Admin Dashboard</h1>
          <span className="badge badge-info">Admin View</span>
        </div>
        <p className="page-subtitle">Platform overview and monitoring statistics.</p>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <DashboardCard title="Total Farmers" value={stats.totalFarmers}
            subtitle="Registered on platform" icon={<FaUsers />} color="var(--primary)" />
          <DashboardCard title="Active Harvests" value={stats.activeHarvests}
            subtitle="Currently monitored" icon={<FaSeedling />} color="#2b6cb0" />
          <DashboardCard title="Crops Monitored" value={stats.cropsMonitored}
            subtitle="Different crop types" icon={<FaLeaf />} color="#6b46c1" />
          <DashboardCard title="High Risk Batches" value={stats.highRiskBatches}
            subtitle="Require immediate action" icon={<FaExclamationTriangle />} color="var(--risk-high)" />
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          <DashboardCard title="Total Markets" value={stats.totalMarkets}
            subtitle="Registered markets" icon={<FaStore />} color="var(--risk-medium)" />
          <DashboardCard title="Avg. Shelf Life" value="7.2 Days"
            subtitle="Across all active batches" icon={<FaClock />} color="var(--primary)" />
        </div>

        <div className="card admin-evaluation-card" style={{ marginBottom: 28 }}>
          <div className="section-header">
            <div>
              <div className="section-title">Prediction Evaluation</div>
              <div className="admin-evaluation-note">Real-world outcomes are evaluated separately from the production model.</div>
            </div>
            <span className={`badge ${evaluation?.status === 'ok' ? 'badge-success' : 'badge-info'}`}>
              {evaluationLoading ? 'Loading' : evaluation?.status === 'ok' ? 'Evaluation available' : 'Insufficient data'}
            </span>
          </div>
          {evaluationError && <div className="alert alert-error">{evaluationError}</div>}
          {!evaluationLoading && !evaluationError && (
            <>
              <div className="grid-4 admin-evaluation-stats">
                <div><strong>{evaluation?.evaluatedSamples ?? 0}</strong><span>Evaluated samples</span></div>
                <div><strong>{Math.round((evaluation?.outcomeCoverage || 0) * 100)}%</strong><span>Outcome coverage</span></div>
                <div><strong>{evaluation?.modelVersions?.join(', ') || 'Unavailable'}</strong><span>Model versions</span></div>
                <div><strong>{evaluation?.metrics?.available ? `${Math.round((evaluation.metrics.f1 || 0) * 100)}%` : 'Unavailable'}</strong><span>Binary spoilage F1</span></div>
              </div>
              <p className="admin-evaluation-message">
                {evaluation?.message || 'Insufficient labeled outcomes for reliable evaluation.'}
              </p>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="admin-charts">
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>Crop Distribution</div>
            <div style={{ height: 260 }}>
              <Doughnut data={cropChartData} options={chartOptions} />
            </div>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>Risk Distribution</div>
            <div style={{ height: 260 }}>
              <Bar data={riskChartData} options={barOptions} />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Recent Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {stats.recentActivity.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderBottom: i < stats.recentActivity.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--primary-bg)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.9rem', flexShrink: 0
                  }}>
                    {a.farmer.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{a.farmer}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>{a.action}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', flexShrink: 0 }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
