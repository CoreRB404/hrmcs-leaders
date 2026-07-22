import React from 'react';
import InventoryItemRow from './InventoryItemRow';

function HospitalDashboard({ hospitalDashboard, currentHospital, respondToRequest, reviewClinicalRequest, getHospitalName, editInventoryItem, setInventoryItemStatus, deleteInventoryItem }) {
  if (!hospitalDashboard) {
    return null;
  }

  const workspaceHospitalId = currentHospital?.hospitalId || currentHospital?.id;
  const isHospitalRole = currentHospital?.role === 'Hospital';
  const isReviewerRole = ['Doctor', 'Pharmacist'].includes(currentHospital?.role);
  const hospitalRequests = hospitalDashboard.hospitalRequests || [];
  const visibleRequests = isReviewerRole
    ? hospitalRequests.filter((request) => request.providerHospitalId === workspaceHospitalId)
    : hospitalRequests;

  const getStageLabel = (request) => {
    if (request.status !== 'Pending') return request.status;
    const providerName = getHospitalName?.(request.providerHospitalId) || 'provider hospital';
    if (request.pharmacistApproval === 'Pending') return `Waiting for ${providerName} pharmacist approval`;
    if (request.doctorApproval === 'Pending') return `Waiting for ${providerName} doctor approval`;
    if (request.providerApproval === 'Pending') return `Waiting for ${providerName} hospital approval`;
    return 'Waiting for admin approval';
  };

  const summaryStats = [
    { label: 'Inventory items', value: hospitalDashboard.hospitalInventory?.length || 0, icon: '📦' },
    { label: 'Active supply requests', value: visibleRequests.filter((request) => request.status === 'Pending').length, icon: '📋' },
  ];

  return (
    <section className="panel professional-panel">
      <div className="panel-header">
        <div>
          <h2>{hospitalDashboard.hospital.name} dashboard</h2>
          <p className="subhead">Supply inventory and staged request approval workflow for this hospital.</p>
        </div>
        <span className="badge">Supply view</span>
      </div>

      <div className="admin-overview-grid" style={{ marginBottom: 20 }}>
        {summaryStats.map((stat) => (
          <div key={stat.label} className="admin-stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid two-col">
        <div className="admin-subsection">
          <div className="section-header">
            <h3>Hospital inventory <span className="result-count">{hospitalDashboard.hospitalInventory.length}</span></h3>
          </div>
          <div className="stack">
            {hospitalDashboard.hospitalInventory.length ? hospitalDashboard.hospitalInventory.map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                canEdit={isHospitalRole}
                editInventoryItem={editInventoryItem}
                setInventoryItemStatus={setInventoryItemStatus}
                deleteInventoryItem={deleteInventoryItem}
              />
            )) : (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                No inventory items yet. Publish listings to populate.
              </div>
            )}
          </div>
        </div>
        <div className="admin-subsection">
          <div className="section-header">
            <h3>{isReviewerRole ? 'Hospital requests for review' : 'Related supply requests'} <span className="result-count">{visibleRequests.length}</span></h3>
          </div>
          <div className="stack">
            {visibleRequests.length ? visibleRequests.map((request) => (
              <div key={request.id} className="list-item">
                <div>
                  <strong>{request.resourceName || request.need}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {getHospitalName?.(request.requesterHospitalId) || request.requesterHospitalId || 'Unknown requester'} → {getHospitalName?.(request.providerHospitalId) || request.providerHospitalId || 'Unassigned provider'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="badge">
                      {request.requesterHospitalId === workspaceHospitalId
                        ? 'Your hospital is Requester'
                        : request.providerHospitalId === workspaceHospitalId
                          ? 'Your hospital is Provider'
                          : 'Related request'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{request.requestType || request.type} · {request.status}</span>
                    {request.queuePosition ? <span className="badge pending">Queue #{request.queuePosition} of {request.queueSize}</span> : null}
                    {request.urgency ? <span className={`badge urgency-${request.urgency.toLowerCase()}`}>{request.urgency} urgency</span> : null}
                  </div>
                  {request.reason ? <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 5 }}>{request.reason}</div> : null}
                </div>
                {currentHospital?.role === 'Pharmacist' && request.providerHospitalId === workspaceHospitalId && request.pharmacistApproval === 'Pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-accept" onClick={() => reviewClinicalRequest(request.id, 'Pharmacist', 'approve')}>Approve</button>
                    <button className="action-reject" onClick={() => reviewClinicalRequest(request.id, 'Pharmacist', 'reject')}>Reject</button>
                  </div>
                ) : currentHospital?.role === 'Doctor' && request.providerHospitalId === workspaceHospitalId && request.pharmacistApproval === 'Approved' && request.doctorApproval === 'Pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-accept" onClick={() => reviewClinicalRequest(request.id, 'Doctor', 'approve')}>Approve</button>
                    <button className="action-reject" onClick={() => reviewClinicalRequest(request.id, 'Doctor', 'reject')}>Reject</button>
                  </div>
                ) : isHospitalRole && request.providerHospitalId === workspaceHospitalId && request.pharmacistApproval === 'Approved' && request.doctorApproval === 'Approved' && request.providerApproval === 'Pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-accept" onClick={() => respondToRequest(request.id, 'approve')}>Accept</button>
                    <button className="action-reject" onClick={() => respondToRequest(request.id, 'reject')}>Decline</button>
                  </div>
                ) : (
                  <span className={`badge ${request.status === 'Pending' ? 'pending' : request.status === 'Approved' ? 'success' : ''}`}>{getStageLabel(request)}</span>
                )}
              </div>
            )) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                {isReviewerRole ? 'No requests assigned to this provider hospital need your review.' : 'No related requests yet.'}
              </div>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}

export default HospitalDashboard;
