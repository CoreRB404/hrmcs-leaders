import React from 'react';

function AiRecommendationsPanel({ recommendations }) {
  return (
    <section id="ai-recommendations" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2 id="ai-recommendations-heading">AI recommendations <span className="result-count">{recommendations.length}</span></h2>
          <p className="subhead">Smart suggestions for the best matching provider hospitals.</p>
        </div>
        <span className="badge">Smart match</span>
      </div>
      <div className="stack">
        {recommendations.length ? recommendations.map((item, index) => (
          <div key={item.id} className="recommendation-item">
            <div className="recommendation-rank">{index + 1}</div>
            <div className="recommendation-details">
              <strong>{item.name}</strong>
              <div className="recommendation-meta">
                <span>📦 {item.stock} in stock</span>
                <span>📍 {item.distance} km</span>
              </div>
              <div className="score-bar" style={{ marginTop: 8 }}>
                <div className="score-track">
                  <div className="score-fill" style={{ width: `${(item.score / 5) * 100}%` }} />
                </div>
                <span className="score-value">{item.score}/5</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">◌</div>
            No recommendations available yet. Submit a request to see AI suggestions.
          </div>
        )}
      </div>
    </section>
  );
}

export default AiRecommendationsPanel;
