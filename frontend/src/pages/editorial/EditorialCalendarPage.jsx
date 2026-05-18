/**
 * Editorial Calendar™ — International Editorial Operations™.
 *
 * The new operational heart of the platform. ONE view that shows:
 *   • what is publishing
 *   • where (market + locale)
 *   • when (datetime + timezone-aware)
 *   • why (CTA target + SEO goal)
 *   • approval/publish state
 *
 * Monthly grid + weekly stream + per-market live presence table.
 * No conceptual AI metaphors — pure publishing operations.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './editorialCalendar.css';

const TYPE_LABEL = {
  article: 'Magazine',
  project: 'Project',
  page:    'Storefront page',
};

const STATUS_TONE = {
  published: 'live',
  draft:     'draft',
  scheduled: 'scheduled',
  archived:  'archived',
};

const fmtMonth = (date, locale = 'it-IT') =>
  date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
const fmtDay = (date, locale = 'it-IT') =>
  date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (date) =>
  date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const buildMonthGrid = (cursor) => {
  // Returns 42 cells (6 weeks) for the month containing `cursor`, week starts Monday.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

// ───────────────────────────────────────────────────────────────────────
// TODAY'S INTERNATIONAL PRESENCE
// ───────────────────────────────────────────────────────────────────────
const PresenceTable = ({ byMarket }) => {
  if (!byMarket || byMarket.length === 0) {
    return (
      <div className="ec-presence ec-presence--empty">
        <p>Nessun mercato con eventi nella finestra corrente.</p>
      </div>
    );
  }
  return (
    <div className="ec-presence" data-testid="ec-presence">
      <div className="ec-presence__head">
        <span style={{ flex: '0 0 50px' }}>Flag</span>
        <span style={{ flex: 1 }}>Market</span>
        <span style={{ flex: '0 0 70px' }}>Today</span>
        <span style={{ flex: '0 0 100px' }}>Scheduled</span>
        <span style={{ flex: '0 0 100px' }}>Published</span>
      </div>
      {byMarket.map((m) => (
        <div className="ec-presence__row" key={m.code} data-testid={`ec-market-${m.code}`}>
          <span className="ec-presence__flag" style={{ flex: '0 0 50px' }}>{m.flag}</span>
          <span className="ec-presence__country" style={{ flex: 1 }}>{m.country}</span>
          <span className="ec-presence__cell" style={{ flex: '0 0 70px' }} data-emphasis={m.today > 0}>{m.today}</span>
          <span className="ec-presence__cell" style={{ flex: '0 0 100px' }}>{m.scheduled}</span>
          <span className="ec-presence__cell" style={{ flex: '0 0 100px' }}>{m.published}</span>
        </div>
      ))}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// EVENT PILL (inside calendar cell)
// ───────────────────────────────────────────────────────────────────────
const EventPill = ({ event }) => {
  const tone = STATUS_TONE[event.status] || 'draft';
  return (
    <Link to={event.edit_href || '#'} className="ec-pill" data-tone={tone}
          data-testid={`ec-pill-${event.id}`}
          title={`${TYPE_LABEL[event.type]} · ${event.title}\n${event.country.country} · ${event.locale}\n${event.cta_target}`}>
      <span className="ec-pill__flag" aria-hidden>{event.country.flag}</span>
      <span className="ec-pill__time">{fmtTime(new Date(event.datetime))}</span>
      <span className="ec-pill__title">{event.title}</span>
    </Link>
  );
};

// ───────────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────────
const EditorialCalendarPage = () => {
  const [cursor, setCursor] = useState(() => new Date());
  const [feed, setFeed]     = useState({ events: [], by_market: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      // Window: first day of cursor month -14 → last day of month +14
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const start = new Date(monthStart); start.setDate(start.getDate() - 7);
      const end   = new Date(monthEnd);   end.setDate(end.getDate() + 7);
      const params = new URLSearchParams({
        start: start.toISOString(),
        end:   end.toISOString(),
      });
      if (typeFilter !== 'all') params.set('type_filter', typeFilter);
      const { data } = await api.get(`/api/blueprint/calendar?${params}`);
      setFeed(data);
    } catch (e) {
      toast.error("Errore nel caricamento dell'agenda editoriale");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor, typeFilter]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map();
    (feed.events || []).forEach((ev) => {
      const d = new Date(ev.datetime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    });
    return map;
  }, [feed.events]);

  const today = new Date();
  const monthIdx = cursor.getMonth();
  const weekHeader = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const totals = feed.totals || {};

  return (
    <div className="ec-stage" data-testid="editorial-calendar-page">
      <header className="ec-head">
        <p className="ec-head__eyebrow">Blueprint · International Editorial Operations</p>
        <h1 className="ec-head__title">Editorial Calendar<sup>™</sup></h1>
        <p className="ec-head__intro">
          La regia operativa internazionale dello studio. Cosa esce, dove, quando, in quale lingua,
          con quale CTA — in un unico stream. Niente AI experimentation, niente metaforiche editoriali:
          solo la regia editoriale che pubblica per i mercati.
        </p>
      </header>

      {/* Today's International Presence */}
      <section className="ec-section">
        <p className="ec-section__kicker">Today's International Presence</p>
        <h2 className="ec-section__title">Cosa sta accadendo ora nei tuoi mercati</h2>
        <PresenceTable byMarket={feed.by_market} />
      </section>

      {/* Filters + Month nav */}
      <section className="ec-section ec-section--calendar">
        <div className="ec-toolbar">
          <div className="ec-toolbar__nav">
            <button type="button" className="ec-icon-btn"
                    onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx - 1, 1))}
                    data-testid="ec-prev"><ChevronLeft size={14} /></button>
            <button type="button" className="ec-month" onClick={() => setCursor(new Date())}
                    data-testid="ec-today">
              <Calendar size={12} strokeWidth={1.7} /> {fmtMonth(cursor)}
            </button>
            <button type="button" className="ec-icon-btn"
                    onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx + 1, 1))}
                    data-testid="ec-next"><ChevronRight size={14} /></button>
          </div>
          <div className="ec-toolbar__filters">
            <Filter size={11} strokeWidth={1.7} />
            {['all', 'article', 'project', 'page'].map((t) => (
              <button key={t} type="button" className="ec-chip"
                      data-active={typeFilter === t}
                      data-testid={`ec-filter-${t}`}
                      onClick={() => setTypeFilter(t)}>
                {t === 'all' ? 'Tutti' : TYPE_LABEL[t]}
              </button>
            ))}
            <button type="button" className="ec-chip ec-chip--ghost" onClick={load} disabled={loading}
                    data-testid="ec-refresh">
              <RefreshCw size={10} strokeWidth={1.7} className={loading ? 'ec-spin' : ''} /> Refresh
            </button>
          </div>
          <div className="ec-toolbar__totals">
            <span data-testid="ec-total-events">{totals.events ?? 0} eventi</span>
            <span data-tone="live">{totals.published ?? 0} live</span>
            <span data-tone="draft">{totals.scheduled ?? 0} in coda</span>
            <span>{totals.markets ?? 0} mercati</span>
          </div>
        </div>

        {/* Month grid */}
        <div className="ec-grid">
          <div className="ec-grid__head">
            {weekHeader.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="ec-grid__body">
            {grid.map((day) => {
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const evts = eventsByDay.get(key) || [];
              const inMonth = day.getMonth() === monthIdx;
              const isToday = day.toDateString() === today.toDateString();
              return (
                <div key={key} className="ec-cell"
                     data-out={!inMonth}
                     data-today={isToday}
                     data-testid={`ec-cell-${key}`}>
                  <div className="ec-cell__date">
                    <span className="ec-cell__day">{day.getDate()}</span>
                    {isToday && <span className="ec-cell__today-chip">OGGI</span>}
                  </div>
                  <div className="ec-cell__events">
                    {evts.slice(0, 3).map((ev) => <EventPill key={ev.id} event={ev} />)}
                    {evts.length > 3 && (
                      <span className="ec-cell__more">+{evts.length - 3} altri</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stream (next 7 days) */}
      <section className="ec-section">
        <p className="ec-section__kicker">Stream operativo</p>
        <h2 className="ec-section__title">Cosa esce nei prossimi 7 giorni</h2>
        <div className="ec-stream">
          {(feed.events || []).filter((e) => {
            const d = new Date(e.datetime);
            const now = new Date();
            const week = new Date(now); week.setDate(now.getDate() + 7);
            return d >= now && d <= week;
          }).slice(0, 12).map((e) => (
            <Link key={e.id} to={e.edit_href || '#'} className="ec-stream-row"
                  data-tone={STATUS_TONE[e.status] || 'draft'}
                  data-testid={`ec-stream-${e.id}`}>
              <div className="ec-stream-row__when">
                <span className="ec-stream-row__date">{fmtDay(new Date(e.datetime))}</span>
                <span className="ec-stream-row__time">{fmtTime(new Date(e.datetime))}</span>
              </div>
              <div className="ec-stream-row__market">
                <span className="ec-stream-row__flag">{e.country.flag}</span>
                <span className="ec-stream-row__locale">{e.country.country} · {e.locale}</span>
              </div>
              <div className="ec-stream-row__title">
                <span className="ec-stream-row__type">{TYPE_LABEL[e.type]}</span>
                <span className="ec-stream-row__h">{e.title}</span>
              </div>
              <div className="ec-stream-row__meta">
                <span className="ec-stream-row__cta">{e.cta_target}</span>
                <span className="ec-stream-row__status" data-tone={STATUS_TONE[e.status]}>{e.status}</span>
              </div>
            </Link>
          ))}
          {(feed.events || []).filter((e) => {
            const d = new Date(e.datetime);
            const now = new Date();
            const week = new Date(now); week.setDate(now.getDate() + 7);
            return d >= now && d <= week;
          }).length === 0 && (
            <div className="ec-stream__empty">
              Nessuna pubblicazione pianificata nei prossimi 7 giorni.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EditorialCalendarPage;
