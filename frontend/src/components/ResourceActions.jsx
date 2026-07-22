function ResourceActions({
  currentHospital,
  listingForm,
  setListingForm,
  createListing,
  requestForm,
  setRequestForm,
  activeProviders,
  createRequest,
  selectedProvider,
  providerPublishedSupplies,
  selectedPublishedSupply,
  isRequestSubmitDisabled,
}) {
  if (!currentHospital || currentHospital.role === 'Admin') {
    return null;
  }

  return (
    <div className="grid two-col">
      <section className="panel professional-panel">
        <div className="panel-header">
          <div>
            <h2>Publish resources</h2>
            <p className="subhead">Keep the network informed with up-to-date supply inventory.</p>
          </div>
          <span className="badge">Publishing</span>
        </div>
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
          <div className="form-grid two-col-form">
            <div className="field">
              <label htmlFor="request-quantity">Quantity</label>
              <input id="request-quantity" type="number" min="1" max={selectedPublishedSupply?.availableQuantity || undefined} value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: Number(e.target.value) })} placeholder="Quantity" disabled={!selectedPublishedSupply} required />
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
            <label htmlFor="request-type">Request type</label>
            <select id="request-type" value={requestForm.requestType || 'Borrow'} onChange={(e) => setRequestForm({ ...requestForm, requestType: e.target.value, providerHospitalId: '', resourceName: '' })}>
              <option value="Borrow">Borrow</option>
              <option value="Order">Order</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="request-provider">Provider hospital</label>
            <select id="request-provider" value={requestForm.providerHospitalId} onChange={(e) => setRequestForm({ ...requestForm, providerHospitalId: e.target.value, resourceName: '' })}>
              <option value="">Choose provider</option>
              {activeProviders.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>{hospital.name} ({hospital.location})</option>
              ))}
            </select>
            {!activeProviders.length ? <small>No hospitals currently have published supplies for {requestForm.requestType.toLowerCase()}.</small> : null}
          </div>
          <div className="field">
            <label htmlFor="request-resource">Published supply</label>
            <select id="request-resource" value={requestForm.resourceName} onChange={(e) => {
              const supply = providerPublishedSupplies.find((item) => item.resourceName === e.target.value);
              setRequestForm({
                ...requestForm,
                resourceName: e.target.value,
                quantity: supply ? Math.min(Math.max(1, Number(requestForm.quantity) || 1), supply.availableQuantity) : requestForm.quantity,
              });
            }} disabled={!requestForm.providerHospitalId} required>
              <option value="">{requestForm.providerHospitalId ? 'Choose published supply' : 'Choose a provider first'}</option>
              {providerPublishedSupplies.map((item) => (
                <option key={item.resourceName} value={item.resourceName}>{item.resourceName} ({item.availableQuantity} available)</option>
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
            {selectedPublishedSupply ? <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>Published stock: {selectedPublishedSupply.availableQuantity} {selectedPublishedSupply.resourceName}</div> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ResourceActions;
