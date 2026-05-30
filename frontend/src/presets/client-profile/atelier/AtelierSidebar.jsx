/**
 * AtelierSidebar · ITER173 · Client Design Journey™ V1 consolidation
 *
 * Sidebar narrativa, full-height, palette deep + bronze accents.
 * Nav editoriale: voci serif maiuscoletto-like, hover bronze.
 *
 * ITER173 (P0.2 + P0.3):
 *   · ROUTE pulite: ogni voce punta a una route effettivamente montata.
 *   · BADGE Conversazioni: conteggio REALE da /api/conversation/threads,
 *     somma di `unread` per i thread del client. Niente più "2" hardcoded.
 *   · Voci legacy rimosse (Ispirazioni / Materiali / Documenti /
 *     Appuntamenti) — riapparenanno solo quando esisterà la rispettiva
 *     route reale.
 *
 * Bottom: support block + identity card.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Sparkles, MessageCircle } from 'lucide-react';
import api from '../../../lib/api';
import { initialsOf } from '../../../lib/initials';

const NAV_ITEMS = [
  { key: 'overview',     label: 'Panoramica',          to: '/client/welcome',  icon: LayoutGrid },
  { key: 'brief',        label: 'Brief Guidato™',     to: 'brief',            icon: Sparkles,      requiresJourney: true },
  { key: 'conversation', label: 'Conversazioni',       to: '/client/messages', icon: MessageCircle, isConversations: true },
];

const AtelierSidebar = ({ client, referente, journeyId }) => {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  // ITER173 · poll thread unread count (5s) for the Conversations badge.
  useEffect(() => {
    let alive = true;
    let timer = null;

    const fetchUnread = () => {
      api.get('/api/conversation/threads')
        .then((r) => {
          if (!alive) return;
          const list = r?.data?.data || [];
          const total = list.reduce((acc, t) => acc + (Number(t.unread) || 0), 0);
          setUnread(total);
        })
        .catch(() => { /* silently degrade — no badge rather than wrong badge */ });
    };

    fetchUnread();
    timer = setInterval(fetchUnread, 30000); // 30s polling on sidebar (lighter than ConversationSurface 5s)
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, []);

  const resolveHref = (it) => {
    if (it.requiresJourney) {
      return journeyId ? `/journey/${journeyId}/${it.to}` : null;
    }
    return it.to;
  };

  return (
    <aside className="atelier-sidebar" data-testid="atelier-sidebar" aria-label="Spazio progettuale · navigazione">
      {/* Brand mark · logo MOOD for DESIGN */}
      <div className="atelier-sidebar__brand" data-testid="atelier-sidebar-brand">
        <img
          src="/atelier-logo.png"
          alt="MOOD for DESIGN · Inspiration. Design. Solutions."
          className="atelier-sidebar__brand-img"
          loading="eager"
          decoding="sync"
        />
      </div>

      {/* Nav */}
      <nav className="atelier-sidebar__nav">
        {NAV_ITEMS.map((it) => {
          const href = resolveHref(it);
          if (!href) return null;
          const isOverview = it.key === 'overview';
          const Active = isOverview
            ? (pathname === '/client/welcome' || pathname === '/client' || pathname.startsWith('/journey/') && !pathname.endsWith('/brief'))
            : (pathname === href || pathname.startsWith(href + '/') ||
               (it.key === 'brief' && pathname.endsWith('/brief')));
          const Icon = it.icon;
          const badge = it.isConversations && unread > 0 ? unread : null;
          return (
            <Link
              key={it.key}
              to={href}
              className={`atelier-nav__item ${Active ? 'is-active' : ''}`}
              data-testid={`atelier-nav-${it.key}`}
              aria-current={Active ? 'page' : undefined}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden />
              <span className="atelier-nav__label">{it.label}</span>
              {badge && (
                <span className="atelier-nav__badge" data-testid={`atelier-nav-badge-${it.key}`}>{badge}</span>
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
              <span
                className="atelier-sidebar__support-avatar atelier-sidebar__support-avatar--placeholder"
                aria-hidden
              >
                {initialsOf(referente)}
              </span>
            )}
            <span className="atelier-sidebar__support-text">
              Scrivi al tuo referente
            </span>
            <span aria-hidden className="atelier-sidebar__support-chevron">›</span>
          </Link>
        </div>
      )}
    </aside>
  );
};

export default AtelierSidebar;
