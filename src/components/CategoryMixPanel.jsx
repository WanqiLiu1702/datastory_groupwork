import React from 'react';
import { CAT_COLORS, CAT_LABELS } from '../constants.js';

export default function CategoryMixPanel({ items, total }) {
  const visibleItems = items
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  let cumulativeShare = 0;
  const segments = visibleItems.map(item => {
    const share = total ? item.count / total : 0;
    const midpoint = cumulativeShare + share / 2;
    cumulativeShare += share;

    return {
      ...item,
      share,
      midpoint
    };
  });

  return (
    <aside className="mix-rail">
      <div className="mix-rail-head">
        <div className="mix-rail-kicker">Visible mix</div>
        <div className="mix-rail-total">
          <strong>{total}</strong>
          <span>live sites</span>
        </div>
      </div>

      <div className="mix-rail-body">
        <div className="mix-rail-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>

        <div className="mix-rail-chart">
          <div className="mix-rail-grid">
            <span />
            <span />
            <span />
          </div>

          <div className="mix-rail-track">
            {segments.map(item => (
              <div
                key={item.key}
                className="mix-rail-segment"
                style={{
                  height: `${item.share * 100}%`,
                  background: CAT_COLORS[item.key] || '#7b8f87'
                }}
                title={`${CAT_LABELS[item.key] || item.key}: ${item.count}`}
              />
            ))}
          </div>

          <div className="mix-rail-labels">
            {segments.map(item => (
              <div
                key={item.key}
                className={'mix-rail-label' + (item.share < 0.12 ? ' compact' : '')}
                style={{
                  top: `${item.midpoint * 100}%`,
                  color: CAT_COLORS[item.key] || '#7b8f87'
                }}
                title={`${CAT_LABELS[item.key] || item.key}: ${item.count}`}
              >
                {CAT_LABELS[item.key] || item.key}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
