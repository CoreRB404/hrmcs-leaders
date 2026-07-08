import React from 'react';

function RequestFiltersPanel({ requestStatusFilter, setRequestStatusFilter, requestTypeFilter, setRequestTypeFilter }) {
  const statusOptions = ['All', 'Pending', 'Approved', 'Rejected'];
  const typeOptions = ['All', 'Borrow', 'Order'];

  return (
    <section className="panel professional-panel">
      <div className="panel-header">
        <div>
          <h2>Request filters</h2>
          <p className="subhead">Filter the request list to find what you need quickly.</p>
        </div>
        <span className="badge">Filtered view</span>
      </div>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>Status</label>
          <div className="chip-filters">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={`chip ${requestStatusFilter === status ? 'active' : ''}`}
                onClick={() => setRequestStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>Type</label>
          <div className="chip-filters">
            {typeOptions.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip ${requestTypeFilter === type ? 'active' : ''}`}
                onClick={() => setRequestTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default RequestFiltersPanel;
