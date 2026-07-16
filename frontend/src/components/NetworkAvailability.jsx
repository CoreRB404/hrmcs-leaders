import React from 'react';

function NetworkAvailability({
  hospitals,
  currentHospital,
  networkSearch,
  setNetworkSearch,
  networkLocationFilter,
  setNetworkLocationFilter,
  networkTypeFilter,
  setNetworkTypeFilter,
  inventorySort,
  setInventorySort,
  inventoryAvailabilityFilter,
  setInventoryAvailabilityFilter,
  filterNetworkInventory,
  selectSupply,
  selectedSupplyId,
  selectedProviderId,
  selectedNetworkItem,
  getHospitalName,
}) {
  const locationOptions = [...new Set(hospitals.map((hospital) => hospital.location))];
  const typeOptions = [...new Set(hospitals.map((hospital) => hospital.type))];
  const filteredInventory = filterNetworkInventory();

  return (
    <section id="network-availability" className="panel network-panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2>Network availability</h2>
          <p className="subhead">Browse available supplies across the network to choose the best provider for your request.</p>
        </div>
        {selectedSupplyId ? (
          <div className="selected-summary">
            <div><strong>Selected:</strong> {selectedNetworkItem?.resourceName || selectedNetworkItem?.role}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{getHospitalName(selectedProviderId)}</div>
          </div>
        ) : null}
      </div>

      <div className="panel-controls">
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label>Search network</label>
          <div className="field-with-icon">
            <span className="field-icon">🔍</span>
            <input value={networkSearch} onChange={(e) => setNetworkSearch(e.target.value)} placeholder="Filter by resource, provider, or status" />
          </div>
        </div>
        <div className="field-inline">
          <label>Location</label>
          <select value={networkLocationFilter} onChange={(e) => setNetworkLocationFilter(e.target.value)}>
            <option value="All">All locations</option>
            {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </div>
        <div className="field-inline">
          <label>Provider type</label>
          <select value={networkTypeFilter} onChange={(e) => setNetworkTypeFilter(e.target.value)}>
            <option value="All">All types</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>

      <div className="grid two-col network-grid">
        <div className="inventory-card">
          <div className="section-header">
            <div>
              <h3 id="other-supplies">Supplies <span className="result-count">{filteredInventory.length}</span></h3>
              <span className="section-note">Select to prefill a request</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field-inline">
                <label>Availability</label>
                <select value={inventoryAvailabilityFilter} onChange={(e) => setInventoryAvailabilityFilter(e.target.value)}>
                  <option value="All">All</option>
                  <option value="Borrow">Borrow</option>
                  <option value="Order">Order</option>
                </select>
              </div>
              <div className="field-inline">
                <label>Sort</label>
                <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value)}>
                  <option value="quantity">Highest qty</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>
          <div className="inventory-list">
            {filteredInventory.length ? filteredInventory.map((item) => {
              const displayQuantity = item.publishedQuantity ?? item.availableQuantity ?? item.quantity;
              return (
                <div key={item.id} className={`inventory-item ${selectedSupplyId === item.id ? 'selected' : ''}`} onClick={() => currentHospital?.role !== 'Admin' && selectSupply(item)} style={{ cursor: currentHospital?.role === 'Admin' ? 'default' : 'pointer' }}>
                  <div>
                    <strong>{item.resourceName}</strong>
                    <div className="item-meta">{getHospitalName(item.hospitalId)} · {item.resourceType}</div>
                  </div>
                  <div className="item-actions">
                    <span className="item-value">{displayQuantity} avail</span>
                    {currentHospital?.role !== 'Admin' && <span className="item-tag">Select</span>}
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                No supplies listed by other hospitals yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default NetworkAvailability;
