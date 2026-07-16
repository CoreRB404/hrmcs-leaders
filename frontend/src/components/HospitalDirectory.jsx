import React from 'react';

function HospitalDirectory({ hospitalSearch, setHospitalSearch, hospitals, getHospitalName, currentHospital, updateHospitalEmergencyStatus }) {
  const filteredHospitals = hospitals.filter((hospital) => {
    const query = hospitalSearch.toLowerCase();
    return !query || [hospital.name, hospital.location, hospital.type, hospital.visibility].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <section id="hospital-directory" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2>Hospital directory <span className="result-count">{filteredHospitals.length}</span></h2>
          <p className="subhead">Search and browse registered facilities across the network.</p>
        </div>
        <span className="badge">Directory</span>
      </div>
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="hospital-search">Search hospitals</label>
          <div className="field-with-icon">
            <span className="field-icon">🔍</span>
            <input id="hospital-search" value={hospitalSearch} onChange={(e) => setHospitalSearch(e.target.value)} placeholder="Search by name, location, or type" />
          </div>
        </div>
      </div>
      <div className="stack">
        {filteredHospitals.length ? filteredHospitals.map((hospital) => (
          <div key={hospital.id} className="list-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem', flexShrink: 0 }}>
                {hospital.name?.charAt(0) || 'H'}
              </div>
              <div>
                <strong>{hospital.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{hospital.location} · {hospital.type}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {hospital.accountStatus && hospital.accountStatus !== 'Active' ? <span className="badge pending">{hospital.accountStatus}</span> : null}
              {currentHospital?.role === 'Admin' ? (
                <select
                  value={hospital.emergencyStatus || 'Medium'}
                  onChange={(e) => updateHospitalEmergencyStatus(hospital.id, e.target.value)}
                  style={{ minWidth: 120, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              ) : (
                <span className="badge">{hospital.emergencyStatus || 'Medium'}</span>
              )}
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">🏥</div>
            No hospitals match your search.
          </div>
        )}
      </div>
    </section>
  );
}

export default HospitalDirectory;
