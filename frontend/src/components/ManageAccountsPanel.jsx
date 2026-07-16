import React, { useState } from 'react';

function ManageAccountsPanel({ hospitals, currentHospital, deleteHospital, reviewerAccounts = [], updateReviewerAccount }) {
  const [resetPasswords, setResetPasswords] = useState({});

  const applyReviewerControl = async (reviewer, accountStatus) => {
    const newPassword = resetPasswords[reviewer.id] || undefined;
    const success = await updateReviewerAccount(reviewer.id, { accountStatus, newPassword });
    if (success) setResetPasswords((passwords) => ({ ...passwords, [reviewer.id]: '' }));
  };

  return (
    <section id="admin-manage-accounts" className="panel admin-focus-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">● Account management</span>
          <h2>Manage hospital accounts</h2>
        </div>
        <span className="badge">Admin controls</span>
      </div>

      <div className="stack">
        {hospitals.length ? hospitals.map((hospital) => (
          <div key={hospital.id} className="list-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem', flexShrink: 0 }}>
                {hospital.name?.charAt(0) || 'H'}
              </div>
              <div>
                <strong>{hospital.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {hospital.location} · {hospital.type} · {hospital.accountStatus}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {hospital.email}
                </div>
              </div>
            </div>
            {hospital.role !== 'Admin' ? (
              <button className="action-reject" onClick={() => deleteHospital(hospital.id)}>
                {hospital.id === currentHospital?.id ? 'Delete your account' : 'Delete'}
              </button>
            ) : null}
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">🏥</div>
            No hospital accounts available.
          </div>
        )}
      </div>

      <div className="section-header" style={{ marginTop: 24 }}>
        <div>
          <span className="eyebrow">Reviewer security</span>
          <h2>Doctor and pharmacist accounts</h2>
          <p className="subhead">Suspend access or force a password reset. Existing passwords are never visible.</p>
        </div>
      </div>
      <div className="stack">
        {reviewerAccounts.map((reviewer) => (
          <div key={reviewer.id} className="list-item">
            <div>
              <strong>{reviewer.hospitalName} · {reviewer.role}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{reviewer.email}</div>
              <span className={`badge ${reviewer.accountStatus === 'Active' ? 'success' : 'pending'}`}>{reviewer.accountStatus}</span>
            </div>
            <div className="form-grid" style={{ minWidth: 280 }}>
              <input
                type="password"
                value={resetPasswords[reviewer.id] || ''}
                onChange={(event) => setResetPasswords((passwords) => ({ ...passwords, [reviewer.id]: event.target.value }))}
                placeholder="Optional forced reset password"
                minLength={8}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => applyReviewerControl(reviewer, 'Active')}>Activate / reset</button>
                <button type="button" className="action-reject" onClick={() => applyReviewerControl(reviewer, 'Suspended')}>Suspend</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ManageAccountsPanel;
