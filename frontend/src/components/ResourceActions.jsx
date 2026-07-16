import { useState } from 'react';

function ResourceActions({
  currentHospital,
  listingForm,
  setListingForm,
  createListing,
  staffForm,
  setStaffForm,
  submitStaffUpdate,
  requestForm,
  setRequestForm,
  activeProviders,
  createRequest,
  selectedProvider,
  isRequestSubmitDisabled,
}) {
  const [activeTab, setActiveTab] = useState('listing');

  if (!currentHospital || currentHospital.role === 'Admin') {
    return null;
  }

  return (
    <div className="grid two-col">
      <section className="panel professional-panel">
        <div className="panel-header">
          <div>
            <h2>Publish resources</h2>
            <p className="subhead">Keep your network informed with up-to-date inventory and staffing visibility.</p>
          </div>
          <span className="badge">Publishing</span>
        </div>
        <div className="panel-tabs">
          <button type="button" className={`panel-tab ${activeTab === 'listing' ? 'active' : ''}`} onClick={() => setActiveTab('listing')}>
            Supply listing
          </button>
          <button type="button" className={`panel-tab ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
            Staff update
          </button>
        </div>
        {activeTab === 'listing' ? (
          <form onSubmit={createListing} className="form-grid">
            <div className="field">
              <label htmlFor="listing-name">Resource name</label>
              <input id="listing-name" value={listingForm.resourceName} onChange={(e) => setListingForm({ ...listingForm, resourceName: e.target.value })} placeholder="e.g. Blood Bags, Ventilators" required />
            </div>
            <div className="field">
              <label htmlFor="listing-quantity">Quantity</label>
              <input id="listing-quantity" type="number" value={listingForm.quantity} onChange={(e) => setListingForm({ ...listingForm, quantity: Number(e.target.value) })} placeholder="Quantity" required />
            </div>
            <button type="submit">Publish listing</button>
          </form>
        ) : (
          <form onSubmit={submitStaffUpdate} className="form-grid">
            <div className="field">
              <label htmlFor="staff-role">Staff role</label>
              <input id="staff-role" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} placeholder="e.g. Nurse, Surgeon" required />
            </div>
            <div className="form-grid two-col-form">
              <div className="field">
                <label htmlFor="staff-status">Status</label>
                <select id="staff-status" value={staffForm.status} onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}>
                  <option value="Available">Available</option>
                  <option value="Deployable">Deployable</option>
                  <option value="Deployed">Deployed</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="staff-count">Count</label>
                <input id="staff-count" type="number" min="1" value={staffForm.count} onChange={(e) => setStaffForm({ ...staffForm, count: Number(e.target.value) })} required />
              </div>
            </div>
            <button type="submit">Submit staff update</button>
          </form>
        )}
      </section>

      <section className="panel professional-panel">
        <div className="panel-header">
          <div>
            <h2>Request resource</h2>
            <p className="subhead">Submit a request to another hospital with clear provider and quantity details.</p>
          </div>
          <span className="badge">Request flow</span>
        </div>
        <form onSubmit={createRequest} className="form-grid">
          <div className="field">
            <label htmlFor="request-resource">What do you need?</label>
            <input id="request-resource" value={requestForm.resourceName} onChange={(e) => setRequestForm({ ...requestForm, resourceName: e.target.value })} placeholder="e.g. Blood Bags, Ventilators" required />
          </div>
          <div className="form-grid two-col-form">
            <div className="field">
              <label htmlFor="request-quantity">Quantity</label>
              <input id="request-quantity" type="number" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: Number(e.target.value) })} placeholder="Quantity" required />
            </div>
            <div className="field">
              <label htmlFor="request-urgency">Urgency</label>
              <select id="request-urgency" value={requestForm.urgency || 'High'} onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="request-provider">Provider hospital</label>
            <select id="request-provider" value={requestForm.providerHospitalId} onChange={(e) => setRequestForm({ ...requestForm, providerHospitalId: e.target.value })}>
              <option value="">Choose provider</option>
              {activeProviders.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>{hospital.name} ({hospital.location})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="request-notes">Notes</label>
            <input id="request-notes" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} placeholder="Additional context for this request" />
          </div>
          <button type="submit" disabled={isRequestSubmitDisabled}>Send request</button>
        </form>
        {selectedProvider ? (
          <div className="selected-summary" style={{ marginTop: 16 }}>
            <strong>Selected provider:</strong> {selectedProvider.name} ({selectedProvider.location})
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>Status: {selectedProvider.accountStatus}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ResourceActions;
