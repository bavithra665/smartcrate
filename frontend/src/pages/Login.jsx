import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaLeaf, FaMobileAlt, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import { registerFarmer, sendOtp, verifyOtp } from '../api/authApi';
import './Login.css';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const [registration, setRegistration] = useState({ name: '', location: '', preferredLanguage: 'English' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getApiError = (apiError, fallback) => apiError.response?.data?.message || fallback;

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    if (!/^\d{10}$/.test(mobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const response = await sendOtp(mobile);
      setOtpSent(true);
      setSuccess(response.data.message || `OTP sent to +91 ${mobile}.`);
    } catch (apiError) {
      setError(getApiError(apiError, 'Unable to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!otp) { setError('Please enter the OTP.'); return; }
    if (!/^\d{4,6}$/.test(otp)) { setError('Please enter a valid OTP.'); return; }
    setLoading(true);
    try {
      const response = await verifyOtp(mobile, otp);
      onLogin?.(response.data);
      navigate('/dashboard');
    } catch (apiError) {
      if (apiError.response?.status === 404 && apiError.response.data?.needsRegistration) {
        setRegistrationRequired(true);
        setSuccess('Your mobile number is verified. Complete your profile to continue.');
      } else {
        setError(getApiError(apiError, 'Invalid OTP or unable to sign in.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationChange = (event) => {
    const { name, value } = event.target;
    setRegistration((previous) => ({ ...previous, [name]: value }));
  };

  const handleRegister = async () => {
    setError('');
    if (!registration.name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const response = await registerFarmer({ mobile, otp, ...registration });
      onLogin?.(response.data);
      navigate('/dashboard');
    } catch (apiError) {
      setError(getApiError(apiError, 'Unable to complete registration. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand">
            <div className="login-brand-icon"><FaLeaf /></div>
            <span>SmartCrate</span>
          </div>
          <h2 className="login-left-title">
            Helping Farmers Make Smarter Decisions
          </h2>
          <p className="login-left-desc">
            Predict shelf life, compare market prices, and get the best selling recommendation for your harvest.
          </p>
          <div className="login-features">
            <div className="login-feature"><FaShieldAlt /> Secure & Private</div>
            <div className="login-feature"><FaMobileAlt /> Mobile OTP Login</div>
            <div className="login-feature"><FaLeaf /> Farmer Friendly</div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <button className="login-back" onClick={() => navigate('/')}>
            <FaArrowLeft /> Back to Home
          </button>

          <div className="login-card-header">
            <div className="login-card-icon"><FaMobileAlt /></div>
            <h2>Farmer Login</h2>
            <p>{registrationRequired ? 'Complete your farmer profile' : 'Enter your mobile number to receive an OTP'}</p>
          </div>

          {success && (
            <div className="alert alert-success">{success}</div>
          )}
          {error && (
            <div className="alert alert-error">{error}</div>
          )}

          <div className="form-group">
            <label className="form-label">Mobile Number *</label>
            <div className="login-mobile-input">
              <span className="login-prefix">+91</span>
              <input
                type="tel"
                className="form-input"
                placeholder="Enter 10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={otpSent}
                maxLength={10}
              />
            </div>
          </div>

          {registrationRequired ? (
            <>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={registration.name}
                  onChange={handleRegistrationChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  name="location"
                  className="form-input"
                  placeholder="e.g. Erode, Tamil Nadu"
                  value={registration.location}
                  onChange={handleRegistrationChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Language</label>
                <select
                  name="preferredLanguage"
                  className="form-input"
                  value={registration.preferredLanguage}
                  onChange={handleRegistrationChange}
                  disabled={loading}
                >
                  {['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Hindi', 'English'].map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Create Account'}
              </button>
            </>
          ) : !otpSent ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Send OTP'}
            </button>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Enter OTP *</label>
                <input
                  type="text"
                  className="form-input login-otp-input"
                  placeholder="Enter 4-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginBottom: 10 }}
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Verify OTP & Login'}
              </button>
              <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setOtpSent(false); setRegistrationRequired(false); setOtp(''); setSuccess(''); setError(''); }}
              >
                Change Mobile Number
              </button>
            </>
          )}

          <div className="login-demo-note">
            <span className="demo-badge">Secure Login</span>
            We will send a one-time password to your mobile number.
          </div>
        </div>
      </div>
    </div>
  );
}
