import React from 'react';

function AdminQuickActionsPanel({ pendingProviderRequests, adminSummaryResolved }) {
  return (
    <section id="admin-quick-actions" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2 id="admin-quick-actions-heading">Admin quick actions</h2>
          <p className="subhead">At-a-glance status of pending operations and provider decisions.</p>
        </div>
        <span className="badge">Fast tasks</span>
      </div>
      <div className="admin-overview-grid" style={{ marginBottom: 16 }}>
        <div className="admin-stat-card">
          <div className="stat-icon">📋</div>
          <div className="label">Provider responses</div>
          <div className="value">{pendingProviderRequests.length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">⏳</div>
          <div className="label">Active approvals</div>
          <div className="value">{adminSummaryResolved.pendingRequests}</div>
        </div>
      </div>
      <div className="stack">
        {pendingProviderRequests.length ? pendingProviderRequests.slice(0, 6).map((request) => (
          <div key={request.id} className="list-item">
            <div>
              <strong>{request.resourceName}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {request.quantity} units · {request.requestType || 'Borrow'}
              </div>
            </div>
            <span className="badge pending">Provider pending</span>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            No pending provider decisions.
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminQuickActionsPanel;
