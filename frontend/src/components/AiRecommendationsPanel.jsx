import React from 'react';

function RecommendationMiniMap({ networkMap, recommendations }) {
  const nodes = networkMap?.nodes || [];
  const edges = networkMap?.edges || [];
  if (!nodes.length) return null;

  const admin = nodes.find((node) => node.role === 'Admin');
  const hospitals = nodes.filter((node) => node.role !== 'Admin');
  const positions = {};
  if (admin) positions[admin.id] = { x: 360, y: 205 };
  hospitals.forEach((hospital, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, hospitals.length);
    positions[hospital.id] = { x: 360 + Math.cos(angle) * 235, y: 205 + Math.sin(angle) * 145 };
  });
  const rankById = Object.fromEntries(recommendations.map((item) => [item.id, item.rank]));
  const currentId = networkMap.currentHospitalId;

  return (
    <div className="recommendation-map-card">
      <div className="recommendation-map-heading">
        <div>
          <strong>Hospital distance network</strong>
          <span>Ranks use distance from the highlighted requester to each provider.</span>
        </div>
        <span className="badge">km map</span>
      </div>
      <svg className="recommendation-map" viewBox="0 0 720 420" role="img" aria-label="Hospital network minimap with pairwise distances">
        {edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const highlighted = edge.from === currentId || edge.to === currentId;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={`${edge.from}-${edge.to}`} className={highlighted ? 'map-edge highlighted' : 'map-edge'}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
              <rect x={midX - 18} y={midY - 10} width="36" height="18" rx="8" />
              <text x={midX} y={midY + 4}>{edge.distance} km</text>
            </g>
          );
        })}
        {nodes.map((node) => {
          const position = positions[node.id];
          if (!position) return null;
          const isCurrent = node.id === currentId;
          const rank = rankById[node.id];
          return (
            <g key={node.id} className={isCurrent ? 'map-node current' : 'map-node'} transform={`translate(${position.x} ${position.y})`}>
              <circle r={node.role === 'Admin' ? 31 : 27} />
              <text className="map-node-initial" y="5">{node.name?.charAt(0) || 'H'}</text>
              {rank ? <text className="map-node-rank" x="25" y="-22">#{rank}</text> : null}
              <text className="map-node-name" y={node.role === 'Admin' ? 48 : 44}>{node.name}</text>
              <text className="map-node-role" y={node.role === 'Admin' ? 63 : 59}>{isCurrent ? 'Requester' : node.role}</text>
            </g>
          );
        })}
      </svg>
      <p className="recommendation-map-note">Bold connections originate from the current requester. Faded lines show distances between the other hospitals.</p>
    </div>
  );
}

function AiRecommendationsPanel({ recommendations, networkMap, loading, error }) {
  const makeReasonSummary = (item) => {
    const breakdown = item?.reasonBreakdown || {};
    const basis = item?.rankingBasis || {};
    const reliability = basis.reliability || {};
    const reasons = [];
    if (breakdown.distance >= 0.6) reasons.push(`${basis.distance ?? item.distance ?? 0} km distance`);
    if (breakdown.stock >= 0.5) reasons.push(`${item.stock ?? 0} units in stock`);
    if (reliability.completedResponses > 0) reasons.push(`${reliability.averageResponseHours}h average response`);
    if (breakdown.emergency >= 0.5) reasons.push(`${basis.emergencyStatus || item.emergencyStatus || 'Unknown'} emergency readiness`);
    return reasons.length ? `Ranked #${item.rank}: ${reasons.join(', ')}.` : `Ranked #${item.rank}: balanced fit for this request.`;
  };

  const formatContribution = (value) => Number(value || 0).toFixed(3);

  return (
    <section id="ai-recommendations" className="panel admin-focus-card">
      <div className="panel-header">
        <div>
          <h2 id="ai-recommendations-heading">AI recommendations <span className="result-count">{recommendations.length}</span></h2>
          <p className="subhead">Smart suggestions for the best matching provider hospitals.</p>
        </div>
        <span className="badge">Smart match</span>
      </div>
      <RecommendationMiniMap networkMap={networkMap} recommendations={recommendations} />
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
                </div>
                <div className="recommendation-meta" style={{ marginTop: 6 }}>
                  <span>Confidence: {(item.score ?? 0).toFixed(2)}/5</span>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#475569' }}>{makeReasonSummary(item)}</div>
                {item.rankingBasis ? (
                  <details style={{ marginTop: 8, fontSize: '0.82rem', color: '#334155' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Why this rank? Show scoring data</summary>
                    <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                      <div>Stock: {item.rankingBasis.stockQuantity} units · contribution {formatContribution(item.rankingBasis.scoreContributions?.stock)}</div>
                      <div>Distance: {item.rankingBasis.distance} km · contribution {formatContribution(item.rankingBasis.scoreContributions?.distance)}</div>
                      <div>Emergency readiness: {item.rankingBasis.emergencyStatus} · contribution {formatContribution(item.rankingBasis.scoreContributions?.emergency)}</div>
                      <div>
                        Response history: {item.rankingBasis.reliability?.completedResponses || 0} completed
                        {item.rankingBasis.reliability?.averageResponseHours != null
                          ? ` · ${item.rankingBasis.reliability.averageResponseHours}h average · ${Math.round((item.rankingBasis.reliability.approvalRate || 0) * 100)}% approval rate`
                          : ' · no measured response time'}
                        {' · '}contribution {formatContribution(item.rankingBasis.scoreContributions?.reliability)}
                      </div>
                      {item.rankingBasis.scoreContributions?.availabilityPenalty < 0 ? (
                        <div>Availability penalty: {formatContribution(item.rankingBasis.scoreContributions.availabilityPenalty)}</div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
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
