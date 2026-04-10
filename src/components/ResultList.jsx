import React, { useEffect, useMemo, useState } from 'react';
import { CAT_LABELS, CONTEXT_LABELS } from '../constants.js';

function hiddenTag(properties) {
  if (properties.hidden_quiet) return 'Quiet hidden';
  if (properties.hidden_core) return 'Core hidden';
  return 'Official plaque';
}

export default function ResultList({ features, onSelect }) {
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [features]);

  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => {
      const scoreDelta = (b.properties.hidden_score || 0) - (a.properties.hidden_score || 0);
      if (scoreDelta !== 0) return scoreDelta;
      const envDelta = (b.properties.environment_score || 0) - (a.properties.environment_score || 0);
      if (envDelta !== 0) return envDelta;
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    });
  }, [features]);

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
        {features.length > visibleCount ? ` · showing first ${visibleCount}` : ''}
      </div>
      {sortedFeatures.slice(0, visibleCount).map(feature => {
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
              <span className="badge">{CONTEXT_LABELS[properties.place_context] || properties.place_context}</span>
              <span>{properties.borough}</span>
            </div>
            <div className="result-meta result-meta-secondary">
              <span
                className="env-dot"
                style={{ background: `var(--score-${properties.environment_score})` }}
              />
              <span>Quietness {properties.environment_score}/5</span>
              <span>
                {properties.walk_minutes_from_station == null || !properties.nearest_station
                  ? 'No nearby TfL station in current dataset'
                  : `${properties.walk_minutes_from_station} min walk from ${properties.nearest_station}`}
              </span>
            </div>
            <p className="result-reasons">
              {[properties.approach_quality, ...(properties.hidden_reasons || []).slice(0, 1)].filter(Boolean).join(' • ')}
            </p>
          </div>
        );
      })}
      {features.length > 12 ? (
        <div className="results-actions">
          {visibleCount < sortedFeatures.length ? (
            <button className="results-button" type="button" onClick={() => setVisibleCount(count => count + 12)}>
              Show 12 more
            </button>
          ) : (
            <button className="results-button secondary" type="button" onClick={() => setVisibleCount(12)}>
              Collapse list
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
