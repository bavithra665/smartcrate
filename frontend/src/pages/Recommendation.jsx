import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RiskBadge from '../components/RiskBadge';
import { getHarvests } from '../api/harvestApi';
import { generateRecommendation, getLatestRecommendation } from '../api/recommendationApi';
import { formatCurrency } from '../utils/predictionUtils';
import { FaArrowRight, FaSeedling } from 'react-icons/fa';
import './Recommendation.css';

const displayValue = (value, formatter = (item) => item) => value === null || value === undefined ? 'Unavailable' : formatter(value);

export default function Recommendation({ farmer, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [harvest, setHarvest] = useState(location.state?.harvest || null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let selected = location.state?.harvest;
        if (!selected) {
          const harvests = await getHarvests('Active');
          selected = harvests.data[0];
        }
        if (!selected?._id && !selected?.id) throw new Error('Select a harvest before generating a decision.');
        const harvestId = selected._id || selected.id;
        let response;
        try {
          response = await getLatestRecommendation(harvestId);
        } catch (latestError) {
          if (latestError.response?.status !== 404) throw latestError;
          response = await generateRecommendation(harvestId);
        }
        if (mounted) {
          setHarvest(selected);
          setRecommendation(response.data);
        }
      } catch (apiError) {
        if (mounted) setError(apiError.response?.data?.message || apiError.message || 'Unable to load the market decision.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [location.state]);

  const decision = recommendation?.decision || 'INSUFFICIENT_DATA';
  const markets = recommendation?.markets || [];

  return (
    <DashboardLayout farmer={farmer} pageTitle="Market Decision" onLogout={onLogout}>
      <div className="page-content">
        <h1 className="page-title">Market Decision</h1>
        <p className="page-subtitle">A transparent decision from your harvest, prediction, and available market data.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? <div className="empty-state"><span className="spinner" /><p>Loading decision...</p></div> : !recommendation ? null : (
          <>
            <div className="card rec-harvest-summary">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <FaSeedling style={{ color: 'var(--primary)', fontSize: '1.4rem' }} />
                <strong>{harvest?.crop} | {harvest?.quantity} {harvest?.unit || 'kg'}</strong>
                <RiskBadge risk={recommendation.risk?.level || 'Unknown'} />
                <span style={{ marginLeft: 'auto' }}>Shelf life: {displayValue(recommendation.shelfLife?.remainingDays, (value) => `${value} days`)}</span>
              </div>
            </div>

            <div className="rec-main-grid">
              <div className="card">
                <div className="section-title">{decision}</div>
                <p><strong>Status:</strong> {recommendation.status || 'Unavailable'}</p>
                <div style={{ marginTop: 16 }}>
                  <strong>Why this decision</strong>
                  <ul>{(recommendation.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                </div>
              </div>
              <div className="card">
                <div className="section-title">Data quality</div>
                <p>Price fresh: {recommendation.dataQuality?.marketPriceFresh ? 'Yes' : 'No'}</p>
                <p>Transport cost: {recommendation.dataQuality?.transportCostAvailable ? 'Available' : 'Unavailable'}</p>
                <p>Distance: {recommendation.dataQuality?.distanceAvailable ? 'Available' : 'Unavailable'}</p>
                <p>Travel time: {recommendation.dataQuality?.travelTimeAvailable ? 'Available' : 'Unavailable'}</p>
                <p>Confidence: Unavailable</p>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div className="section-header"><div className="section-title">Market factors</div><button className="btn btn-outline btn-sm" onClick={() => navigate('/markets')}>View Markets <FaArrowRight /></button></div>
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>Market</th><th>Price</th><th>Observed</th><th>Fresh</th><th>Distance</th><th>Travel</th><th>Transport</th><th>Gross</th><th>Net</th></tr></thead>
                  <tbody>{markets.map((market) => (
                    <tr key={String(market.marketId)}>
                      <td>{market.marketName}</td>
                      <td>{displayValue(market.price, (value) => `${market.currency || ''} ${value}/${market.unit || ''}`)}</td>
                      <td>{displayValue(market.observedAt, (value) => new Date(value).toLocaleString())}</td>
                      <td>{market.priceFresh ? 'Yes' : 'No'}</td>
                      <td>{displayValue(market.distanceKm, (value) => `${value} km`)}</td>
                      <td>{displayValue(market.travelTimeMinutes, (value) => `${value} min`)}</td>
                      <td>{displayValue(market.transportCost, (value) => formatCurrency(value))}</td>
                      <td>{displayValue(market.grossValue, (value) => formatCurrency(value))}</td>
                      <td>{displayValue(market.netValue, (value) => formatCurrency(value))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
