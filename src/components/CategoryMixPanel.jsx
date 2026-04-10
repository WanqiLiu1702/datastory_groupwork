import React from 'react';
import { CAT_COLORS, CAT_LABELS } from '../constants.js';

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function CategoryMixPanel({ items, total }) {
  const visibleItems = items.filter(item => item.count > 0);

  return (
    <div className="panel mix-panel">
      <div className="mix-panel-head">
        <div>
          <h2>Visible mix</h2>
          <p className="panel-note">The column responds to the current hidden, route, search and theme scope.</p>
        </div>
        <div className="mix-total">
          <strong>{total}</strong>
          <span>visible sites</span>
        </div>
      </div>

      <div className="mix-panel-body">
        <div className="mix-scale">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        <div className="mix-column-shell">
          <div className="mix-column-grid">
            <span />
            <span />
            <span />
          </div>
          <div className="mix-column">
            {visibleItems.map(item => (
              <div
                key={item.key}
                className="mix-segment"
                style={{
                  height: `${(item.count / Math.max(total, 1)) * 100}%`,
                  background: CAT_COLORS[item.key] || '#7b8f87'
                }}
                title={`${CAT_LABELS[item.key] || item.key}: ${item.count} (${percent(item.count, total)}%)`}
              />
            ))}
          </div>
        </div>

        <div className="mix-legend">
          {visibleItems.map(item => (
            <div key={item.key} className="mix-legend-row">
              <span className="mix-legend-swatch" style={{ background: CAT_COLORS[item.key] || '#7b8f87' }} />
              <span className="mix-legend-label">{CAT_LABELS[item.key] || item.key}</span>
              <span className="mix-legend-value">{percent(item.count, total)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
