/**
 * ClientRelationsLayout · slim editorial shell.
 *
 * Provides: stage sub-nav (counts + accent strip), page eyebrow/title/lede,
 * and a content slot. Each stage page renders its OWN body (cards, lanes,
 * grids) — no shared "CRM grid".
 */
import React from 'react';
import RelationsStageNav from './RelationsStageNav';
import './client-relations.css';

const ClientRelationsLayout = ({
  stage,           // 'lead' | 'prospect' | 'account'
  eyebrow,
  title,
  lede,
  counts,
  toolbar,         // optional ReactNode rendered under the header (filters, etc.)
  children,        // page-specific body
}) => (
  <div className={`cr-shell cr-shell--${stage}`} data-testid={`cr-shell-${stage}`}>
    <RelationsStageNav counts={counts} active={stage} />

    <header className="cr-header" data-testid="cr-header">
      <p className="cr-header__eyebrow" data-testid="cr-header-eyebrow">{eyebrow}</p>
      <h1 className="cr-header__title" data-testid="cr-header-title">{title}</h1>
      {lede && <p className="cr-header__lede" data-testid="cr-header-lede">{lede}</p>}
    </header>

    {toolbar && (
      <div className="cr-toolbar" data-testid="cr-toolbar">
        {toolbar}
      </div>
    )}

    <div className="cr-body" data-testid="cr-body">
      {children}
    </div>

    <footer className="cr-footnote" data-testid="cr-footnote">
      <span>Client Relations™ · Designer surface · for internal use</span>
    </footer>
  </div>
);

export default ClientRelationsLayout;
