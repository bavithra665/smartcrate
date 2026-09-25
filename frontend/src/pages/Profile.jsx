import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import InputField from '../components/InputField';
import { getFarmerProfile, updateFarmerProfile } from '../api/farmerApi';
import { FaUser, FaEdit, FaCheckCircle } from 'react-icons/fa';

const languages = ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Hindi', 'English'];

export default function Profile({ farmer, onUpdateFarmer, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(farmer || {});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const onUpdateFarmerRef = useRef(onUpdateFarmer);

  const getApiError = (apiError, fallback) => {
    const validationError = apiError.response?.data?.errors?.[0]?.msg;
    return validationError || apiError.response?.data?.message || fallback;
  };

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setError('');
      try {
        const response = await getFarmerProfile();
        if (mounted) {
          setForm(response.data);
          onUpdateFarmerRef.current?.(response.data);
        }
      } catch (apiError) {
        if (mounted) setError(getApiError(apiError, 'Unable to load your profile. Please try again.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name?.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      const response = await updateFarmerProfile({
        name: form.name.trim(),
        location: form.location || '',
        preferredLanguage: form.preferredLanguage || '',
      });
      setForm(response.data);
      onUpdateFarmerRef.current?.(response.data);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (apiError) {
      setError(getApiError(apiError, 'Unable to update your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setForm(farmer || form);
  };

  return (
    <DashboardLayout farmer={form} pageTitle="My Profile" onLogout={onLogout}>
      <div className="page-content">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">View and update your farmer profile information.</p>

        {saved && (
          <div className="alert alert-success">
            <FaCheckCircle /> Profile updated successfully!
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="alert alert-info">Loading your profile...</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
          {/* Avatar card */}
          <div className="card" style={{ textAlign: 'center', alignSelf: 'start' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--accent)', color: '#7a4f00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800, margin: '0 auto 14px'
            }}>
              {form.name?.charAt(0) || 'F'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-dark)', marginBottom: 4 }}>
              {form.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 4 }}>
              {form.mobile}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 16 }}>
              {form.location}
            </div>
            <span className="badge badge-success">Active Farmer</span>
            <hr className="divider" />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              Member since {form.joinedDate || '2024'}
            </div>
          </div>

          {/* Form */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div className="section-title">
                <FaUser style={{ marginRight: 8 }} />Personal Information
              </div>
              {!editing ? (
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                  <FaEdit /> Edit Profile
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <FaCheckCircle />} {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <InputField label="Full Name" name="name" value={form.name}
                onChange={handleChange} disabled={!editing} required />
              <InputField label="Mobile Number" name="mobile" value={form.mobile}
                onChange={handleChange} disabled={true} />
              <InputField label="Location / Village" name="location" value={form.location}
                onChange={handleChange} disabled={!editing} placeholder="e.g. Erode, Tamil Nadu" />
              <InputField label="Preferred Language" name="preferredLanguage" type="select"
                value={form.preferredLanguage} onChange={handleChange}
                options={languages} disabled={!editing} />
            </div>

            {!editing && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-medium)' }}>
                Click "Edit Profile" to update your information.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
