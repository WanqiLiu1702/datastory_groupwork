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
  boroughOptions,
  visibleCount,
  routeTotal
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
        <h1>Hidden Heritage</h1>
        <p className="subtitle">London plaques that are official, accessible, but still easy to overlook.</p>
      </div>

      <div className="notice">
        <strong>Method.</strong> Core hidden sites are English Heritage plaques with no OSM tourism POI at the address,
        few nearby tourism POIs, and a walkable TfL station. Quiet hidden sites add greener, less road-dominated surroundings.
      </div>

      <div className="panel panel-sources">
        <h2>External Data</h2>
        <p className="panel-note">
          English Heritage provides the official plaque catalogue. TfL provides station access context. OSM provides
          tourism, green-space and road surroundings. The dashed line on the map marks the Greater London boundary.
        </p>
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

      <div className="panel panel-explorer">
        <h2>Explore Panels</h2>
        <div className="explorer-stats">
          <div className="explorer-pill">
            <strong>{visibleCount}</strong>
            <span>visible places</span>
          </div>
          <div className="explorer-pill">
            <strong>{routeTotal}</strong>
            <span>curated routes</span>
          </div>
        </div>
        <p className="panel-note">
          Use the floating <strong>Places</strong> and <strong>Routes</strong> buttons on the map to switch between the
          result drawer and the route drawer instead of scrolling through a long sidebar list.
        </p>
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
        <h2>Place Context</h2>
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

      <div className="panel panel-sources">
        <h2>Access & Travel</h2>
        <p className="panel-note">
          Popups and cards now show walk time from the nearest TfL station and an approach-quality label, so users can
          judge not just whether a site is reachable, but whether the journey is likely to feel quiet, mixed or busy.
        </p>
      </div>

      <div className="panel panel-sources">
        <h2>Impact of Popularity</h2>
        <p className="panel-note">
          Hidden sites can lose their hidden quality if too many visitors converge on the same residential streets.
          Routes here are curated rather than optimized for maximum footfall, and environmental context is shown to
          encourage slower, more respectful visits.
        </p>
      </div>
    </aside>
  );
}
