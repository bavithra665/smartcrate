import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RiskBadge from '../components/RiskBadge';
import { deleteHarvest, getHarvests, normalizeHarvest } from '../api/harvestApi';
import { formatCurrency } from '../utils/predictionUtils';
import { FaEdit, FaHistory, FaSearch, FaTrash } from 'react-icons/fa';

export default function History({ farmer, onLogout }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadHarvests = async () => {
      try {
        const response = await getHarvests();
        if (mounted) setHarvests(response.data.map(normalizeHarvest));
      } catch (apiError) {
        if (mounted) setError(apiError.response?.data?.message || 'Unable to load harvest history.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHarvests();
    return () => { mounted = false; };
  }, []);

  const handleDelete = async (harvest) => {
    if (!window.confirm(`Delete the ${harvest.crop} harvest?`)) return;

    setDeletingId(harvest.id);
    setError('');
    try {
      await deleteHarvest(harvest.id);
      setHarvests((previous) => previous.filter((item) => item.id !== harvest.id));
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to delete harvest.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = harvests.filter(h =>
    h.crop.toLowerCase().includes(search.toLowerCase()) ||
    (h.marketSold || '').toLowerCase().includes(search.toLowerCase())
  );
  const soldHarvests = harvests.filter((harvest) => harvest.status === 'Sold');

  return (
    <DashboardLayout farmer={farmer} pageTitle="Harvest History" onLogout={onLogout}>
      <div className="page-content">
        <h1 className="page-title">Harvest History</h1>
        <p className="page-subtitle">View all your past harvest batches and selling records.</p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
          <div style={{ position: 'relative', maxWidth: 360 }}>
            <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by crop or market..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><span className="spinner" /><p>Loading harvest history...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FaHistory />
            <p>No harvest history found.</p>
          </div>
        ) : (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>Quantity</th>
                  <th>Harvest Date</th>
                  <th>Shelf Life</th>
                  <th>Risk</th>
                  <th>Market Sold</th>
                  <th>Price/kg</th>
                  <th>Total Earned</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.crop}</td>
                    <td>{h.quantity} kg</td>
                    <td>{h.harvestDate}</td>
                    <td>{h.predictedShelfLife ? `${h.predictedShelfLife} days` : '--'}</td>
                    <td>{h.spoilageRisk ? <RiskBadge risk={h.spoilageRisk} /> : <span className="badge badge-info">Pending</span>}</td>
                    <td>{h.marketSold || '--'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{h.sellingPrice ? `₹${h.sellingPrice}` : '--'}</td>
                    <td style={{ fontWeight: 700 }}>{h.totalEarned ? formatCurrency(h.totalEarned) : '--'}</td>
                    <td>
                      <span className="badge badge-success">{h.status || 'Active'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('/add-harvest', { state: { harvest: h } })} title="Edit harvest">
                          <FaEdit />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h)} disabled={deletingId === h.id} title="Delete harvest">
                          {deletingId === h.id ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <FaTrash />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
              {soldHarvests.length}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Total Batches Sold</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
              {soldHarvests.reduce((s, h) => s + h.quantity, 0)} kg
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Total Quantity Sold</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatCurrency(soldHarvests.reduce((s, h) => s + (h.totalEarned || 0), 0))}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Total Earnings</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
