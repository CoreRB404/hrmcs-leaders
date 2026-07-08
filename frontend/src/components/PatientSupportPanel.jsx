import React from 'react';

function PatientSupportPanel({ currentHospital, supportForm, setSupportForm, createSupportRequest, selectedProvider, clearSelectedProvider }) {
  if (!currentHospital || currentHospital.role === 'Admin') {
    return null;
  }

  return (
    <section className="panel professional-panel">
      <div className="panel-header">
        <div>
          <h2>Patient-support coordination</h2>
          <p className="subhead">Log support requests for patients requiring inter-hospital coordination.</p>
        </div>
        <span className="badge">Care support</span>
      </div>
      <form onSubmit={createSupportRequest} className="form-grid">
        <div className="form-grid two-col-form">
          <div className="field">
            <label htmlFor="support-type">Patient type</label>
            <select id="support-type" value={supportForm.patientType} onChange={(e) => setSupportForm({ ...supportForm, patientType: e.target.value })}>
              <option value="ICU">ICU</option>
              <option value="Pediatric">Pediatric</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="support-priority">
              Priority
              <span className={`priority-badge ${supportForm.priority.toLowerCase()}`} style={{ marginLeft: 8 }}>
                {supportForm.priority}
              </span>
            </label>
            <select id="support-priority" value={supportForm.priority} onChange={(e) => setSupportForm({ ...supportForm, priority: e.target.value })}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="support-need">Need</label>
          <input id="support-need" value={supportForm.need} onChange={(e) => setSupportForm({ ...supportForm, need: e.target.value })} placeholder="e.g. Ventilator support, blood bags" required />
        </div>
        <div className="field">
          <label htmlFor="support-notes">Notes</label>
          <input id="support-notes" value={supportForm.notes} onChange={(e) => setSupportForm({ ...supportForm, notes: e.target.value })} placeholder="Additional context for coordinating care" />
        </div>
        <button type="submit">Log patient-support request</button>
      </form>
      {selectedProvider ? (
        <div className="selected-summary" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Selected staff provider:</strong> {selectedProvider.name} ({selectedProvider.location})
            </div>
            <button className="secondary small" onClick={clearSelectedProvider} type="button">Clear provider</button>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>This request will be sent directly to them for approval.</div>
        </div>
      ) : (
        <div className="selected-summary" style={{ marginTop: 16, backgroundColor: '#f1f5f9' }}>
          <strong>Broadcast mode:</strong> This request will be visible to all hospitals in the network.
        </div>
      )}
    </section>
  );
}

export default PatientSupportPanel;
