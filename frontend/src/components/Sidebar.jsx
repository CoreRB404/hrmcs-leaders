import { useState } from 'react';

function Sidebar({ sidebarSections, activeAdminSection, setActiveAdminSection, currentHospital, isAdmin, handleLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-card">
          <div className="sidebar-header">
            <div className="sidebar-profile">
              <div className="sidebar-avatar">{isAdmin ? 'A' : (currentHospital?.name?.charAt(0) || 'H')}</div>
              <div>
                <span className="sidebar-kicker">Workspace</span>
                <h3>{currentHospital?.name || 'Hospital workspace'}</h3>
                <span className="sidebar-role-pill">{isAdmin ? 'Admin account' : currentHospital?.role || 'Hospital account'}</span>
              </div>
            </div>
          </div>
          <div className="sidebar-subtitle">Navigate your workspace</div>
          <nav>
            <ul>
              {sidebarSections.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`sidebar-link ${activeAdminSection === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveAdminSection(item.id);
                      setMobileOpen(false);
                    }}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span className="sidebar-link-text">
                      <span className="sidebar-link-label">{item.label}</span>
                      <small>{item.hint}</small>
                    </span>
                    <span className="sidebar-link-indicator" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {handleLogout && (
            <div className="sidebar-logout">
              <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
                ⏻ Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
