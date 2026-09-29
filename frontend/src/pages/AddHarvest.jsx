import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import InputField from '../components/InputField';
import { cropTypes, maturityStages, storageConditions } from '../data/harvestOptions';
import { createHarvest, normalizeHarvest, toHarvestPayload, updateHarvest } from '../api/harvestApi';
import {
  FaSeedling, FaCheckCircle, FaMicrochip, FaCalendarAlt, FaClock
} from 'react-icons/fa';
import './AddHarvest.css';

// Helper: get today's date as YYYY-MM-DD
const todayDate = () => new Date().toISOString().split('T')[0];
// Helper: get current time as HH:MM
const currentTime = () => new Date().toTimeString().slice(0, 5);

const initialForm = {
  cropType: '', variety: '', quantity: '',
  harvestDate: todayDate(),
  harvestTime: currentTime(),
  maturityStage: '', storageCondition: '',
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

export default function AddHarvest({ farmer, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const editingHarvest = location.state?.harvest;
  const [editingId] = useState(editingHarvest?._id || editingHarvest?.id || null);
  const [form, setForm] = useState(() => editingHarvest ? formFromHarvest(editingHarvest) : initialForm);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.cropType) e.cropType = 'Crop type is required.';
    if (!form.quantity || isNaN(form.quantity) || +form.quantity <= 0) e.quantity = 'Enter a valid quantity.';
    if (!form.harvestDate) e.harvestDate = 'Harvest date is required.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
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
      };
      setSaved(true);
      if (editingId) {
        setTimeout(() => navigate('/history'), 900);
      } else {
        setTimeout(() => navigate('/prediction', { state: { harvest: harvestForUi } }), 1200);
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
          Enter batch details. Sensor readings are submitted separately by an authenticated ESP32 device or the development simulator.
        </p>

        {saved && (
          <div className="alert alert-success">
            <FaCheckCircle /> {editingId ? 'Harvest updated successfully! Redirecting...' : 'Harvest saved successfully! A spoilage-risk prediction will be generated after a sensor reading is received.'}
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

            {/* Harvest metadata */}
            <div className="auto-section-label">
              <FaCalendarAlt style={{ fontSize: '0.8rem' }} /> Harvest metadata
            </div>

            <div className="form-row-2">
              {/* Harvest Date */}
              <div className="auto-field">
                <div className="auto-field-icon"><FaCalendarAlt /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Harvest Date</div>
                  <div className="auto-field-value">{form.harvestDate}</div>
                </div>
                <span className="badge badge-info">Required</span>
              </div>

              {/* Harvest Time */}
              <div className="auto-field">
                <div className="auto-field-icon"><FaClock /></div>
                <div className="auto-field-body">
                  <div className="auto-field-label">Harvest Time</div>
                  <div className="auto-field-value">{form.harvestTime}</div>
                </div>
                <span className="badge badge-info">Local time</span>
              </div>

              <InputField label="Maturity Stage" name="maturityStage" type="select"
                value={form.maturityStage} onChange={handleChange}
                options={maturityStages} />
              <InputField label="Storage Condition" name="storageCondition" type="select"
                value={form.storageCondition} onChange={handleChange}
                options={storageConditions} />
            </div>
          </div>

          {/* ── Sensor Data ── */}
          <div className="card">
            <div className="add-harvest-section-title">
              <FaMicrochip /> Sensor Data
            </div>
            <div className="sensor-placeholder">
              <FaMicrochip style={{ fontSize: '2rem', color: 'var(--border)', marginBottom: 8 }} />
              <p>No sensor reading is attached to this harvest yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Registered ESP32 devices and the explicitly labeled development simulator submit readings through the backend sensor API.
              </p>
            </div>
          </div>
        </div>

        <div className="alert alert-info"><FaMicrochip /> A spoilage-risk prediction is generated after a valid sensor reading is received.</div>

        {/* Action Buttons */}
        <div className="add-harvest-actions">
          <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saved}>
            {loading ? (
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
