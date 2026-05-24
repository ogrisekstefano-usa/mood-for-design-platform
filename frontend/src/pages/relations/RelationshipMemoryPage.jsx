/**
 * RelationshipMemoryPage — full memory log placeholder.
 * Will be replaced by editorial timeline in Sprint B.
 */
import React from 'react';
import './client-relations.css';

const RelationshipMemoryPage = () => (
  <div className="cr-shell" data-testid="cr-memory-shell">
    <header className="cr-header">
      <p className="cr-header__eyebrow">CLIENT RELATIONS\u2122 · MEMORY</p>
      <h1 className="cr-header__title">Relationship Memory</h1>
      <p className="cr-header__lede">
        Ogni interazione diventa memoria progettuale. La timeline editoriale arriverà nello Sprint successivo —
        per ora il log completo è disponibile dentro ogni Account.
      </p>
    </header>
    <div className="cr-empty">
      <p className="cr-empty__title">Memory timeline coming next.</p>
      <p className="cr-empty__sub">
        Le interazioni narrative (designer reply · moodboard view · material save · atmosphere shift) si stanno già scrivendo
        nel motore. La vista editoriale aggregata arriva in Sprint B.
      </p>
    </div>
  </div>
);
export default RelationshipMemoryPage;
