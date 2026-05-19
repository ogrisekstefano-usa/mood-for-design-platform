/**
 * CockpitTimeline — Timeline operativa del Daily Design Operations Cockpit™.
 *
 * Non un log tecnico. Una timeline di studio creativo vivo:
 *   • upload media
 *   • nuove moodboard
 *   • new lead / new account
 *   • cultural editions avviate
 *   • follow-up registrati
 *   • inspirations salvate
 *
 * Fonti: `recent_activity[]` (server) + `timeline[]` (eventi calendar).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

const ICON_BY_TYPE = {
  moodboard:  'Layers',
  proposal:   'FileText',
  project:    'FolderOpen',
  lead:       'Sparkles',
  account:    'UserPlus',
  material:   'Gem',
  media:      'Image',
  edition:    'Globe',
  inspiration:'Bookmark',
  hotspot:    'Crosshair',
  followup:   'MessageCircle',
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.round(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h fa`;
  if (diff < 604800) return `${Math.round(diff / 86400)}g fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

const fmtDayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const isSame = d.toDateString() === today.toDateString();
  if (isSame) return 'Oggi';
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
};

const CockpitTimeline = ({ events = [], activity = [] }) => {
  // Merge in ordine cronologico — i recent_activity hanno già "timestamp"
  // mentre i timeline events hanno "date" (proposals due dates).
  const items = useMemo(() => {
    const merged = [];
    (activity || []).forEach((e) => {
      merged.push({
        kind:      'activity',
        type:      e.type,
        title:     e.title,
        subtitle:  e.subtitle,
        timestamp: e.timestamp,
        to:        e.to || null,
      });
    });
    (events || []).forEach((e) => {
      merged.push({
        kind:      'milestone',
        type:      e.kind || 'proposal',
        title:     e.title,
        subtitle:  e.subtitle || 'Milestone',
        timestamp: e.date,
        to:        e.to || null,
      });
    });
    return merged
      .filter((x) => x.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 12);
  }, [events, activity]);

  // Raggruppa per giorno
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = (it.timestamp || '').slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return [...map.entries()];
  }, [items]);

  return (
    <section className="cck-block" data-testid="cockpit-timeline">
      <header className="cck-block__head">
        <div>
          <p className="cck-block__eyebrow">Timeline operativa</p>
          <h3 className="cck-block__title">Il battito del tuo studio</h3>
        </div>
        <Link to="/workspace/calendar" className="cck-block__link" data-testid="cockpit-timeline-calendar">
          Calendario <Icons.ArrowUpRight size={11} />
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="cck-empty">
          <Icons.Activity size={22} strokeWidth={1.2} className="cck-empty__icon" />
          <p className="cck-empty__title">Studio in quiete creativa.</p>
          <p className="cck-empty__hint">Carica un riferimento o crea una moodboard per dare ritmo alla giornata.</p>
        </div>
      ) : (
        <div className="cck-tl">
          {grouped.map(([day, dayItems]) => (
            <div key={day} className="cck-tl-day">
              <p className="cck-tl-day__label">{fmtDayLabel(day)}</p>
              <ul className="cck-tl-day__items">
                {dayItems.map((it, i) => {
                  const Icon = Icons[ICON_BY_TYPE[it.type]] || Icons.Circle;
                  const body = (
                    <>
                      <span className="cck-tl-item__icon">
                        <Icon size={12} strokeWidth={1.6} />
                      </span>
                      <span className="cck-tl-item__body">
                        <span className="cck-tl-item__title">{it.title}</span>
                        {it.subtitle && <span className="cck-tl-item__sub">{it.subtitle}</span>}
                      </span>
                      <span className="cck-tl-item__time">{fmtRelative(it.timestamp)}</span>
                    </>
                  );
                  return it.to ? (
                    <Link key={i} to={it.to} className="cck-tl-item" data-testid={`cockpit-tl-item-${day}-${i}`}>{body}</Link>
                  ) : (
                    <div key={i} className="cck-tl-item" data-testid={`cockpit-tl-item-${day}-${i}`}>{body}</div>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default CockpitTimeline;
