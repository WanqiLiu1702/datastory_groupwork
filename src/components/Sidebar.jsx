import React from 'react';
import {
  CAT_COLORS,
  CAT_LABELS,
  CONTEXT_COLORS,
  CONTEXT_LABELS,
  HIDDEN_DESCRIPTIONS,
  HIDDEN_LABELS
} from '../constants.js';

export default function Sidebar({
  counts,
  filters,
  setFilters,
  boroughOptions
}) {
  const setHidden = value => setFilters(current => ({ ...current, hidden: value, route: 'all' }));
  const setType = value => setFilters(current => ({ ...current, category: value }));
  const setContext = value => setFilters(current => ({ ...current, context: value }));
  const setBorough = value => setFilters(current => ({ ...current, borough: value }));
  const setMinEnv = value => setFilters(current => ({ ...current, minEnv: value }));
  const setSearch = value => setFilters(current => ({ ...current, search: value }));

  const Chip = ({ value, label, current, onClick, swatch }) => (
    <span
      className={'chip' + (current === value ? ' active' : '')}
      onClick={() => onClick(value)}
    >
      {label}
      {swatch ? <span className="chip-swatch" style={{ background: swatch }} /> : null}
    </span>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>GemMap</h1>
        <p className="subtitle">London’s Hidden Heritage Beyond Guidebooks</p>
      </div>

      <div className="stats-grid panel">
        <div className="stat-card">
          <span className="stat-label">Official EH plaques</span>
          <strong>{counts.official}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Core hidden</span>
          <strong>{counts.core}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Quiet hidden</span>
          <strong>{counts.quiet}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Hidden definition</h2>
        <div className="chip-row">
          {Object.entries(HIDDEN_LABELS).map(([key, label]) => (
            <Chip key={key} value={key} label={label} current={filters.hidden} onClick={setHidden} />
          ))}
        </div>
        <p className="panel-note">{HIDDEN_DESCRIPTIONS[filters.hidden]}</p>
      </div>

      <div className="panel">
        <h2>Search</h2>
        <input
          className="search-input"
          type="search"
          placeholder="Person, profession, borough..."
          value={filters.search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>

      <div className="panel">
        <h2>Theme</h2>
        <div className="chip-row">
          <Chip value="all" label="All" current={filters.category} onClick={setType} />
          {Object.entries(CAT_LABELS).map(([key, label]) => (
            <Chip
              key={key}
              value={key}
              label={label}
              current={filters.category}
              onClick={setType}
              swatch={CAT_COLORS[key]}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Context</h2>
        <div className="chip-row">
          <Chip value="all" label="All contexts" current={filters.context} onClick={setContext} />
          {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
            <Chip
              key={key}
              value={key}
              label={label}
              current={filters.context}
              onClick={setContext}
              swatch={CONTEXT_COLORS[key]}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Borough</h2>
        <select
          className="select-input"
          value={filters.borough}
          onChange={event => setBorough(event.target.value)}
        >
          <option value="all">All boroughs</option>
          {boroughOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="panel">
        <h2>Quietness</h2>
        <div className="slider-row">
          <span>1</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={filters.minEnv}
            onChange={event => setMinEnv(parseInt(event.target.value, 10))}
          />
          <span>5</span>
          <span className="slider-value">{filters.minEnv}</span>
        </div>
      </div>
    </aside>
  );
}
