import React from 'react';

function AdminOversightPanel({
  adminSummaryResolved,
  pendingHospitals,
  requests,
  hospitals,
  currentHospital,
  adminRequestStatusFilter,
  setAdminRequestStatusFilter,
  approveHospital,
  deleteHospital,
  approve,
  reviewAdminRequest,
  getHospitalName,
}) {
  const isReadyForAdmin = (request) => request.status === 'Pending'
    && request.pharmacistApproval === 'Approved'
    && request.doctorApproval === 'Approved'
    && request.providerApproval === 'Approved';
  const pendingRequests = requests.filter((request) => request.status === 'Pending');
  const statCards = [
    { icon: '🏥', label: 'Hospitals', value: adminSummaryResolved.totalHospitals },
    { icon: '📋', label: 'Pending requests', value: adminSummaryResolved.pendingRequests },
    { icon: '✅', label: 'Approved', value: adminSummaryResolved.approvedRequests },
    { icon: '💊', label: 'Pharmacist reviews', value: adminSummaryResolved.pendingPharmacistApprovals || 0 },
    { icon: '🩺', label: 'Doctor reviews', value: adminSummaryResolved.pendingDoctorApprovals || 0 },
    { icon: '⏳', label: 'Hospital decisions', value: adminSummaryResolved.pendingProviderApprovals },
    { icon: '🛑', label: 'Admin approvals', value: adminSummaryResolved.pendingAdminApprovals || 0 },
    { icon: '🏥', label: 'Hospital approvals', value: adminSummaryResolved.pendingHospitalApprovals },
  ];

  return (
    <section id="admin-oversight" className="panel admin-focus-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">● Admin control center</span>
          <h2>Admin oversight</h2>
        </div>
        <span className="badge">Operational view</span>
      </div>

      <div className="admin-overview-grid">
        {statCards.map((stat) => (
          <div key={stat.label} className="admin-stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid two-col">
        <section className="admin-subsection">
          <div className="section-header">
            <h3>Pending registrations <span className="result-count">{pendingHospitals.length}</span></h3>
          </div>
          <div className="stack">
            {pendingHospitals.length ? pendingHospitals.map((hospital) => (
              <div key={hospital.id} className="list-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem', flexShrink: 0 }}>
                    {hospital.name?.charAt(0) || 'H'}
                  </div>
                  <div>
                    <strong>{hospital.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{hospital.location} · {hospital.type}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{hospital.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="approve-button" onClick={() => approveHospital(hospital.id)}>Approve</button>
                  <button className="action-reject" onClick={() => deleteHospital(hospital.id)}>Delete</button>
                </div>
              </div>
            )) : (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                No pending hospital registrations.
              </div>
            )}
          </div>
        </section>

        <section className="admin-subsection">
          <div className="section-header">
            <h3>Recent activity</h3>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>Filter status</label>
            <div className="chip-filters">
              {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`chip ${adminRequestStatusFilter === status ? 'active' : ''}`}
                  onClick={() => setAdminRequestStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="stack">
            {requests.filter(r => adminRequestStatusFilter === 'All' || r.status === adminRequestStatusFilter).slice(0, 5).length ? requests.filter(r => adminRequestStatusFilter === 'All' || r.status === adminRequestStatusFilter).slice(0, 5).map((request) => (
              <div key={request.id} className="notification-item">
                <span className={`notification-dot ${request.status === 'Pending' ? 'Warning' : request.status === 'Approved' ? 'Success' : 'Error'}`} />
                <div className="notification-content">
                  <span>{getHospitalName(request.requesterHospitalId)} requested {request.quantity} {request.resourceName} from {getHospitalName(request.providerHospitalId)}</span>
                </div>
                <span className="badge">{request.status}</span>
              </div>
            )) : (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                No matching requests found.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="admin-subsection" style={{ marginTop: 16 }}>
        <div className="section-header">
          <h3>Pending resource transfers <span className="result-count">{pendingRequests.length}</span></h3>
        </div>
        <div className="stack">
          {pendingRequests.length ? pendingRequests.map((request) => (
            <div key={request.id} className="list-item request-item status-pending">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{request.resourceName}</strong>
                  <span className="badge pending">Pending</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {getHospitalName(request.requesterHospitalId)} → {getHospitalName(request.providerHospitalId)} · {request.quantity} units · {request.requestType || request.type || 'Transfer'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Resource transfer request · awaiting final review
                </div>
                {request.history?.length ? (
                  <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#475569' }}>{request.history[request.history.length - 1].note}</div>
                ) : null}
              </div>
              {isReadyForAdmin(request) ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="approve-button" onClick={() => approve(request.id)}>Approve</button>
                  <button className="action-reject" onClick={() => reviewAdminRequest(request.id, 'reject')}>Reject</button>
                </div>
              ) : <span className="badge pending">Not at admin stage</span>}
            </div>
          )) : (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              No pending transfer requests.
            </div>
          )}
        </div>
      </section>

    </section>
  );
}

export default AdminOversightPanel;
