/**
 * ClientSidebar — quiet, generous, intentionally narrow surface.
 *
 * Phase R direction:
 *  - 7 nav items, no more (Panoramica · Il mio progetto · Moodboard ·
 *    Timeline · Approvazioni · File condivisi · Messaggi)
 *  - bottom helper card "Hai bisogno di aiuto?" with "Contatta lo studio"
 *  - Mood for Design wordmark top-left (gold/ivory, never teal)
 *  - active item: gold left bar + ivory text — no fill, no glow
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Folder, Layers, CalendarClock, ShieldCheck,
  FileText, MessageSquare,
} from 'lucide-react';

const NAV = [
  { to: '/client',            label: 'Panoramica',     icon: LayoutGrid,    end: true },
  { to: '/client/project',    label: 'Il mio progetto', icon: Folder },
  { to: '/client/moodboards', label: 'Moodboard',      icon: Layers },
  { to: '/client/timeline',   label: 'Timeline',       icon: CalendarClock },
  { to: '/client/approvals',  label: 'Approvazioni',   icon: ShieldCheck },
  { to: '/client/files',      label: 'File condivisi', icon: FileText },
  { to: '/client/messages',   label: 'Messaggi',       icon: MessageSquare },
];

const ClientSidebar = () => {
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

        {/* Nav */}
        <nav className="flex flex-col gap-1.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>

      {/* Bottom helper card */}
      <div data-testid="client-help-card"
           className="cp-card mt-12 p-5">
        <p className="font-heading text-[15px] text-[var(--cp-text-primary)] mb-1.5">
          Hai bisogno di aiuto?
        </p>
        <p className="text-[12.5px] text-[var(--cp-text-muted)] leading-relaxed mb-4">
          Siamo qui per te. Contatta il nostro team.
        </p>
        <button
          type="button"
          data-testid="client-contact-studio-btn"
          className="cp-cta-ghost w-full px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        >
          Contatta lo studio
        </button>
      </div>
    </aside>
  );
};

const NavItem = ({ to, label, icon: Icon, end }) => (
  <NavLink
    to={to}
    end={end}
    data-testid={`client-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
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
        {isActive && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] rounded-r-full bg-[var(--cp-gold)]"
          />
        )}
        <Icon size={16} strokeWidth={1.5} />
        <span className="tracking-[0.01em]">{label}</span>
      </>
    )}
  </NavLink>
);

export default ClientSidebar;
