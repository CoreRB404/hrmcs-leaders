import React from 'react';

function HospitalDashboard({ hospitalDashboard, currentHospital, respondToRequest }) {
  if (!hospitalDashboard) {
    return null;
  }

  const summaryStats = [
    { label: 'Inventory types', value: hospitalDashboard.hospitalInventory?.length || 0, icon: '📦' },
    { label: 'Staff roles', value: hospitalDashboard.hospitalStaff?.length || 0, icon: '👥' },
    { label: 'Active requests', value: hospitalDashboard.hospitalRequests?.filter((r) => r.status === 'Pending').length || 0, icon: '📋' },
  ];

  return (
    <section className="panel professional-panel">
      <div className="panel-header">
        <div>
          <h2>{hospitalDashboard.hospital.name} dashboard</h2>
          <p className="subhead">Capacity, bed availability, and staff status in one clear view.</p>
        </div>
        <span className="badge">Live view</span>
      </div>

      <div className="admin-overview-grid" style={{ marginBottom: 20 }}>
        {summaryStats.map((stat) => (
          <div key={stat.label} className="admin-stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
          </div>
        ))}
        <div className="admin-stat-card">
          <div className="stat-icon">🏥</div>
          <div className="label">Capacity</div>
          <div className="value">{hospitalDashboard.hospital.capacity}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">🛏</div>
          <div className="label">Available beds</div>
          <div className="value">{hospitalDashboard.hospital.availableBeds}</div>
        </div>
      </div>

      <div className="grid two-col">
        <div className="admin-subsection">
          <div className="section-header">
            <h3>Hospital inventory <span className="result-count">{hospitalDashboard.hospitalInventory.length}</span></h3>
          </div>
          <div className="stack">
            {hospitalDashboard.hospitalInventory.length ? hospitalDashboard.hospitalInventory.map((item) => (
              <div key={item.id} className={`list-item inventory-summary-row ${((item.availableQuantity ?? item.quantity) <= 0) ? 'critical' : ((item.availableQuantity ?? item.quantity) <= 5 ? 'warning' : '')}`}>
                <div>
                  <div className="title-row">
                    <strong>{item.resourceName || item.item}</strong>
                    {((item.availableQuantity ?? item.quantity) <= 0) ? <span className="attention-label critical">● Critical</span> : ((item.availableQuantity ?? item.quantity) <= 5 ? <span className="attention-label warning">● Low</span> : null)}
                  </div>
                  <div className="quantity-meta">
                    <span className="quantity-pill published">Published {item.publishedQuantity ?? item.quantity}</span>
                    <span className="quantity-pill available">Available {item.availableQuantity ?? item.quantity}</span>
                    <span className="quantity-pill lent">Lent {item.lentQuantity || 0}</span>
                  </div>
                </div>
                <strong className="quantity-highlight">{item.availableQuantity ?? item.quantity} avail</strong>
              </div>
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
            <h3>Related requests <span className="result-count">{hospitalDashboard.hospitalRequests.length}</span></h3>
          </div>
          <div className="stack">
            {hospitalDashboard.hospitalRequests.length ? hospitalDashboard.hospitalRequests.map((request) => (
              <div key={request.id} className="list-item">
                <div>
                  <strong>{request.resourceName || request.need}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{request.requestType || request.type} · {request.status}</div>
                </div>
                {request.providerHospitalId === currentHospital?.id && request.providerApproval === 'Pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-accept" onClick={() => respondToRequest(request.id, 'approve')}>Accept</button>
                    <button className="action-reject" onClick={() => respondToRequest(request.id, 'reject')}>Decline</button>
                  </div>
                ) : (
                  <span className={`badge ${request.status === 'Pending' ? 'pending' : request.status === 'Approved' ? 'success' : ''}`}>{request.status}</span>
                )}
              </div>
            )) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                No related requests yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-subsection" style={{ marginTop: 16 }}>
        <div className="section-header">
          <h3>Staff roster <span className="result-count">{hospitalDashboard.hospitalStaff.length}</span></h3>
        </div>
        <div className="stack">
          {hospitalDashboard.hospitalStaff.length ? hospitalDashboard.hospitalStaff.map((staff) => (
            <div key={staff.id} className={`list-item inventory-summary-row ${((staff.availableCount ?? staff.count) <= 0) ? 'critical' : ((staff.availableCount ?? staff.count) <= 2 ? 'warning' : '')}`}>
              <div>
                <div className="title-row">
                  <strong>{staff.role}</strong>
                  {((staff.availableCount ?? staff.count) <= 0) ? <span className="attention-label critical">● Critical</span> : ((staff.availableCount ?? staff.count) <= 2 ? <span className="attention-label warning">● Low</span> : null)}
                </div>
                <div className="quantity-meta">
                  <span className="quantity-pill published">Published {staff.publishedCount ?? staff.count}</span>
                  <span className="quantity-pill available">Available {staff.availableCount ?? staff.count}</span>
                  <span className="quantity-pill lent">Deployed {staff.deployedCount || 0}</span>
                </div>
              </div>
              <span className="quantity-highlight">{staff.availableCount ?? staff.count} {staff.status}</span>
            </div>
          )) : (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              No staff entries yet. Submit staff updates to populate.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HospitalDashboard;
