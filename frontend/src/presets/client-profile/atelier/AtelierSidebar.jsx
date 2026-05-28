/**
 * AtelierSidebar · ITER162 · Welcome Panel Atelier™
 *
 * Sidebar narrativa, full-height, palette deep + bronze accents.
 * Nav editoriale: voci serif maiuscoletto-like, hover bronze.
 * Bottom: support block + identity card.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Map, MessageCircle, Sparkles, Layers,
  FileText, Calendar, ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'overview',     label: 'Panoramica',     to: '/client/welcome',   icon: LayoutGrid },
  { key: 'journey',      label: 'Il mio percorso', to: '/client/journeys', icon: Map },
  { key: 'conversation', label: 'Conversazioni',  to: '/client/messages', icon: MessageCircle, badge: 2 },
  { key: 'inspirations', label: 'Ispirazioni',    to: '/client/inspirations', icon: Sparkles },
  { key: 'materials',    label: 'Materiali',      to: '/client/materials', icon: Layers },
  { key: 'documents',    label: 'Documenti',      to: '/client/documents', icon: FileText },
  { key: 'appointments', label: 'Appuntamenti',   to: '/client/appointments', icon: Calendar },
];

const AtelierSidebar = ({ client, referente }) => {
  const { pathname } = useLocation();
  const fi = (client?.firstName || '·')[0] || '·';
  const li = (client?.lastName  || '')[0] || '';
  const initials = (fi + li).toUpperCase();

  return (
    <aside className="atelier-sidebar" data-testid="atelier-sidebar" aria-label="Spazio progettuale · navigazione">
      {/* Brand mark */}
      <div className="atelier-sidebar__brand" data-testid="atelier-sidebar-brand">
        <div className="atelier-brand__rings" aria-hidden>
          <span />
          <span />
        </div>
        <p className="atelier-brand__type">
          <span>MOOD</span>
          <em>for</em>
          <span>DESIGN</span>
        </p>
      </div>

      {/* Nav */}
      <nav className="atelier-sidebar__nav">
        {NAV_ITEMS.map((it) => {
          const Active = it.to === '/client/welcome' ? pathname === '/client/welcome' || pathname === '/client'
                                                     : pathname === it.to || pathname.startsWith(it.to + '/');
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              to={it.to}
              className={`atelier-nav__item ${Active ? 'is-active' : ''}`}
              data-testid={`atelier-nav-${it.key}`}
              aria-current={Active ? 'page' : undefined}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden />
              <span className="atelier-nav__label">{it.label}</span>
              {it.badge && (
                <span className="atelier-nav__badge" data-testid={`atelier-nav-badge-${it.key}`}>{it.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Support · «Hai domande?» */}
      {referente && (
        <div className="atelier-sidebar__support" data-testid="atelier-sidebar-support">
          <p className="atelier-sidebar__support-eyebrow">Hai domande?</p>
          <Link to="/client/messages"
                className="atelier-sidebar__support-card"
                data-testid="atelier-sidebar-support-cta">
            {referente.avatar_url ? (
              <img src={referente.avatar_url} alt="" className="atelier-sidebar__support-avatar" />
            ) : (
              <span className="atelier-sidebar__support-avatar atelier-sidebar__support-avatar--placeholder">
                {(referente.first_name || referente.name || '·')[0]}
              </span>
            )}
            <span className="atelier-sidebar__support-text">
              Scrivi al tuo referente
            </span>
            <span aria-hidden className="atelier-sidebar__support-chevron">›</span>
          </Link>
        </div>
      )}

      {/* Security card */}
      <div className="atelier-sidebar__security" data-testid="atelier-sidebar-security">
        <ShieldCheck size={14} strokeWidth={1.5} aria-hidden />
        <div>
          <p className="atelier-sidebar__security-title">Il tuo spazio è protetto</p>
          <p className="atelier-sidebar__security-sub">I tuoi dati sono al sicuro.</p>
        </div>
      </div>

      {/* Identity bottom */}
      <div className="atelier-sidebar__identity" data-testid="atelier-sidebar-identity">
        <span className="atelier-sidebar__identity-avatar" aria-hidden>{initials}</span>
        <div>
          <p className="atelier-sidebar__identity-name" data-testid="atelier-sidebar-identity-name">
            {client?.firstName} {client?.lastName || 'Bentornato'}
          </p>
          <p className="atelier-sidebar__identity-role">Client Profile</p>
        </div>
      </div>
    </aside>
  );
};

export default AtelierSidebar;
