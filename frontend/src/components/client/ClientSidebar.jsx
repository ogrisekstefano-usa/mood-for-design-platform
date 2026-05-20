/**
 * ClientSidebar v2 — Sprint G.7 (Journey-first Companion).
 *
 * Il cliente NON entra in un dashboard SaaS. Entra nel proprio Journey.
 * La sidebar riflette le 7 sezioni del Companion Experience™.
 *
 *   01 · I miei Journey™
 *   02 · Capitolo attivo™         (link contestuale al companion)
 *   03 · Direzioni condivise™     (anchor section nel companion)
 *   04 · Conversazioni™
 *   05 · Evolution Timeline™
 *   06 · Materia & Atmosfere™
 *   07 · Memoria & Archivio™
 *
 * Nessun riferimento a SaaS PM / queue di gestione / file repo.
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Compass, Sparkles, Layers, MessageSquareQuote,
  Clock4, Palette, Archive, HardHat,
} from 'lucide-react';

const NAV = [
  { to: '/client',                  label: 'I miei Journey',     icon: Compass,           hasMark: true, end: true },
  { to: '/client#capitolo',         label: 'Capitolo attivo',    icon: Sparkles,          hasMark: true, anchor: 'capitolo' },
  { to: '/client#direzioni',        label: 'Direzioni condivise', icon: Layers,           hasMark: true, anchor: 'direzioni' },
  { to: '/client#conversazioni',    label: 'Conversazioni',      icon: MessageSquareQuote, hasMark: true, anchor: 'conversazioni' },
  { to: '/client#evoluzione',       label: 'Evolution Timeline', icon: Clock4,            hasMark: true, anchor: 'evoluzione' },
  { to: '/client#materia',          label: 'Materia & Atmosfere', icon: Palette,          hasMark: true, anchor: 'materia' },
  { to: '/client#cantiere',         label: 'Site Evolution',     icon: HardHat,           hasMark: true, anchor: 'cantiere' },
  { to: '/client#memoria',          label: 'Memoria & Archivio', icon: Archive,           hasMark: true, anchor: 'memoria' },
];

const ClientSidebar = () => {
  const location = useLocation();
  const onCompanion = location.pathname.startsWith('/client/journey/');

  return (
    <aside
      data-testid="client-sidebar"
      className="w-[260px] shrink-0 flex flex-col justify-between
                 border-r border-[var(--cp-border)]
                 bg-[var(--cp-bg)]
                 px-7 py-9"
    >
      {/* Brand */}
      <div className="space-y-12">
        <div data-testid="client-brand" className="select-none">
          <p className="font-heading text-[26px] leading-[0.95] tracking-[-0.01em] text-[var(--cp-text-primary)]">
            MOOD
          </p>
          <p className="font-heading text-[15px] leading-[1] tracking-[0.32em] text-[var(--cp-gold)] mt-1 uppercase">
            for DESIGN
          </p>
        </div>

        {/* Section eyebrow */}
        <p className="text-[9.5px] tracking-[0.30em] uppercase font-mono text-[var(--cp-text-muted)] -mb-3">
          Il tuo percorso
        </p>

        {/* Nav — Journey Companion sections */}
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavItem key={item.label} {...item} disabledAnchor={!onCompanion && !!item.anchor} />
          ))}
        </nav>
      </div>

      {/* Bottom helper card */}
      <div data-testid="client-help-card"
           className="cp-card mt-12 p-5">
        <p className="font-heading text-[15px] text-[var(--cp-text-primary)] mb-1.5">
          Vuoi raccontarci qualcosa?
        </p>
        <p className="text-[12.5px] text-[var(--cp-text-muted)] leading-relaxed mb-4">
          Il tuo studio è in ascolto, sempre.
        </p>
        <button
          type="button"
          data-testid="client-contact-studio-btn"
          className="cp-cta-ghost w-full px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        >
          Scrivi al tuo studio
        </button>
      </div>
    </aside>
  );
};

const NavItem = ({ to, label, icon: Icon, end, hasMark, anchor, disabledAnchor }) => {
  // Anchor links resolve to the active companion. When no companion is
  // open, hash navigation lands on /client and harmlessly scrolls (or noop).
  const target = anchor && disabledAnchor ? '/client' : to;
  return (
    <NavLink
      to={target}
      end={end}
      data-testid={`client-nav-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
      className={({ isActive }) =>
        `relative flex items-center gap-3 py-2.5 pl-3 pr-2 rounded-[10px]
         text-[13px] font-body transition-colors duration-200
         ${isActive
           ? 'text-[var(--cp-text-primary)]'
           : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)]'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !anchor && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] rounded-r-full bg-[var(--cp-gold)]"
            />
          )}
          <Icon size={15} strokeWidth={1.5} />
          <span className="tracking-[0.01em]">
            {label}
            {hasMark && <span className="ml-0.5 text-[var(--cp-gold)]">™</span>}
          </span>
        </>
      )}
    </NavLink>
  );
};

export default ClientSidebar;
