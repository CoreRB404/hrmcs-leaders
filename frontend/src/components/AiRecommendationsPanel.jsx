import React from 'react';

function AiRecommendationsPanel({ recommendations, loading, error }) {
  const makeReasonSummary = (item) => {
    const breakdown = item?.reasonBreakdown || {};
    const reasons = [];
    if (breakdown.distance >= 0.6) reasons.push('close proximity');
    if (breakdown.stock >= 0.5) reasons.push('high stock');
    if (breakdown.reliability >= 0.5) reasons.push('fast historical response');
    if (breakdown.emergency >= 0.5) reasons.push('strong emergency readiness');
    return reasons.length ? `Ranked #${item.rank}: ${reasons.join(', ')}.` : `Ranked #${item.rank}: balanced fit for this request.`;
  };

  return (
    <section id="ai-recommendations" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2 id="ai-recommendations-heading">AI recommendations <span className="result-count">{recommendations.length}</span></h2>
          <p className="subhead">Smart suggestions for the best matching provider hospitals.</p>
        </div>
        <span className="badge">Smart match</span>
      </div>
      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          Loading recommendations…
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          {error}
        </div>
      ) : recommendations.length ? (
        <div className="stack">
          {recommendations.map((item, index) => (
            <div key={item.id} className="recommendation-item">
              <div className="recommendation-rank">{index + 1}</div>
              <div className="recommendation-details">
                <strong>{item.name}</strong>
                <div className="recommendation-meta">
                  <span>📦 {item.stock ?? 0} in stock</span>
                  <span>👥 {item.availableStaff ?? 0} staff available</span>
                </div>
                <div className="recommendation-meta" style={{ marginTop: 6 }}>
                  <span>Confidence: {(item.score ?? 0).toFixed(2)}/5</span>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#475569' }}>{makeReasonSummary(item)}</div>
                <div className="score-bar" style={{ marginTop: 8 }}>
                  <div className="score-track">
                    <div className="score-fill" style={{ width: `${((item.score ?? 0) / 5) * 100}%` }} />
                  </div>
                  <span className="score-value">{(item.score ?? 0).toFixed(2)}/5</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">◌</div>
          No active hospitals are available for this recommendation request right now.
        </div>
      )}
    </section>
  );
}

export default AiRecommendationsPanel;
