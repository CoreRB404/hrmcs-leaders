import React from 'react';

function NotificationsPanel({ notifications }) {
  return (
    <section id="recent-notifications" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2>Recent notifications <span className="result-count">{notifications.length}</span></h2>
          <p className="subhead">Latest activity and alerts across the hospital network.</p>
        </div>
        <span className="badge">Activity</span>
      </div>
      <div className="stack">
        {notifications.length ? notifications.slice(0, 8).map((notification) => (
          <div key={notification.id} className="notification-item">
            <span className={`notification-dot ${notification.severity || 'Info'}`} />
            <div className="notification-content">
              <span>{notification.message}</span>
              {notification.timestamp && (
                <div className="notification-time">{new Date(notification.timestamp).toLocaleString()}</div>
              )}
            </div>
            <span className={`badge ${notification.severity === 'Critical' ? 'danger' : notification.severity === 'Warning' ? 'pending' : ''}`}>
              {notification.severity}
            </span>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            No notifications yet. Activity will appear here.
          </div>
        )}
      </div>
    </section>
  );
}

export default NotificationsPanel;
