import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

function LandingPage({ loginForm, setLoginForm, handleLogin, registerForm, setRegisterForm, registerHospital, generatedReviewerCredentials, feedback }) {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="auth-page">
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-brand-badge">
            <span className="dot" />
            Connected hospital network
          </div>
          <h1>Hospital Resource Management & Coordination System</h1>
          <p>Publish supply availability, request critical resources across the network, and monitor every transfer from one secure command center.</p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">⬢</div>
              <div className="auth-feature-text">
                <strong>Network availability</strong>
                <span>Browse real-time supply availability across hospitals</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">⤴</div>
              <div className="auth-feature-text">
                <strong>Resource requests</strong>
                <span>Request and transfer critical resources between facilities</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">◌</div>
              <div className="auth-feature-text">
                <strong>AI recommendations</strong>
                <span>Smart matching for the best provider hospitals</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">▣</div>
              <div className="auth-feature-text">
                <strong>Admin oversight</strong>
                <span>Full control over approvals, transfers, and accounts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{activeTab === 'login' ? 'Welcome back' : 'Register hospital'}</h2>
            <p>{activeTab === 'login' ? 'Sign in to your hospital workspace' : 'Create a new hospital account'}</p>
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveTab('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => setActiveTab('register')}
              >
                Register
              </button>
              <div className={`auth-tab-indicator ${activeTab === 'register' ? 'register' : ''}`} />
            </div>
          </div>

          <div className="auth-card-body">
            {feedback.message ? (
              <div className={`auth-feedback ${feedback.type}`}>{feedback.message}</div>
            ) : null}

            {activeTab === 'login' ? (
              <LoginForm loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} />
            ) : (
              <RegisterForm
                registerForm={registerForm}
                setRegisterForm={setRegisterForm}
                registerHospital={registerHospital}
                generatedReviewerCredentials={generatedReviewerCredentials}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
