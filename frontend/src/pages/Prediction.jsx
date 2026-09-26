import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RiskBadge from '../components/RiskBadge';
import { getLatestPrediction } from '../api/predictionApi';
import { FaSeedling, FaThermometerHalf, FaTint, FaFlask, FaLightbulb, FaArrowRight } from 'react-icons/fa';
import './Prediction.css';

export default function Prediction({ farmer, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const harvest = location.state?.harvest;
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(Boolean(harvest?.id || harvest?._id));
  const [error, setError] = useState('');
  const harvestId = harvest?._id || harvest?.id;

  useEffect(() => {
    if (!harvestId) return undefined;

    let mounted = true;
    let attempts = 0;
    let retryTimer;

    const loadPrediction = async () => {
      try {
        const response = await getLatestPrediction(harvestId);
        if (mounted) {
          setPrediction(response.data);
          setLoading(false);
        }
      } catch (apiError) {
        if (!mounted) return;
        if (apiError.response?.status === 404 && attempts < 4) {
          attempts += 1;
          retryTimer = setTimeout(loadPrediction, 1500);
          return;
        }
        if (apiError.response?.status !== 404) setError('Unable to load prediction.');
        if (mounted) setLoading(false);
      }
    };

    loadPrediction();
    return () => {
      mounted = false;
      clearTimeout(retryTimer);
    };
  }, [harvestId]);

  const risk = prediction?.spoilageRisk;
  const shelfLifeAvailable = Number.isFinite(prediction?.remainingShelfLife)
    && Boolean(prediction?.shelfLifeModelVersion && prediction?.shelfLifeModelSource);
  const circleColor = risk === 'High' ? 'var(--risk-high)' :
    risk === 'Medium' ? 'var(--risk-medium)' : 'var(--risk-low)';

  if (!harvest) {
    return (
      <DashboardLayout farmer={farmer} pageTitle="Shelf-Life Prediction" onLogout={onLogout}>
        <div className="page-content">
          <h1 className="page-title">Shelf-Life Prediction</h1>
          <div className="alert alert-info">Open a harvest from the dashboard to view its prediction.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout farmer={farmer} pageTitle="Shelf-Life Prediction" onLogout={onLogout}>
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Shelf-Life Prediction</h1>
            <p className="page-subtitle">
              <span className="demo-badge">Backend Prediction</span>
              &nbsp;Spoilage risk from the SmartCrate prediction service.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/recommendation', { state: { harvest } })}>
            Get Recommendation <FaArrowRight />
          </button>
        </div>

        <div className="prediction-grid">
          {/* Main prediction card */}
          <div className="card prediction-main-card">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                <FaSeedling style={{ marginRight: 6 }} />{harvest.crop || harvest.cropType}
              </div>
              {loading ? <div className="alert alert-info">Loading prediction...</div> : prediction ? (
                <>
                  {shelfLifeAvailable ? (
                    <div className="prediction-circle" style={{ '--circle-color': circleColor }}>
                      <div className="prediction-circle-inner">
                        <div className="prediction-circle-value">{prediction.remainingShelfLife}</div>
                        <div className="prediction-circle-unit">{prediction.shelfLifeUnit || 'days'}</div>
                      </div>
                    </div>
                  ) : <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-medium)', marginBottom: 16 }}>Shelf-life model: Data collection in progress</div>}
                  <RiskBadge risk={risk} />
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-medium)' }}>
                    <div>Shelf-life model: Data collection in progress</div>
                    Prediction pending. Sensor data has not produced a prediction yet.
                  </div>
                </>
              )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="prediction-confidence">
              <span>Spoilage-risk confidence</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${prediction?.spoilageRiskConfidence ? prediction.spoilageRiskConfidence * 100 : 0}%`, height: '100%', background: 'var(--primary)', borderRadius: 20 }} />
                </div>
                <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 36 }}>{prediction?.spoilageRiskConfidence ? `${Math.round(prediction.spoilageRiskConfidence * 100)}%` : '--'}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Conditions */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Crop Conditions</div>
              <div className="prediction-conditions">
                <div className="condition-item">
                  <div className="condition-icon" style={{ background: '#fff5f5', color: 'var(--risk-high)' }}>
                    <FaThermometerHalf />
                  </div>
                  <div>
                    <div className="condition-label">Temperature</div>
                    <div className="condition-value">{harvest.temperature || '--'}°C</div>
                  </div>
                </div>
                <div className="condition-item">
                  <div className="condition-icon" style={{ background: '#ebf8ff', color: '#2b6cb0' }}>
                    <FaTint />
                  </div>
                  <div>
                    <div className="condition-label">Humidity</div>
                    <div className="condition-value">{harvest.humidity || '--'}%</div>
                  </div>
                </div>
                <div className="condition-item">
                  <div className="condition-icon" style={{ background: '#f0fff4', color: 'var(--risk-low)' }}>
                    <FaFlask />
                  </div>
                  <div>
                    <div className="condition-label">Ethylene Level</div>
                    <div className="condition-value">{harvest.ethyleneLevel || '--'} ppm</div>
                  </div>
                </div>
                <div className="condition-item">
                  <div className="condition-icon" style={{ background: '#fffaf0', color: 'var(--risk-medium)' }}>
                    <FaFlask />
                  </div>
                  <div>
                    <div className="condition-label">VOC Level</div>
                    <div className="condition-value">{harvest.vocLevel || '--'} ppm</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="card prediction-summary-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FaLightbulb style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
                <div className="section-title">Prediction Summary</div>
              </div>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-medium)', lineHeight: 1.7, marginBottom: 14 }}>
                Spoilage risk is assessed from the available prediction workflow. Remaining shelf life is shown only when a trained shelf-life model is available.
                {risk === 'High' && ' Immediate action is recommended due to high spoilage risk.'}
                {risk === 'Medium' && ' Monitor the batch closely.'}
                {risk === 'Low' && ' Current spoilage risk is low.'}
                {!prediction && ' A prediction will appear after sensor data is processed.'}
              </p>
              <div className="prediction-summary-items">
                <div className="summary-item">
                  <span>Crop</span><strong>{harvest.crop || harvest.cropType}</strong>
                </div>
                <div className="summary-item">
                  <span>Quantity</span><strong>{harvest.quantity} kg</strong>
                </div>
                <div className="summary-item">
                  <span>Harvest Date</span><strong>{harvest.harvestDate}</strong>
                </div>
                <div className="summary-item">
                  <span>Storage</span><strong>{harvest.storageCondition || '--'}</strong>
                </div>
                <div className="summary-item">
                  <span>Maturity</span><strong>{harvest.maturityStage || '--'}</strong>
                </div>
                {prediction && <div className="summary-item"><span>Model</span><strong>{prediction.modelVersion || prediction.source || '--'}</strong></div>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/markets')}>
            View Markets
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/recommendation', { state: { harvest } })}>
            Get Selling Recommendation <FaArrowRight />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
