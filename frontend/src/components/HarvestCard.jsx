import React from 'react';
import { useNavigate } from 'react-router-dom';
import RiskBadge from './RiskBadge';
import ProgressBar from './ProgressBar';
import { FaSeedling, FaWeight, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';

export default function HarvestCard({ harvest }) {
  const navigate = useNavigate();

  const recColor = {
    'Sell Today': 'var(--risk-high)',
    'Wait for a Better Price': 'var(--risk-low)',
    'Move Produce': 'var(--risk-medium)',
    'Transport to Another Market': 'var(--primary)',
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'var(--primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary)', fontSize: '1.2rem'
          }}>
            <FaSeedling />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-dark)' }}>{harvest.crop}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{harvest.variety}</div>
          </div>
        </div>
        {harvest.spoilageRisk
          ? <RiskBadge risk={harvest.spoilageRisk} />
          : <span className="badge badge-info">Prediction Pending</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>
            <FaWeight style={{ marginRight: 4 }} />Quantity
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{harvest.quantity} kg</div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>
            <FaCalendarAlt style={{ marginRight: 4 }} />Harvested
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{harvest.harvestDate}</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-medium)', marginBottom: 6, fontWeight: 600 }}>
          Remaining Shelf Life
        </div>
        {typeof harvest.remainingShelfLife === 'number' && typeof harvest.predictedShelfLife === 'number' ? (
          <ProgressBar value={harvest.remainingShelfLife} max={harvest.predictedShelfLife} />
        ) : (
          <div className="badge badge-info">Prediction pending</div>
        )}
      </div>

      <div style={{
        background: `${recColor[harvest.recommendation] || 'var(--primary)'}15`,
        border: `1px solid ${recColor[harvest.recommendation] || 'var(--primary)'}40`,
        borderRadius: 8, padding: '8px 12px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-medium)' }}>Recommendation:</span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: recColor[harvest.recommendation] || 'var(--primary)' }}>
          {harvest.recommendation || 'Pending prediction'}
        </span>
      </div>

      <button
        className="btn btn-outline btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => navigate('/prediction', { state: { harvest } })}
      >
        View Details <FaArrowRight />
      </button>
    </div>
  );
}
