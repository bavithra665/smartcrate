import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import InputField from '../components/InputField';
import { cropTypes, maturityStages, storageConditions } from '../data/mockData';
import { predictShelfLife } from '../utils/predictionUtils';
import { createHarvest, normalizeHarvest, toHarvestPayload, updateHarvest } from '../api/harvestApi';
import {
  FaSeedling, FaThermometerHalf, FaTint, FaFlask,
  FaCheckCircle, FaChartLine, FaMicrochip, FaWifi,
  FaSyncAlt, FaCalendarAlt, FaClock, FaRobot, FaLock
} from 'react-icons/fa';
import './AddHarvest.css';

// Helper: get today's date as YYYY-MM-DD
const todayDate = () => new Date().toISOString().split('T')[0];
// Helper: get current time as HH:MM
const currentTime = () => new Date().toTimeString().slice(0, 5);

// Mock maturity detection based on ethylene level (future: image AI / sensor model)
const detectMaturity = (ethylene) => {
  if (ethylene > 3.5) return 'Over-Ripe';
  if (ethylene > 2.5) return 'Fully Ripe';
  if (ethylene > 1.5) return 'Semi-Ripe';
  return 'Mature';
};

// Mock storage detection based on temperature (future: storage unit sensor profile)
const detectStorage = (temp) => {
  if (temp < 8) return 'Refrigerated';
  if (temp < 15) return 'Cold Room';
  if (temp < 22) return 'Cool Storage';
  return 'Open Shed';
};

const initialForm = {
  cropType: '', variety: '', quantity: '',
  harvestDate: todayDate(),
  harvestTime: currentTime(),
  maturityStage: '', storageCondition: '',
  temperature: '', humidity: '', ethyleneLevel: '', vocLevel: '',
};

const formFromHarvest = (harvest) => ({
  ...initialForm,
  cropType: harvest.crop || harvest.cropType || '',
  variety: harvest.variety || '',
  quantity: harvest.quantity ?? '',
  harvestDate: typeof harvest.harvestDate === 'string'
    ? harvest.harvestDate.split('T')[0]
    : initialForm.harvestDate,
  harvestTime: harvest.harvestTime || initialForm.harvestTime,
  maturityStage: harvest.maturityStage || '',
  storageCondition: harvest.storageCondition || '',
});

