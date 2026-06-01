/**
 * RelationshipMemoryPage — full memory log placeholder.
 * Will be replaced by editorial timeline in Sprint B.
 */
import React from 'react';
import './client-relations.css';

const RelationshipMemoryPage = () => (
  <div className="cr-shell" data-testid="cr-memory-shell">
    <header className="cr-header">
      <p className="cr-header__eyebrow">CRM · ACTIVITY LOG</p>
      <h1 className="cr-header__title">Activity Log</h1>
      <p className="cr-header__lede">
        Ogni interazione viene registrata come attività CRM. La vista timeline arriverà nello Sprint successivo —
        per ora il log completo è disponibile dentro ogni Account.
      </p>
    </header>
    <div className="cr-empty">
      <p className="cr-empty__title">Activity timeline in arrivo.</p>
      <p className="cr-empty__sub">
        Le attività (designer reply · moodboard view · material save · style shift) vengono già registrate dal motore.
        La vista aggregata arriva in Sprint B.
      </p>
    </div>
  </div>
);
export default RelationshipMemoryPage;
