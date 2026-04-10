import React from 'react';
import { CAT_LABELS } from '../constants.js';

function hiddenTag(properties) {
  if (properties.hidden_quiet) return 'Quiet hidden';
  if (properties.hidden_core) return 'Core hidden';
  return 'Official plaque';
}

export default function ResultList({ features, onSelect }) {
  if (!features.length) {
    return (
      <div className="results">
        <div className="result-count">No results. Widen the hidden or borough filters.</div>
      </div>
    );
  }

  return (
    <div className="results">
      <div className="result-count">
        {features.length} place{features.length === 1 ? '' : 's'} match
      </div>
      {features.map(feature => {
        const properties = feature.properties;
        return (
          <div
            key={properties.id}
            className="result-card"
            onClick={() => onSelect(properties.id)}
          >
            <p className="result-name">{properties.name}</p>
            <div className="result-meta">
              <span className="badge badge-hidden">{hiddenTag(properties)}</span>
              <span className="badge">{CAT_LABELS[properties.category]}</span>
              <span>{properties.borough}</span>
            </div>
            <div className="result-meta result-meta-secondary">
              <span
                className="env-dot"
                style={{ background: `var(--score-${properties.environment_score})` }}
              />
              <span>Quietness {properties.environment_score}/5</span>
              <span>{properties.station_distance_m}m to {properties.nearest_station}</span>
            </div>
            <p className="result-reasons">
              {(properties.hidden_reasons || []).slice(0, 2).join(' • ')}
            </p>
          </div>
        );
      })}
    </div>
  );
}
