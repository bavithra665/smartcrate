import React from 'react';
import { FaMapMarkerAlt, FaClock, FaRupeeSign, FaTruck, FaStar } from 'react-icons/fa';
import { formatCurrency } from '../utils/predictionUtils';

export default function MarketCard({ market, crop, quantity = null, isRecommended = false }) {
  const price = market.price ?? market.currentPrice ?? null;
  const marketName = market.marketName || market.name || 'Market';
  const marketLocation = market.location || market.marketLocation || 'Location unavailable';
  const transportCost = market.transportCost ?? null;
  const hasPrice = typeof price === 'number' && Number.isFinite(price) && price > 0;
  const gross = hasPrice && typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
    ? price * quantity
    : null;
  const net = gross !== null && transportCost !== null ? gross - transportCost : null;
  const isSamplePrice = market.metadata?.sample === true || /mock|sample|development/i.test(String(market.source || ''));

  return (
    <div className={`card ${isRecommended ? 'recommended-card' : ''}`} style={{ position: 'relative' }}>
      {isRecommended && <div className="recommended-label"><FaStar style={{ marginRight: 4 }} />Best Choice</div>}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-dark)', marginBottom: 2 }}>
          {marketName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-light)', fontSize: '0.85rem' }}>
          <FaMapMarkerAlt /> {marketLocation}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>Distance</div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{market.distance ?? 'Unavailable'} {market.distance ? 'km' : ''}</div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>
            <FaClock style={{ marginRight: 3 }} />Travel Time
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{market.travelTime || 'Unavailable'}</div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>
            <FaRupeeSign style={{ marginRight: 3 }} />Current Price
          </div>
          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
            {hasPrice ? `₹${price}` : 'Unavailable'}
          </div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 2 }}>
            <FaTruck style={{ marginRight: 3 }} />Transport Cost
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{transportCost !== null ? `₹${transportCost}` : 'Unavailable'}</div>
        </div>
      </div>

      {crop && (
        <div style={{
          background: isRecommended ? 'var(--primary-bg)' : 'var(--bg)',
          borderRadius: 8, padding: '10px 14px',
          border: isRecommended ? '1px solid var(--border)' : 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-medium)', fontWeight: 600 }}>
              Expected Net Value
            </span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isRecommended ? 'var(--primary)' : 'var(--text-dark)' }}>
              {net !== null ? formatCurrency(net) : 'Unavailable'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 2 }}>
            {isSamplePrice ? 'Development sample data; not live market pricing.' : net !== null ? `Gross ${formatCurrency(gross)} − Transport ${formatCurrency(transportCost)}` : 'Net value requires an available price, harvest quantity, and transport cost.'}
          </div>
        </div>
      )}
      {market.source && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 10 }}>
        Source: {market.source}{isSamplePrice ? ' (sample only)' : ''}
      </div>}
    </div>
  );
}
