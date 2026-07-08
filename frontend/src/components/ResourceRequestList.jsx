import React from 'react';

function ResourceRequestList({ currentHospital, filteredRequests, timelineOpenId, setTimelineOpenId, respondToRequest, getHospitalName }) {
  if (!currentHospital || currentHospital.role === 'Admin') {
    return null;
  }

  const getStatusClass = (status) => {
    if (status === 'Pending') return 'status-pending';
    if (status === 'Approved') return 'status-approved';
    if (status === 'Rejected') return 'status-rejected';
    return '';
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Resource transfer requests <span className="result-count">{filteredRequests.length}</span></h2>
          <p className="subhead">Track and manage all inter-hospital resource transfers.</p>
        </div>
        <span className="badge">Transfers</span>
      </div>
      <div className="stack">
        {filteredRequests.length ? filteredRequests.map((request) => (
          <div key={request.id} className={`list-item request-item ${getStatusClass(request.status)}`}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{request.resourceName || request.need}</strong>
                <span className={`badge ${request.status === 'Pending' || request.status === 'Open' ? 'pending' : request.status === 'Approved' ? 'success' : 'danger'}`}>
                  {request.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {request.type === 'PatientSupport' ? (
                  <>{getHospitalName(request.hospitalId)} · Patient Support ({request.patientType}) · Priority: {request.priority}</>
                ) : (
                  <>{getHospitalName(request.requesterHospitalId)} → {getHospitalName(request.providerHospitalId)} · {request.quantity} units · {request.requestType || request.type} · Provider: {request.providerApproval || 'N/A'}</>
                )}
              </div>
              {request.history?.length ? (
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#475569' }}>
                  <strong>Latest:</strong> {request.history[request.history.length - 1].note}
                </div>
              ) : null}
              <button className="secondary small" type="button" onClick={() => setTimelineOpenId(timelineOpenId === request.id ? null : request.id)} style={{ marginTop: 8 }}>
                {timelineOpenId === request.id ? '▲ Hide history' : '▼ Show history'}
              </button>
              {timelineOpenId === request.id && request.history?.length ? (
                <div className="history-panel">
                  {request.history.map((entry) => (
                    <div key={entry.id} className="history-entry">
                      <div><strong>{entry.status}</strong></div>
                      <div style={{ fontSize: '0.82rem', color: '#475569' }}>{entry.note}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{new Date(entry.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {request.providerHospitalId === currentHospital?.id && request.providerApproval === 'Pending' && (
                <>
                  <button className="action-accept" onClick={() => respondToRequest(request.id, 'approve')}>Accept</button>
                  <button className="action-reject" onClick={() => respondToRequest(request.id, 'reject')}>Decline</button>
                </>
              )}
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            No requests match your current filters.
          </div>
        )}
      </div>
    </section>
  );
}

export default ResourceRequestList;
