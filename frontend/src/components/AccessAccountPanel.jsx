import React, { useState } from 'react';

function ReviewerAccountEditor({ reviewer, updateReviewerAccount }) {
  const [email, setEmail] = useState(reviewer.email);
  const [newPassword, setNewPassword] = useState('');
  const [accountStatus, setAccountStatus] = useState(reviewer.accountStatus);

  const submit = async (event) => {
    event.preventDefault();
    const success = await updateReviewerAccount(reviewer.id, { email, newPassword: newPassword || undefined, accountStatus });
    if (success) setNewPassword('');
  };

  return (
    <form className="profile-card form-grid" onSubmit={submit}>
      <div className="profile-info">
        <h3>{reviewer.role}</h3>
        <span className={`badge ${reviewer.accountStatus === 'Active' ? 'success' : 'pending'}`}>{reviewer.accountStatus}</span>
      </div>
      <div className="field">
        <label htmlFor={`reviewer-email-${reviewer.id}`}>Email</label>
        <input id={`reviewer-email-${reviewer.id}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor={`reviewer-password-${reviewer.id}`}>Reset password</label>
        <input id={`reviewer-password-${reviewer.id}`} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Leave blank to keep current password" minLength={8} />
      </div>
      <div className="field">
        <label htmlFor={`reviewer-status-${reviewer.id}`}>Account status</label>
        <select id={`reviewer-status-${reviewer.id}`} value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>
      <button type="submit">Save reviewer account</button>
    </form>
  );
}

function AccessAccountPanel({ currentHospital, loginForm, setLoginForm, handleReviewerLogin, handleLogout, reviewerAccounts = [], updateReviewerAccount, changeOwnPassword }) {
  const isReviewer = ['Doctor', 'Pharmacist'].includes(currentHospital?.role);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [showReviewerPassword, setShowReviewerPassword] = useState(false);

  const submitOwnPassword = async (event) => {
    event.preventDefault();
    const success = await changeOwnPassword(passwordForm);
    if (success) setPasswordForm({ currentPassword: '', newPassword: '' });
  };

  return (
    <section id="access-account" className="panel admin-focus-card professional-panel">
      <div className="panel-header">
        <div>
          <h2 id="access-account-heading">{isReviewer ? 'Reviewer session' : 'Reviewer workspace access'}</h2>
          <p className="subhead">{isReviewer ? 'You are reviewing requests for your assigned hospital.' : 'Only doctors and pharmacists assigned to this hospital can enter this review workspace.'}</p>
        </div>
        <span className="badge">{currentHospital ? 'Reviewer' : 'Secure'}</span>
      </div>

      <div className="stack">
        {currentHospital ? (
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
        ) : null}

        {!isReviewer ? <form onSubmit={handleReviewerLogin} className="form-grid">
          <div className="field">
            <label htmlFor="access-email">Reviewer email</label>
            <div className="field-with-icon">
              <span className="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </span>
              <input id="access-email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="Pharmacist or doctor email" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="access-password">Password</label>
            <div className="field-with-icon">
              <span className="field-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <input id="access-password" type={showReviewerPassword ? 'text' : 'password'} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" required />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowReviewerPassword((visible) => !visible)}
                aria-label={showReviewerPassword ? 'Hide reviewer password' : 'Show reviewer password'}
              >
                {showReviewerPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit">Enter reviewer workspace</button>
        </form> : null}

        {!isReviewer && reviewerAccounts.length ? (
          <div className="stack">
            <div>
              <h3>Manage hospital reviewers</h3>
              <p className="subhead">Update email addresses, reset passwords, or suspend access. Existing passwords are never displayed.</p>
            </div>
            {reviewerAccounts.map((reviewer) => (
              <ReviewerAccountEditor key={reviewer.id} reviewer={reviewer} updateReviewerAccount={updateReviewerAccount} />
            ))}
          </div>
        ) : null}

        {currentHospital ? (
          <form className="form-grid profile-card" onSubmit={submitOwnPassword}>
            <div className="profile-info">
              <h3>Change account password</h3>
              <p className="subhead">Confirm your current password before choosing a new one.</p>
            </div>
            <div className="field">
              <label htmlFor="current-reviewer-password">Current password</label>
              <input id="current-reviewer-password" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="new-reviewer-password">New password</label>
              <input id="new-reviewer-password" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} minLength={8} required />
            </div>
            <button type="submit">Change password</button>
          </form>
        ) : null}

        {isReviewer ? (
          <button className="secondary" onClick={handleLogout} style={{ justifySelf: 'start' }}>⏻ Sign out</button>
        ) : null}
      </div>
    </section>
  );
}

export default AccessAccountPanel;
