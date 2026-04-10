import React, { useMemo, useState } from 'react';
import { CAT_LABELS } from '../constants.js';

function displayLabel(mode, key) {
  if (mode === 'category') {
    return CAT_LABELS[key] || key;
  }
  return key;
}

export default function RankingPanel({
  boroughRanking,
  categoryRanking,
  currentBorough,
  currentCategory,
  onSelectBorough,
  onSelectCategory
}) {
  const [mode, setMode] = useState('borough');
  const ranking = mode === 'borough' ? boroughRanking : categoryRanking;
  const currentSelection =
    mode === 'borough'
      ? currentBorough
      : currentCategory === 'all'
        ? []
        : Array.isArray(currentCategory)
          ? currentCategory
          : [currentCategory];

  const items = useMemo(() => {
    const sliced = ranking.slice(0, 6);
    if (mode === 'borough') {
      if (currentSelection === 'all' || sliced.some(item => item.key === currentSelection)) {
        return sliced;
      }
      const currentItem = ranking.find(item => item.key === currentSelection);
      return currentItem ? [...sliced, currentItem] : sliced;
    }

    if (!currentSelection.length || currentSelection.every(key => sliced.some(item => item.key === key))) {
      return sliced;
    }

    const extras = ranking.filter(item => currentSelection.includes(item.key) && !sliced.some(entry => entry.key === item.key));
    return [...sliced, ...extras];
  }, [currentSelection, mode, ranking]);

  const max = items[0]?.count || 1;

  return (
    <div className="panel">
      <div className="ranking-head">
        <h2>Top patterns</h2>
        <div className="ranking-tabs">
          <button
            type="button"
            className={'ranking-tab' + (mode === 'borough' ? ' active' : '')}
            onClick={() => setMode('borough')}
          >
            Boroughs
          </button>
          <button
            type="button"
            className={'ranking-tab' + (mode === 'category' ? ' active' : '')}
            onClick={() => setMode('category')}
          >
            Heritage themes
          </button>
        </div>
      </div>

      <div className="ranking-list">
        {items.map(item => {
          const ratio = Math.max(12, Math.round((item.count / max) * 100));
          const dotCount = Math.max(3, Math.min(18, Math.round((item.count / max) * 16)));
          const active =
            mode === 'borough'
              ? item.key === currentSelection && currentSelection !== 'all'
              : currentSelection.includes(item.key);
          const handleClick =
            mode === 'borough'
              ? () => onSelectBorough(active ? 'all' : item.key)
              : () => onSelectCategory(active ? 'all' : item.key);

          return (
            <button
              key={item.key}
              type="button"
              className={'ranking-item' + (active ? ' active' : '')}
              onClick={handleClick}
            >
              <div className="ranking-item-head">
                <span className="ranking-label">{displayLabel(mode, item.key)}</span>
                <span className="ranking-count">{item.count}</span>
              </div>
              <span className="ranking-bar-track">
                <span className="ranking-bar-fill" style={{ width: `${ratio}%` }}>
                  <span className="ranking-dot-cluster">
                    {Array.from({ length: dotCount }).map((_, index) => (
                      <span key={index} className="ranking-heritage-dot" />
                    ))}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="panel-note">Click a bar to filter. Rankings respond to the current hidden, route and search scope.</p>
    </div>
  );
}
