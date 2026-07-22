import React from 'react';
import Card from './Card';

function DashboardSummary({ currentHospital, isHospitalRole, isAdmin, activeAdminSection, hospitalWorkspaceStats, dashboard }) {
  const cardIcons = ['🏥', '📦', '⚠', '📋', '🚨'];
  const cardTones = ['', 'accent', 'warning', '', 'danger'];

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">{isHospitalRole ? '● Hospital operations workspace' : '● Connected hospital network'}</span>
          <h1>{isHospitalRole && currentHospital ? `${currentHospital.name} Operations Center` : 'Hospital Resource Management & Coordination System'}</h1>
          <p>{isHospitalRole ? 'Coordinate inventory and inter-hospital supply requests from a secure, professional workspace.' : 'Publish supply availability, request critical resources across the network, and monitor every transfer from one secure command center.'}</p>
        </div>
      </section>

      {currentHospital && (
        <div className="admin-focus-banner">
          <div>
            <span className="eyebrow">{isAdmin ? '◈ Focused admin view' : '◈ Focused hospital workspace'}</span>
            <h2>{activeAdminSection.replace(/-/g, ' ')}</h2>
          </div>
          <p>{isAdmin ? 'Only the selected section is shown to reduce clutter.' : 'Each workspace section is presented clearly so your team can act faster.'}</p>
        </div>
      )}

      <div className="grid cards">
        {isHospitalRole ? (
          hospitalWorkspaceStats.map((item, index) => (
            <div key={item.label} className={`card ${item.tone === 'primary' ? 'highlight' : `tone-${item.tone}`}`}>
              <div className={`card-icon ${item.tone}`}>{['📦', '📋', '👥', '⚠'][index] || '📊'}</div>
              <div className="label">{item.label}</div>
              <div className="value">{item.value}</div>
            </div>
          ))
        ) : (
          <>
            <Card title="Hospitals" value={dashboard.totalHospitals} icon={cardIcons[0]} tone={cardTones[0]} highlight />
            <Card title="Inventory Items" value={dashboard.totalInventoryItems} icon={cardIcons[1]} tone={cardTones[1]} />
            <Card title="Critical Shortages" value={dashboard.criticalShortages.length} icon={cardIcons[2]} tone={cardTones[2]} />
            <Card title="Pending Requests" value={dashboard.pendingRequests} icon={cardIcons[3]} tone={cardTones[3]} />
            <Card title="Emergency Alerts" value={dashboard.emergencyAlerts} icon={cardIcons[4]} tone={cardTones[4]} />
          </>
        )}
      </div>
    </>
  );
}

export default DashboardSummary;
