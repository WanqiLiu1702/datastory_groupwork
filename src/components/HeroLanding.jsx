import React from 'react';
import IntroMap from './IntroMap.jsx';
import { ROUTE_PERSONAS } from '../constants.js';

export default function HeroLanding({
  boundary,
  heroFeatures,
  counts,
  routeDefs,
  routeAudience,
  routePersonaCounts,
  onChoosePersona,
  onExploreMap,
  onOpenPlaces,
  onOpenRoutes,
  onOpenStories,
  onOpenAbout
}) {
  return (
    <section className="hero-section">
      <IntroMap boundary={boundary} features={heroFeatures} />
      <div className="hero-scrim" />

      <div className="hero-content">
        <div className="hero-copy">
          <div className="hero-kicker">Hidden heritage discovery prototype</div>
          <h1>GemMap: London’s Hidden Heritage Beyond Guidebooks</h1>
          <p className="hero-lead">
            Official English Heritage blue plaques, re-read through visibility, TfL access and quieter surroundings to reveal
            cultural sites that matter but are often missing from mainstream visitor flows.
          </p>

          <div className="hero-method-inline">
            <div className="hero-route-kicker">Method snapshot</div>
            <p>
              English Heritage plaques + TfL access + OSM tourism, green and road context. Full data notes sit under
              <button type="button" className="hero-inline-link" onClick={onOpenAbout}>
                About us
              </button>
              .
            </p>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{counts.official}</strong>
              <span>official plaques</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.core}</strong>
              <span>core hidden</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.quiet}</strong>
              <span>quiet hidden</span>
            </div>
            <div className="hero-stat">
              <strong>{Object.keys(routeDefs).length}</strong>
              <span>guided routes</span>
            </div>
          </div>

          <button type="button" className="hero-button hero-button-primary hero-button-wide" onClick={onExploreMap}>
            Scroll into map explorer
          </button>
        </div>

        <div className="hero-menu">
          <button type="button" className="hero-menu-card" onClick={onOpenPlaces}>
            <span className="hero-menu-kicker">01</span>
            <strong>Explore Hidden Gems</strong>
            <p>Search, filter and compare hidden heritage through theme, context, borough and quietness.</p>
            <span className="hero-menu-meta">Places-first mode</span>
          </button>

          <div className="hero-menu-card hero-menu-card-route">
            <span className="hero-menu-kicker">02</span>
            <strong>Plan Your Route</strong>
            <p>Open route mode and move through persona-led walks with real street-level path previews.</p>
            <div className="hero-persona-mini-grid">
              {ROUTE_PERSONAS.map(persona => (
                <button
                  key={persona.id}
                  type="button"
                  className={'hero-persona-mini' + (routeAudience === persona.id ? ' active' : '')}
                  style={{ '--hero-persona-accent': persona.accent }}
                  onClick={() => {
                    onChoosePersona(persona.id);
                    onOpenRoutes(persona.id);
                  }}
                >
                  <span>{persona.shortLabel}</span>
                  <strong>{routePersonaCounts[persona.id] || 0}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="hero-menu-link" onClick={() => onOpenRoutes()}>
              Open all {Object.keys(routeDefs).length} guided routes
            </button>
          </div>

          <button type="button" className="hero-menu-card" onClick={onOpenStories}>
            <span className="hero-menu-kicker">03</span>
            <strong>Uncover Stories</strong>
            <p>Suggest overlooked heritage sites that are missing from the current map and place them on London yourself.</p>
            <span className="hero-menu-meta">Contribution prototype</span>
          </button>

          <button type="button" className="hero-menu-card" onClick={onOpenAbout}>
            <span className="hero-menu-kicker">04</span>
            <strong>About us</strong>
            <p>See the data sources, filtering method and the social implications behind recommending hidden places.</p>
            <span className="hero-menu-meta">Data + method + reflection</span>
          </button>
        </div>
      </div>

      <div className="hero-scroll-row">
        <button type="button" className="hero-scroll-cue" onClick={onExploreMap}>
          Scroll into map
        </button>
        <button type="button" className="hero-scroll-cue hero-scroll-cue-muted" onClick={onOpenAbout}>
          Jump to data and method
        </button>
      </div>
    </section>
  );
}
