import React from 'react';
import RankingPanel from './RankingPanel.jsx';
import {
  CAT_COLORS,
  CAT_LABELS,
  CONTEXT_COLORS,
  CONTEXT_LABELS,
  HIDDEN_DESCRIPTIONS,
  HIDDEN_LABELS,
  ROUTE_PERSONAS
} from '../constants.js';

export default function Sidebar({
  counts,
  filters,
  setFilters,
  boroughOptions,
  boroughRanking,
  categoryRanking,
  onOpenPlaces,
  onOpenRoutes
}) {
  const setHidden = value => setFilters(current => ({ ...current, hidden: value, route: 'all' }));
  const setType = value =>
    setFilters(current => {
      if (value === 'all') {
        return { ...current, category: 'all' };
      }

      const currentValues =
        current.category === 'all'
          ? []
          : Array.isArray(current.category)
            ? current.category
            : [current.category];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter(item => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        category: nextValues.length ? nextValues : 'all'
      };
    });
  const setContext = value => setFilters(current => ({ ...current, context: value }));
  const setBorough = value => setFilters(current => ({ ...current, borough: value }));
  const setMinEnv = value => setFilters(current => ({ ...current, minEnv: value }));
  const setSearch = value => setFilters(current => ({ ...current, search: value }));

  const isThemeActive = value => {
    if (value === 'all') return filters.category === 'all';
    if (filters.category === 'all') return false;
    return Array.isArray(filters.category)
      ? filters.category.includes(value)
      : filters.category === value;
  };

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
        <h1>Map explorer</h1>
        <p className="subtitle">Browse places directly or switch into a route-first guide.</p>
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

      <div className="panel route-launch-panel">
        <div className="route-launch-copy">
          <h2>Explore mode</h2>
          <div className="route-mode-row">
            <button type="button" className="route-mode-pill route-mode-pill-secondary" onClick={onOpenPlaces}>
              Places
            </button>
            <button type="button" className="route-mode-pill" onClick={() => onOpenRoutes()}>
              Route guide
            </button>
          </div>
        </div>
        <div className="route-persona-shortcuts">
          {ROUTE_PERSONAS.map(persona => (
            <button
              key={persona.id}
              type="button"
              className="route-persona-shortcut"
              style={{ '--persona-accent': persona.accent }}
              onClick={() => onOpenRoutes(persona.id)}
            >
              {persona.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Hidden definition</h2>
        <div className="chip-row">
          {Object.entries(HIDDEN_LABELS).map(([key, label]) => (
            <Chip key={key} value={key} label={label} current={filters.hidden} onClick={setHidden} />
          ))}
        </div>
        <div className="panel-caption">{HIDDEN_DESCRIPTIONS[filters.hidden]}</div>
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
          <span className={'chip' + (isThemeActive('all') ? ' active' : '')} onClick={() => setType('all')}>
            All
          </span>
          {Object.entries(CAT_LABELS).map(([key, label]) => {
            const active = isThemeActive(key);
            return (
              <span
                key={key}
                className={'chip' + (active ? ' active' : '')}
                onClick={() => setType(key)}
              >
                {label}
                <span className="chip-swatch" style={{ background: CAT_COLORS[key] }} />
              </span>
            );
          })}
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

      <RankingPanel
        boroughRanking={boroughRanking}
        categoryRanking={categoryRanking}
        currentBorough={filters.borough}
        currentCategory={filters.category}
        onSelectBorough={setBorough}
        onSelectCategory={setType}
      />
    </aside>
  );
}
