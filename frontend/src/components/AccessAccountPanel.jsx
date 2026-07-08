import React from 'react';

function AccessAccountPanel({ currentHospital, loginForm, setLoginForm, handleLogin, handleLogout }) {
  return (
    <section id="access-account" className="panel admin-focus-card professional-panel">
      <div className="panel-header">
        <div>
          <h2 id="access-account-heading">{currentHospital ? 'Your account' : 'Access your hospital account'}</h2>
          <p className="subhead">{currentHospital ? 'View your account details and manage your session.' : 'Manage authentication securely and keep your team workspace connected.'}</p>
        </div>
        <span className="badge">{currentHospital ? 'Active' : 'Secure'}</span>
      </div>
      {currentHospital ? (
        <div className="stack">
          <div className="profile-card">
            <div className="profile-avatar">{currentHospital.name?.charAt(0) || 'H'}</div>
            <div className="profile-info">
              <h3>{currentHospital.name}</h3>
              <div className="profile-meta">
                <span className="sidebar-role-pill">{currentHospital.role || 'Hospital'}</span>
                {currentHospital.location && <span>📍 {currentHospital.location}</span>}
                <span className="badge success">Active</span>
              </div>
            </div>
          </div>
          <button className="secondary" onClick={handleLogout} style={{ justifySelf: 'start' }}>⏻ Sign out</button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="form-grid">
          <div className="field">
            <label htmlFor="access-email">Email</label>
            <div className="field-with-icon">
              <span className="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </span>
              <input id="access-email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="Hospital email" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="access-password">Password</label>
            <div className="field-with-icon">
              <span className="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <input id="access-password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" required />
            </div>
          </div>
          <button type="submit">Sign in</button>
        </form>
      )}
    </section>
  );
}

export default AccessAccountPanel;
