import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RiskBadge from '../components/RiskBadge';
import { getHarvests } from '../api/harvestApi';
import { generateRecommendation, getLatestRecommendation } from '../api/recommendationApi';
import { submitFeedback } from '../api/feedbackApi';
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
  const [feedbackForm, setFeedbackForm] = useState({
    actualSaleStatus: 'Not Reported',
    actualSellingPrice: '',
    soldQuantity: '',
    spoiledQuantity: '',
    actualSpoilageOutcome: 'Not Reported',
    actualQuality: 'Not Reported',
    recommendationHelpful: true,
    recommendationFollowed: true,
    predictionAccurate: true,
    actualMarket: '',
    comments: '',
    observedAt: '',
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

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

  const handleFeedbackChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFeedbackForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!harvest?._id && !harvest?.id) return;
    setFeedbackSubmitting(true);
    setError('');
    setFeedbackMessage('');

    try {
      const payload = {
        harvestId: harvest._id || harvest.id,
        predictionId: recommendation?.predictionId || undefined,
        recommendationId: recommendation?._id || recommendation?.id || undefined,
        ...feedbackForm,
        actualSellingPrice: feedbackForm.actualSellingPrice === '' ? undefined : Number(feedbackForm.actualSellingPrice),
        soldQuantity: feedbackForm.soldQuantity === '' ? undefined : Number(feedbackForm.soldQuantity),
        spoiledQuantity: feedbackForm.spoiledQuantity === '' ? undefined : Number(feedbackForm.spoiledQuantity),
        recommendationHelpful: feedbackForm.recommendationHelpful,
        recommendationFollowed: feedbackForm.recommendationFollowed,
        predictionAccurate: feedbackForm.predictionAccurate,
      };

      await submitFeedback(payload);
      setFeedbackMessage('Outcome report saved successfully.');
      setFeedbackForm((prev) => ({ ...prev, actualSellingPrice: '', soldQuantity: '', spoiledQuantity: '', actualMarket: '', comments: '', observedAt: '' }));
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to save the outcome report.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

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

            <div style={{ marginTop: 28 }}>
              <div className="section-title">Actual outcome tracking</div>
              <div className="card">
                <p style={{ marginTop: 0, color: 'var(--text-light)' }}>Enter the real result after the recommendation was applied. These fields are stored as farmer-reported facts and never overwrite the prediction model.</p>
                {feedbackMessage && <div className="alert alert-success">{feedbackMessage}</div>}
                <form onSubmit={handleFeedbackSubmit}>
                  <div className="feedback-form-grid">
                    <div className="form-group">
                      <label htmlFor="actualSaleStatus">Sale status</label>
                      <select id="actualSaleStatus" name="actualSaleStatus" value={feedbackForm.actualSaleStatus} onChange={handleFeedbackChange}>
                        <option value="Not Reported">Not Reported</option>
                        <option value="Sold">Sold</option>
                        <option value="Not Sold">Not Sold</option>
                        <option value="Spoiled">Spoiled</option>
                        <option value="Stored">Stored</option>
                        <option value="Discarded">Discarded</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="actualSellingPrice">Actual selling price</label>
                      <input id="actualSellingPrice" name="actualSellingPrice" type="number" min="0" step="0.01" value={feedbackForm.actualSellingPrice} onChange={handleFeedbackChange} placeholder="e.g. 28" />
                    </div>

                    <div className="form-group">
                      <label htmlFor="soldQuantity">Sold quantity</label>
                      <input id="soldQuantity" name="soldQuantity" type="number" min="0" step="0.01" value={feedbackForm.soldQuantity} onChange={handleFeedbackChange} placeholder="kg" />
                    </div>

                    <div className="form-group">
                      <label htmlFor="spoiledQuantity">Spoiled quantity</label>
                      <input id="spoiledQuantity" name="spoiledQuantity" type="number" min="0" step="0.01" value={feedbackForm.spoiledQuantity} onChange={handleFeedbackChange} placeholder="kg" />
                    </div>

                    <div className="form-group">
                      <label htmlFor="actualMarket">Actual market</label>
                      <input id="actualMarket" name="actualMarket" type="text" value={feedbackForm.actualMarket} onChange={handleFeedbackChange} placeholder="Market name" />
                    </div>

                    <div className="form-group">
                      <label htmlFor="actualSpoilageOutcome">Actual spoilage outcome</label>
                      <select id="actualSpoilageOutcome" name="actualSpoilageOutcome" value={feedbackForm.actualSpoilageOutcome} onChange={handleFeedbackChange}>
                        <option value="Not Reported">Not Reported</option>
                        <option value="No Spoilage">No Spoilage</option>
                        <option value="Partial Spoilage">Partial Spoilage</option>
                        <option value="Full Spoilage">Full Spoilage</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="actualQuality">Observed quality</label>
                      <select id="actualQuality" name="actualQuality" value={feedbackForm.actualQuality} onChange={handleFeedbackChange}>
                        <option value="Not Reported">Not Reported</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Poor">Poor</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="observedAt">Observed date</label>
                      <input id="observedAt" name="observedAt" type="datetime-local" value={feedbackForm.observedAt} onChange={handleFeedbackChange} />
                    </div>
                  </div>

                  <div className="feedback-status-row" style={{ marginTop: 18 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" name="recommendationHelpful" checked={feedbackForm.recommendationHelpful} onChange={handleFeedbackChange} />
                      Recommendation helpful
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" name="recommendationFollowed" checked={feedbackForm.recommendationFollowed} onChange={handleFeedbackChange} />
                      Followed recommendation
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" name="predictionAccurate" checked={feedbackForm.predictionAccurate} onChange={handleFeedbackChange} />
                      Prediction matched outcomes
                    </label>
                  </div>

                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label htmlFor="comments">Farmer notes</label>
                    <textarea id="comments" name="comments" value={feedbackForm.comments} onChange={handleFeedbackChange} placeholder="Share what happened after the recommendation and market decision." />
                  </div>

                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={feedbackSubmitting}>
                      {feedbackSubmitting ? 'Saving...' : 'Save outcome report'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
