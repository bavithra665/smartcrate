import React, { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import { getAdminStats, getMlDataReadiness, getPredictionEvaluation } from '../api/adminApi';
import {
  FaUsers, FaSeedling, FaLeaf, FaExclamationTriangle, FaMicrochip, FaChartLine
} from 'react-icons/fa';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import './Admin.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Admin({ farmer, onLogout }) {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluationError, setEvaluationError] = useState('');
  const [evaluationLoading, setEvaluationLoading] = useState(true);
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState('');

  useEffect(() => {
    let mounted = true;
    getAdminStats()
      .then((response) => { if (mounted) setStats(response.data); })
      .catch((error) => { if (mounted) setStatsError(error.response?.data?.message || 'Unable to load admin statistics.'); })
      .finally(() => { if (mounted) setStatsLoading(false); });
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
    getMlDataReadiness()
      .then((response) => { if (mounted) setReadiness(response.data); })
      .catch((error) => { if (mounted) setReadinessError(error.response?.data?.message || 'Unable to load shelf-life readiness.'); });
    return () => { mounted = false; };
  }, []);

  const cropDistribution = stats?.cropDistribution || [];
  const riskDistribution = stats?.riskDistribution || [];
  const cropChartData = {
    labels: cropDistribution.map(c => c.crop),
    datasets: [{
      data: cropDistribution.map(c => c.count),
      backgroundColor: ['#2d7a3a', '#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9'],
      borderWidth: 0,
    }],
  };

  const riskChartData = {
    labels: riskDistribution.map(r => r.risk),
    datasets: [{
      label: 'Batches',
      data: riskDistribution.map(r => r.count),
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
  const statValue = (field) => statsLoading ? 'Loading' : statsError ? 'Unavailable' : stats?.[field] ?? 0;

  return (
    <DashboardLayout farmer={farmer} pageTitle="Admin Dashboard" onLogout={onLogout}>
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Admin Dashboard</h1>
          <span className="badge badge-info">Admin View</span>
        </div>
        <p className="page-subtitle">Platform overview and monitoring statistics.</p>
        {statsError && <div className="alert alert-error">{statsError}</div>}

        <div className="grid-4" style={{ marginBottom: 28 }}>
          <DashboardCard title="Total Farmers" value={statValue('totalFarmers')}
            subtitle="Registered farmer accounts" icon={<FaUsers />} color="var(--primary)" />
          <DashboardCard title="Active Harvests" value={statValue('activeHarvests')}
            subtitle="Currently monitored" icon={<FaSeedling />} color="#2b6cb0" />
          <DashboardCard title="Sensor Readings" value={statValue('totalSensorReadings')}
            subtitle="Stored observations" icon={<FaMicrochip />} color="#6b46c1" />
          <DashboardCard title="High-Risk Predictions" value={statValue('highRiskCount')}
            subtitle="Stored classifier outputs" icon={<FaExclamationTriangle />} color="var(--risk-high)" />
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          <DashboardCard title="Total Harvests" value={statValue('totalHarvests')}
            subtitle="All recorded batches" icon={<FaLeaf />} color="var(--primary)" />
          <DashboardCard title="Total Predictions" value={statValue('totalPredictions')}
            subtitle="Stored spoilage-risk results" icon={<FaChartLine />} color="var(--risk-medium)" />
        </div>

        <div className="card admin-evaluation-card" style={{ marginBottom: 28 }}>
          <div className="section-title">Shelf-Life Model Readiness</div>
          {readinessError ? <div className="alert alert-error">{readinessError}</div> : readiness ? (
            <>
              <p>{readiness.shelfLifeRegressionTrainingJustified ? 'Ready for regression training' : 'Shelf-life model: Data collection in progress'}</p>
              <div className="grid-4 admin-evaluation-stats">
                <div><strong>{readiness.validShelfLifeTrainingRows ?? 0}/{readiness.minimumValidTrainingRows ?? 30}</strong><span>Valid labeled rows</span></div>
                <div><strong>{readiness.distinctTrainingBatches ?? 0}/{readiness.minimumDistinctHarvestBatches ?? 10}</strong><span>Distinct harvest batches</span></div>
                <div><strong>{readiness.censoredBatches ?? 0}</strong><span>Censored batches</span></div>
                <div><strong>{readiness.unknownEndpointBatches ?? 0}</strong><span>Unknown endpoints</span></div>
              </div>
            </>
          ) : <div className="empty-state">Loading shelf-life readiness...</div>}
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
        {!statsError && !statsLoading && (
          <div className="admin-charts">
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Crop Distribution</div>
              {cropDistribution.length ? <div style={{ height: 260 }}>
                <Doughnut data={cropChartData} options={chartOptions} />
              </div> : <div className="empty-state">No harvest data available.</div>}
            </div>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Risk Distribution</div>
              {riskDistribution.length ? <div style={{ height: 260 }}>
                <Bar data={riskChartData} options={barOptions} />
              </div> : <div className="empty-state">No prediction data available.</div>}
            </div>
          </div>
        )}

        {stats?.recentFarmers?.length > 0 && <div className="card" style={{ marginTop: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Recently Registered Farmers</div>
          {stats.recentFarmers.map((recentFarmer) => (
            <div key={recentFarmer._id} className="summary-item">
              <span>{recentFarmer.name}</span>
              <strong>{recentFarmer.createdAt ? new Date(recentFarmer.createdAt).toLocaleDateString() : 'Date unavailable'}</strong>
            </div>
          ))}
        </div>}
      </div>
    </DashboardLayout>
  );
}
