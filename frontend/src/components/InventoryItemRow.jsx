import { useState } from 'react';

function InventoryItemRow({ item, canEdit, editInventoryItem, setInventoryItemStatus, deleteInventoryItem }) {
  const initialForm = () => ({
    resourceName: item.resourceName || '',
    quantity: item.availableQuantity ?? item.quantity ?? 0,
    availableForBorrow: Boolean(item.availableForBorrow),
    availableForOrder: Boolean(item.availableForOrder),
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const available = item.availableQuantity ?? item.quantity ?? 0;
  const isInactive = item.status === 'Inactive';

  const cancel = () => {
    setForm(initialForm());
    setEditing(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const updated = await editInventoryItem(item.id, { ...form, quantity: Number(form.quantity) });
    setSaving(false);
    if (updated) setEditing(false);
  };

  if (editing) {
    return (
      <div className="list-item inventory-summary-row" style={{ display: 'block' }}>
        <form className="form-grid" onSubmit={submit}>
          <div className="form-grid two-col-form">
            <div className="field">
              <label htmlFor={`inventory-name-${item.id}`}>Supply name</label>
              <input id={`inventory-name-${item.id}`} value={form.resourceName} onChange={(event) => setForm({ ...form, resourceName: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor={`inventory-quantity-${item.id}`}>Available quantity</label>
              <input id={`inventory-quantity-${item.id}`} type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label><input type="checkbox" checked={form.availableForBorrow} onChange={(event) => setForm({ ...form, availableForBorrow: event.target.checked })} /> Available for borrowing</label>
            <label><input type="checkbox" checked={form.availableForOrder} onChange={(event) => setForm({ ...form, availableForOrder: event.target.checked })} /> Available for ordering</label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="action-accept" disabled={saving}>{saving ? 'Saving...' : 'Save inventory'}</button>
            <button type="button" className="secondary" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`list-item inventory-summary-row ${available <= 0 ? 'critical' : (available <= 5 ? 'warning' : '')}`}>
      <div>
        <div className="title-row">
          <strong>{item.resourceName || item.item}</strong>
          {isInactive ? <span className="badge">Inactive</span> : null}
          {!isInactive && available <= 0 ? <span className="attention-label critical">● Critical</span> : (!isInactive && available <= 5 ? <span className="attention-label warning">● Low</span> : null)}
        </div>
        <div className="quantity-meta">
          <span className="quantity-pill published">Published {item.publishedQuantity ?? item.quantity}</span>
          <span className="quantity-pill available">Available {available}</span>
          <span className="quantity-pill lent">Lent {item.lentQuantity || 0}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <strong className="quantity-highlight">{available} avail</strong>
        {canEdit ? <button type="button" className="action-accept" onClick={() => setEditing(true)}>Edit</button> : null}
        {canEdit ? (
          <button type="button" className="secondary" onClick={() => setInventoryItemStatus(item, isInactive ? 'Active' : 'Inactive')}>
            {isInactive ? 'Reactivate' : 'Deactivate'}
          </button>
        ) : null}
        {canEdit ? <button type="button" className="action-reject" onClick={() => deleteInventoryItem(item)}>Delete</button> : null}
      </div>
    </div>
  );
}

export default InventoryItemRow;
