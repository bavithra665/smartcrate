import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaLeaf, FaSeedling, FaChartLine, FaStore, FaLightbulb,
  FaMobileAlt, FaCloudSun, FaRupeeSign, FaArrowRight
} from 'react-icons/fa';
import './Landing.css';

const steps = [
  { icon: <FaSeedling />, title: 'Add Harvest', desc: 'Enter your crop details, quantity, and harvest date.' },
  { icon: <FaChartLine />, title: 'Receive Sensor Readings', desc: 'Registered devices submit timestamped readings through the backend.' },
  { icon: <FaStore />, title: 'Review Market Data', desc: 'Compare configured market prices, freshness, and available logistics.' },
  { icon: <FaLightbulb />, title: 'Review the Decision', desc: 'See a deterministic action only when trusted inputs are available.' },
];

const features = [
  { icon: <FaChartLine />, title: 'Spoilage-Risk Assessment', desc: 'An exploratory classifier reports risk from available sensor features.' },
  { icon: <FaStore />, title: 'Market Data Comparison', desc: 'Review source-labeled prices; development samples are not live market data.' },
  { icon: <FaLightbulb />, title: 'Smart Recommendations', desc: 'Get clear, actionable selling decisions tailored to your crop.' },
  { icon: <FaCloudSun />, title: 'Environmental Monitoring', desc: 'Store timestamped sensor readings linked to a harvest batch.' },
  { icon: <FaRupeeSign />, title: 'Profit Optimization', desc: 'Calculate net value after transport costs for each market.' },
  { icon: <FaMobileAlt />, title: 'Mobile Friendly', desc: 'Access SmartCrate from any device, anywhere in the field.' },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="landing-nav-icon"><FaLeaf /></div>
          <span>SmartCrate</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <FaLeaf /> Intelligent AgriTech Platform
          </div>
          <h1 className="landing-hero-title">
            Assess Crop Risk.<br />Compare Market Data.<br />
            <span>Make the Right Decision.</span>
          </h1>
          <p className="landing-hero-desc">
            SmartCrate connects harvest records, timestamped sensor readings, spoilage-risk assessment,
            and source-labeled market data. Shelf-life regression remains unavailable until sufficient
            real longitudinal data has been collected.
          </p>
          <div className="landing-hero-btns">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Get Started Free <FaArrowRight />
            </button>
          </div>
          <div className="landing-hero-stats">
            <div className="hero-stat"><span>ESP32</span><p>Sensor ingestion</p></div>
            <div className="hero-stat"><span>Risk</span><p>Spoilage classification</p></div>
            <div className="hero-stat"><span>Source</span><p>Market data provenance</p></div>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="hero-card-demo">
            <div className="hero-card-header"><FaSeedling /> SmartCrate status</div>
            <div className="hero-card-row"><span>Spoilage-risk model</span><strong>Exploratory baseline</strong></div>
            <div className="hero-card-row"><span>Shelf-life model</span><strong>Data collection in progress</strong></div>
            <div className="hero-card-row"><span>Development market prices</span><strong>Sample only</strong></div>
            <div className="hero-card-rec">
              <FaLightbulb /> Decisions require trusted inputs
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" id="how">
        <div className="landing-section-inner">
          <div className="landing-section-label">Simple Process</div>
          <h2 className="landing-section-title">How SmartCrate Works</h2>
          <p className="landing-section-desc">Four simple steps to make the best selling decision for your harvest.</p>
          <div className="landing-steps">
            {steps.map((s, i) => (
              <div className="landing-step" key={i}>
                <div className="step-number">{i + 1}</div>
                <div className="step-icon">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section landing-section-alt" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-label">Key Features</div>
          <h2 className="landing-section-title">Everything You Need</h2>
          <p className="landing-section-desc">SmartCrate gives farmers the tools to make informed decisions about their produce.</p>
          <div className="landing-features">
            {features.map((f, i) => (
              <div className="landing-feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <h2>Ready to Maximize Your Harvest Income?</h2>
          <p>Connect a harvest to real sensor readings and review the available decision evidence.</p>
          <button className="btn btn-accent btn-lg" onClick={() => navigate('/login')}>
            Start Using SmartCrate <FaArrowRight />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-logo">
            <div className="landing-nav-icon"><FaLeaf /></div>
            <div>
              <div style={{ fontWeight: 800, color: 'white' }}>SmartCrate</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Intelligent Crop Management</div>
            </div>
          </div>
          <div className="landing-footer-links">
            <a href="#features">Features</a>
            <a href="#how">How It Works</a>
          </div>
          <div className="landing-footer-copy">
            © 2026 SmartCrate. Built for smallholder farmers.
          </div>
        </div>
      </footer>
    </div>
  );
}