export default function AddHarvest({ farmer, onAddHarvest, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const editingHarvest = location.state?.harvest;
  const [editingId] = useState(editingHarvest?._id || editingHarvest?.id || null);
  const [form, setForm] = useState(() => editingHarvest ? formFromHarvest(editingHarvest) : initialForm);
  const [errors, setErrors] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorFetched, setSensorFetched] = useState(
    Boolean(editingHarvest?.maturityStage && editingHarvest?.storageCondition)
  );
  const [sensorError, setSensorError] = useState('');

  // Auto-refresh date/time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setForm(prev => ({
        ...prev,
        harvestDate: todayDate(),
        harvestTime: currentTime(),
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Future: GET /api/sensor/latest — reads live data from IoT hardware
  // Also auto-detects maturity stage and storage condition from sensor readings
  const handleFetchSensorData = () => {
    setSensorLoading(true);
    setSensorError('');
    setSensorFetched(false);
    setTimeout(() => {
      const temp = parseFloat((26 + Math.random() * 10).toFixed(1));
      const humidity = parseFloat((55 + Math.random() * 25).toFixed(1));
      const ethylene = parseFloat((0.8 + Math.random() * 3).toFixed(2));
      const voc = parseFloat((0.4 + Math.random() * 1.8).toFixed(2));

      setForm(prev => ({
        ...prev,
        temperature: String(temp),
        humidity: String(humidity),
        ethyleneLevel: String(ethylene),
        vocLevel: String(voc),
        maturityStage: detectMaturity(ethylene),
        storageCondition: detectStorage(temp),
      }));
      setSensorFetched(true);
      setSensorLoading(false);
    }, 1800);
  };

  const validate = () => {
    const e = {};
    if (!form.cropType) e.cropType = 'Crop type is required.';
    if (!form.quantity || isNaN(form.quantity) || +form.quantity <= 0) e.quantity = 'Enter a valid quantity.';
    if (!form.harvestDate) e.harvestDate = 'Harvest date is required.';
    if (!editingId) {
      if (!form.maturityStage) e.maturityStage = 'Fetch sensor data to detect maturity.';
      if (!form.storageCondition) e.storageCondition = 'Fetch sensor data to detect storage.';
      if (!form.temperature || isNaN(form.temperature)) e.temperature = 'Fetch sensor data first.';
      if (!form.humidity || isNaN(form.humidity)) e.humidity = 'Fetch sensor data first.';
    }
    return e;
  };

  const handlePredict = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    // Future: POST /api/prediction
    setTimeout(() => {
      const result = predictShelfLife(form);
      setPrediction(result);
      setLoading(false);
    }, 1000);
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!editingId && !prediction) { handlePredict(); return; }
    setLoading(true);
    setErrors({});
    try {
      const response = editingId
        ? await updateHarvest(editingId, toHarvestPayload(form))
        : await createHarvest(toHarvestPayload(form));
      const savedHarvest = normalizeHarvest(response.data);
      const harvestForUi = {
        ...savedHarvest,
        ...form,
        crop: savedHarvest.crop || form.cropType,
        predictedShelfLife: prediction?.shelfLife,
        remainingShelfLife: prediction?.shelfLife,
        spoilageRisk: prediction?.risk,
        recommendation: prediction?.risk === 'High' ? 'Sell Today' : 'Wait for a Better Price',
      };
      onAddHarvest?.(harvestForUi);
      setSaved(true);
      if (editingId) {
        setTimeout(() => navigate('/history'), 900);
      } else {
        setTimeout(() => navigate('/prediction', { state: { harvest: harvestForUi, prediction } }), 1200);
      }
    } catch (apiError) {
      const validationError = apiError.response?.data?.errors?.[0]?.msg;
      setErrors({ api: validationError || apiError.response?.data?.message || 'Unable to save harvest. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout farmer={farmer} pageTitle="Add Harvest" onLogout={onLogout}>
      <div className="page-content">
        <h1 className="page-title">{editingId ? 'Edit Harvest' : 'Add New Harvest'}</h1>
        <p className="page-subtitle">
          Fill in your crop details. Environmental data and conditions are auto-detected from hardware.
        </p>

        {saved && (
          <div className="alert alert-success">
            <FaCheckCircle /> {editingId ? 'Harvest updated successfully! Redirecting...' : 'Harvest saved successfully! Redirecting to prediction...'}
          </div>
        )}
        {errors.api && <div className="alert alert-error">{errors.api}</div>}

        <div className="add-harvest-grid">

          {/* ── Crop Details ── */}
          <div className="card">
            <div className="add-harvest-section-title">
              <FaSeedling /> Crop Details
            </div>

            {/* Manual fields */}
            <div className="auto-section-label">
              <FaSeedling style={{ fontSize: '0.8rem' }} /> Enter manually
            </div>
            <div className="form-row-2">
              <InputField label="Crop Type" name="cropType" type="select"
                value={form.cropType} onChange={handleChange}
                options={cropTypes} error={errors.cropType} required />
              <InputField label="Variety" name="variety" type="text"
                value={form.variety} onChange={handleChange}
                placeholder="e.g. Hybrid, Nendran" />
            </div>
            <InputField label="Quantity (kg)" name="quantity" type="number"
              value={form.quantity} onChange={handleChange}
              placeholder="e.g. 120" error={errors.quantity} required min="1" />

            <hr className="divider" />

            {/* Auto-filled fields */}
            <div className="auto-section-label">
              <FaRobot style={{ fontSize: '0.8rem' }} /> Auto-filled by system
            </div>

            <div className="form-row-2">
              {/* Harvest Date — auto */}
              <div className="auto-field">
                <div className="auto-field-icon"><FaCalendarAlt /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Harvest Date</div>
                  <div className="auto-field-value">{form.harvestDate}</div>
                </div>
                <span className="badge badge-info">Auto</span>
              </div>

              {/* Harvest Time — auto */}
              <div className="auto-field">
                <div className="auto-field-icon"><FaClock /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Harvest Time</div>
                  <div className="auto-field-value">{form.harvestTime}</div>
                </div>
                <span className="badge badge-info">Auto</span>
              </div>

              {/* Maturity Stage — auto from sensor */}
              <div className={`auto-field ${!sensorFetched ? 'auto-field-pending' : ''}`}>
                <div className="auto-field-icon"><FaMicrochip /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Maturity Stage</div>
                  <div className="auto-field-value">
                    {sensorFetched ? form.maturityStage : '—'}
                  </div>
                </div>
                {sensorFetched
                  ? <span className="badge badge-success">Detected</span>
                  : <span className="badge" style={{ background: '#f7fafc', color: '#a0aec0', border: '1px solid #e2e8f0' }}>Pending</span>
                }
                {errors.maturityStage && <div className="form-error" style={{ gridColumn: '1/-1' }}>{errors.maturityStage}</div>}
              </div>

              {/* Storage Condition — auto from sensor */}
              <div className={`auto-field ${!sensorFetched ? 'auto-field-pending' : ''}`}>
                <div className="auto-field-icon"><FaLock /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Storage Condition</div>
                  <div className="auto-field-value">
                    {sensorFetched ? form.storageCondition : '—'}
                  </div>
                </div>
                {sensorFetched
                  ? <span className="badge badge-success">Detected</span>
                  : <span className="badge" style={{ background: '#f7fafc', color: '#a0aec0', border: '1px solid #e2e8f0' }}>Pending</span>
                }
                {errors.storageCondition && <div className="form-error" style={{ gridColumn: '1/-1' }}>{errors.storageCondition}</div>}
              </div>
            </div>

            {!sensorFetched && (
              <div className="auto-pending-note">
                <FaMicrochip /> Maturity and Storage will be auto-detected once you fetch sensor data →
              </div>
            )}
          </div>

          {/* ── Sensor Data ── */}
          <div className="card">
            <div className="add-harvest-section-title">
              <FaMicrochip /> Sensor Data
            </div>

            <div className="sensor-panel">
              <div className="sensor-panel-left">
                <div className="sensor-status-dot"
                  style={{ background: sensorFetched ? 'var(--risk-low)' : '#aaa' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                    {sensorFetched ? 'Sensor Data Received' : 'Hardware Sensor'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                    {sensorFetched
                      ? 'Live readings loaded — maturity & storage auto-detected'
                      : 'Click to fetch live readings from device'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${sensorFetched ? 'btn-outline' : 'btn-primary'}`}
                onClick={handleFetchSensorData}
                disabled={sensorLoading}
              >
                {sensorLoading ? (
                  <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Reading Sensor...</>
                ) : sensorFetched ? (
                  <><FaSyncAlt /> Refresh Data</>
                ) : (
                  <><FaWifi /> Fetch Sensor Data</>
                )}
              </button>
            </div>

            {sensorError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{sensorError}</div>}

            {!sensorFetched && !sensorLoading && (
              <div className="sensor-placeholder">
                <FaMicrochip style={{ fontSize: '2rem', color: 'var(--border)', marginBottom: 8 }} />
                <p>Sensor readings will appear here.</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  Fetching also auto-detects <strong>Maturity Stage</strong> and <strong>Storage Condition</strong>.
                </p>
              </div>
            )}

            {sensorLoading && (
              <div className="sensor-placeholder">
                <span className="spinner" style={{ marginBottom: 10 }} />
                <p style={{ color: 'var(--text-medium)' }}>Connecting to sensor device...</p>
              </div>
            )}

            {sensorFetched && (
              <>
                <div className="form-row-2">
                  <div className="sensor-field">
                    <div className="sensor-field-icon" style={{ background: '#fff5f5', color: 'var(--risk-high)' }}>
                      <FaThermometerHalf />
                    </div>
                    <div className="sensor-field-body">
                      <div className="sensor-field-label">Temperature</div>
                      <div className="sensor-field-value">{form.temperature} °C</div>
                    </div>
                    <span className={`badge ${+form.temperature > 30 ? 'badge-high' : 'badge-low'}`}>
                      {+form.temperature > 35 ? 'Very High' : +form.temperature > 30 ? 'High' : 'Normal'}
                    </span>
                  </div>
                  <div className="sensor-field">
                    <div className="sensor-field-icon" style={{ background: '#ebf8ff', color: '#2b6cb0' }}>
                      <FaTint />
                    </div>
                    <div className="sensor-field-body">
                      <div className="sensor-field-label">Humidity</div>
                      <div className="sensor-field-value">{form.humidity} %</div>
                    </div>
                    <span className={`badge ${+form.humidity > 75 ? 'badge-medium' : 'badge-low'}`}>
                      {+form.humidity > 80 ? 'Very High' : +form.humidity > 70 ? 'High' : 'Normal'}
                    </span>
                  </div>
                  <div className="sensor-field">
                    <div className="sensor-field-icon" style={{ background: '#f0fff4', color: 'var(--risk-low)' }}>
                      <FaFlask />
                    </div>
                    <div className="sensor-field-body">
                      <div className="sensor-field-label">Ethylene Level</div>
                      <div className="sensor-field-value">{form.ethyleneLevel} ppm</div>
                    </div>
                    <span className={`badge ${+form.ethyleneLevel > 3 ? 'badge-high' : +form.ethyleneLevel > 2 ? 'badge-medium' : 'badge-low'}`}>
                      {+form.ethyleneLevel > 3 ? 'High' : +form.ethyleneLevel > 2 ? 'Moderate' : 'Low'}
                    </span>
                  </div>
                  <div className="sensor-field">
                    <div className="sensor-field-icon" style={{ background: '#fffaf0', color: 'var(--risk-medium)' }}>
                      <FaFlask />
                    </div>
                    <div className="sensor-field-body">
                      <div className="sensor-field-label">VOC Level</div>
                      <div className="sensor-field-value">{form.vocLevel} ppm</div>
                    </div>
                    <span className={`badge ${+form.vocLevel > 2 ? 'badge-medium' : 'badge-low'}`}>
                      {+form.vocLevel > 2 ? 'Elevated' : 'Normal'}
                    </span>
                  </div>
                </div>

                {/* What was auto-detected */}
                <div className="sensor-detected-summary">
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-medium)', marginBottom: 8 }}>
                    <FaRobot style={{ marginRight: 6 }} />Also Auto-Detected from Sensor
                  </div>
                  <div className="sensor-detected-row">
                    <span>Maturity Stage</span>
                    <strong>{form.maturityStage}</strong>
                  </div>
                  <div className="sensor-detected-row">
                    <span>Storage Condition</span>
                    <strong>{form.storageCondition}</strong>
                  </div>
                </div>

                <div className="sensor-note">
                  <FaMicrochip /> All values auto-filled from hardware. Click "Refresh Data" to re-read.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div className="card prediction-preview">
            <div className="prediction-preview-header">
              <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.3rem' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-dark)' }}>
                  Prediction Result
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  <span className="demo-badge">Demo Prediction</span>
                </div>
              </div>
            </div>
            <div className="prediction-preview-stats">
              <div className="pred-stat">
                <div className="pred-stat-value" style={{ color: 'var(--primary)' }}>
                  {prediction.shelfLife} Days
                </div>
                <div className="pred-stat-label">Remaining Shelf Life</div>
              </div>
              <div className="pred-stat">
                <div className="pred-stat-value" style={{
                  color: prediction.risk === 'High' ? 'var(--risk-high)' :
                    prediction.risk === 'Medium' ? 'var(--risk-medium)' : 'var(--risk-low)'
                }}>
                  {prediction.risk}
                </div>
                <div className="pred-stat-label">Spoilage Risk</div>
              </div>
              <div className="pred-stat">
                <div className="pred-stat-value" style={{ color: 'var(--primary)' }}>
                  {prediction.confidence}%
                </div>
                <div className="pred-stat-label">Confidence</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="add-harvest-actions">
          <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
            Cancel
          </button>
          <button className="btn btn-outline" onClick={handlePredict} disabled={loading}>
            {loading && !prediction ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Predicting...</>
            ) : (
              <><FaChartLine /> Predict Shelf Life</>
            )}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saved}>
            {loading && prediction ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</>
            ) : (
              <><FaCheckCircle /> Save Harvest</>
            )}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
