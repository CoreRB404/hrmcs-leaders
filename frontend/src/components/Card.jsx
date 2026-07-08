import React from 'react';

function Card({ title, value, icon, tone, highlight }) {
  const isHighlight = highlight || title === 'Hospitals';

  return (
    <div className={`card ${isHighlight ? 'highlight' : ''} ${tone ? `tone-${tone}` : ''}`}>
      {icon && <div className={`card-icon ${tone || ''}`}>{icon}</div>}
      <div className="label">{title}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default Card;
