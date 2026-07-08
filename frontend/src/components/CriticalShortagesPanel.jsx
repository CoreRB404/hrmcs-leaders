import React from 'react';

function CriticalShortagesPanel({ dashboard }) {
  const getShortageLevel = (quantity) => {
    if (quantity <= 0) return 'critical';
    if (quantity <= 5) return 'warning';
    return 'ok';
  };

  const maxQuantity = Math.max(...dashboard.criticalShortages.map((i) => i.quantity), 20);

  return (
    <section id="critical-shortages" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2 id="critical-shortages-heading">Critical shortages <span className="result-count">{dashboard.criticalShortages.length}</span></h2>
          <p className="subhead">Items at dangerously low stock levels across the network.</p>
        </div>
        <span className="badge danger">Alerts</span>
      </div>
      <div className="stack">
        {dashboard.criticalShortages.length ? dashboard.criticalShortages.map((item) => {
          const level = getShortageLevel(item.quantity);
          return (
            <div key={item.id} className={`shortage-item ${level === 'critical' ? 'zero-stock' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{item.item}</strong>
                  <span className={`attention-label ${level}`} style={{ marginLeft: 8 }}>
                    {level === 'critical' ? '● Critical' : '● Low'}
                  </span>
                </div>
                <strong style={{ color: level === 'critical' ? 'var(--danger)' : 'var(--warning)' }}>
                  {item.quantity} units
                </strong>
              </div>
              <div className="severity-bar">
                <div
                  className={`severity-bar-fill ${level}`}
                  style={{ width: `${Math.max((item.quantity / maxQuantity) * 100, 4)}%` }}
                />
              </div>
            </div>
          );
        }) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            No critical shortages — all stock levels are healthy.
          </div>
        )}
      </div>
    </section>
  );
}

export default CriticalShortagesPanel;
