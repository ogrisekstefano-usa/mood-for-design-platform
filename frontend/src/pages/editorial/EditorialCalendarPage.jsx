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
import { Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw, AlertTriangle, Sparkles, Plus, Globe } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import PublicPreviewDrawer from './PublicPreviewDrawer';
import './editorialCalendar.css';

// Maps our editorial locales to BCP-47 strings the Intl APIs understand.
const intlLocale = (lc) => {
  switch (lc) {
    case 'it':    return 'it-IT';
    case 'en-US': return 'en-US';
    case 'en-GB': return 'en-GB';
    case 'fr':    return 'fr-FR';
    case 'de':    return 'de-DE';
    case 'es':    return 'es-ES';
    case 'ar':    return 'ar';
    default:      return lc || 'it-IT';
  }
};

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

// Sprint ITER121: locale-aware month/day/time formatting (no more hardcoded 'it-IT').
const fmtMonth = (date, locale = 'it-IT') =>
  date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
const fmtDay = (date, locale = 'it-IT') =>
  date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (date, locale = 'it-IT') =>
  date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

// Locale-aware short weekday names for the calendar header row.
// e.g. en-US → ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const buildWeekHeader = (locale = 'it-IT') => {
  const intl = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // Reference Monday: 2024-01-01 was a Monday.
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const label = intl.format(d);
    // Capitalize first letter for languages like 'lun'/'mon' to read sober editorial.
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
};

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
const PresenceTable = ({ byMarket, t }) => {
  if (!byMarket || byMarket.length === 0) {
    return (
      <div className="ec-presence ec-presence--empty">
        <p>{t ? t('editorial.presence.empty', null, 'No market with events in the current window.') : 'No market with events in the current window.'}</p>
      </div>
    );
  }
  return (
    <div className="ec-presence" data-testid="ec-presence">
      <div className="ec-presence__head">
        <span style={{ flex: '0 0 50px' }}>{t ? t('editorial.presence.flag',      null, 'Flag')      : 'Flag'}</span>
        <span style={{ flex: 1 }}>{t ? t('editorial.presence.market',    null, 'Market')    : 'Market'}</span>
        <span style={{ flex: '0 0 70px'  }}>{t ? t('editorial.presence.today',     null, 'Today')     : 'Today'}</span>
        <span style={{ flex: '0 0 100px' }}>{t ? t('editorial.presence.scheduled', null, 'Scheduled') : 'Scheduled'}</span>
        <span style={{ flex: '0 0 100px' }}>{t ? t('editorial.presence.published', null, 'Published') : 'Published'}</span>
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
// EVENT PILL (inside calendar cell) — DRAGGABLE + opens public drawer
// ───────────────────────────────────────────────────────────────────────
const EventPill = ({ event, onDragStart, onSelect }) => {
  const tone = STATUS_TONE[event.status] || 'draft';
  return (
    <button type="button" className="ec-pill" data-tone={tone}
            draggable
            onDragStart={(e) => onDragStart(e, event)}
            onClick={() => onSelect(event)}
            data-testid={`ec-pill-${event.id}`}
            title={`${TYPE_LABEL[event.type]} · ${event.title}\n${event.country.country} · ${event.locale}\n(click → preview · drag → reschedule)`}>
      <span className="ec-pill__flag" aria-hidden>{event.country.flag}</span>
      <span className="ec-pill__time">{fmtTime(new Date(event.datetime))}</span>
      <span className="ec-pill__title">{event.title}</span>
    </button>
  );
};

// ───────────────────────────────────────────────────────────────────────
// OPERATIONS INTELLIGENCE — rule-based AI suggestions sidebar
// ───────────────────────────────────────────────────────────────────────
const OperationsIntelligence = ({ data, t }) => {
  if (!data || !data.suggestions) return null;
  const sugs = data.suggestions;
  return (
    <aside className="ec-intel" data-testid="ec-intelligence">
      <header className="ec-intel__head">
        <Sparkles size={12} strokeWidth={1.8} />
        <span>Operations Intelligence</span>
      </header>
      {sugs.length === 0 ? (
        <div className="ec-intel__empty">
          <p>{t ? t('editorial.intelligence.empty', null, 'No critical operational signals. The editorial cadence is balanced across active markets.') : 'No critical operational signals.'}</p>
        </div>
      ) : (
        <div className="ec-intel__list">
          {sugs.map((s, i) => (
            <div key={i} className="ec-intel__card" data-severity={s.severity} data-testid={`ec-intel-${s.kind}`}>
              <div className="ec-intel__row">
                <AlertTriangle size={11} strokeWidth={2}
                  className={s.severity === 'high' ? 'ec-intel__icon--high' : 'ec-intel__icon--med'} />
                <span className="ec-intel__kind">{s.kind}</span>
              </div>
              <h4 className="ec-intel__title">{s.title}</h4>
              <p className="ec-intel__body">{s.body}</p>
              {s.cta_href && (
                <Link to={s.cta_href} className="ec-intel__cta" data-testid={`ec-intel-cta-${s.kind}`}>
                  {s.cta_label || 'Apri'} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      <footer className="ec-intel__foot">
        <small>Ultimi 30 giorni · rule-based · evolves into AI operations layer</small>
      </footer>
    </aside>
  );
};

// ───────────────────────────────────────────────────────────────────────
// WEEKLY VIEW — 7 columns aligned on the week of `cursor`
// ───────────────────────────────────────────────────────────────────────
const startOfWeek = (date) => {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7; // Monday-start
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const WeekView = ({ cursor, eventsByDay, onDragStart, onDragOver, onDragLeave, onDrop, dragOverKey, onSelect }) => {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  const today = new Date();
  return (
    <div className="ec-week" data-testid="ec-week-view">
      {days.map((day) => {
        const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        const evts = (eventsByDay.get(key) || []).slice().sort((a, b) => a.datetime.localeCompare(b.datetime));
        const isToday = day.toDateString() === today.toDateString();
        return (
          <div key={key} className="ec-week__col"
               data-today={isToday}
               data-drag-over={dragOverKey === key}
               onDragOver={(e) => onDragOver(e, key)}
               onDragLeave={onDragLeave}
               onDrop={(e) => onDrop(e, day)}
               data-testid={`ec-week-col-${key}`}>
            <div className="ec-week__head">
              <span className="ec-week__weekday">{day.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
              <span className="ec-week__date">{day.getDate()}</span>
              {isToday && <span className="ec-cell__today-chip">OGGI</span>}
            </div>
            <div className="ec-week__events">
              {evts.length === 0 && <span className="ec-week__empty">—</span>}
              {evts.map((ev) => <EventPill key={ev.id} event={ev} onDragStart={onDragStart} onSelect={onSelect} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ───────────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────────
const EditorialCalendarPage = () => {
  const t = useT();
  const { locale } = useBlueprint();
  const intl = intlLocale(locale);
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView]     = useState('month'); // month | week
  const [feed, setFeed]     = useState({ events: [], by_market: [], totals: {} });
  const [intel, setIntel]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dragOverKey, setDragOverKey] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const start = new Date(monthStart); start.setDate(start.getDate() - 7);
      const end   = new Date(monthEnd);   end.setDate(end.getDate() + 7);
      const params = new URLSearchParams({
        start: start.toISOString(),
        end:   end.toISOString(),
      });
      if (typeFilter !== 'all') params.set('type_filter', typeFilter);
      const [feedRes, intelRes] = await Promise.allSettled([
        api.get(`/api/blueprint/calendar?${params}`),
        api.get('/api/blueprint/calendar/intelligence'),
      ]);
      if (feedRes.status === 'fulfilled') setFeed(feedRes.value.data);
      if (intelRes.status === 'fulfilled') setIntel(intelRes.value.data);
    } catch (e) {
      toast.error(t('editorial.toast.load_error', null, "Errore nel caricamento dell'agenda editoriale"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor, typeFilter]);

  // ── Drag & drop handlers ─────────────────────────────────────────────
  const onPillDragStart = (e, event) => {
    e.dataTransfer.setData('application/x-mood-event', JSON.stringify({
      id: event.id, datetime: event.datetime,
    }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onCellDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  };
  const onCellDragLeave = () => setDragOverKey(null);
  const onCellDrop = async (e, dropDate) => {
    e.preventDefault();
    setDragOverKey(null);
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData('application/x-mood-event') || '{}');
    } catch (_) { return; }
    if (!payload.id || !payload.datetime) return;
    // Preserve the original time-of-day; only swap the calendar day.
    const original = new Date(payload.datetime);
    const next = new Date(dropDate);
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);
    if (next.toDateString() === original.toDateString()) return;
    // Optimistic update
    setFeed((prev) => ({
      ...prev,
      events: prev.events.map((ev) => ev.id === payload.id ? { ...ev, datetime: next.toISOString() } : ev),
    }));
    try {
      await api.patch(`/api/blueprint/calendar/${payload.id}/schedule`, { datetime: next.toISOString() });
      toast.success(`Riprogrammato → ${next.toLocaleDateString('it-IT', { dateStyle: 'medium' })}`);
    } catch (err) {
      toast.error('Riprogrammazione fallita');
      load();
    }
  };

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
  const weekHeader = useMemo(() => buildWeekHeader(intl), [intl]);

  const totals = feed.totals || {};

  return (
    <div className="ec-stage" data-testid="editorial-calendar-page">
      <header className="ec-head">
        <p className="ec-head__eyebrow">{t('editorial.eyebrow', null, 'Blueprint · International Editorial Operations')}</p>
        <h1 className="ec-head__title">Editorial Calendar<sup>™</sup></h1>
        <p className="ec-head__intro">
          {t('editorial.intro', null, "Organizza pubblicazioni internazionali su tutti i mercati e le lingue. Trascina gli eventi per riprogrammare, clicca per aprire l'anteprima pubblica.")}
        </p>
        <div className="ec-head-actions">
          <Link to="/blueprint/editorial?new=master" className="ec-action ec-action--primary"
                data-testid="ec-action-new-master">
            <Plus size={11} strokeWidth={1.8} /> {t('editorial.cta.new_master', null, 'New editorial master')}
          </Link>
          <Link to="/blueprint/editorial?new=variant" className="ec-action ec-action--ghost"
                data-testid="ec-action-new-variant">
            <Plus size={11} strokeWidth={1.8} /> {t('editorial.cta.new_variant', null, 'New market edition')}
          </Link>
          <Link to="/blueprint/projects-studio?new=1" className="ec-action ec-action--ghost"
                data-testid="ec-action-new-project">
            <Plus size={11} strokeWidth={1.8} /> {t('projects.newProject', null, 'New project')}
          </Link>
          <span className="ec-action ec-action--hint">
            <Globe size={10} strokeWidth={1.7} /> {t('editorial.hint.drag', null, 'Trascina sul giorno per programmare')}
          </span>
        </div>
      </header>

      {/* Today's International Presence */}
      <section className="ec-section">
        <p className="ec-section__kicker">{t('editorial.section.today.eyebrow', null, "Today's International Presence")}</p>
        <h2 className="ec-section__title">{t('editorial.section.today.title', null, 'Cosa sta accadendo ora nei tuoi mercati')}</h2>
        <PresenceTable byMarket={feed.by_market} t={t} />
      </section>

      {/* Filters + View nav */}
      <section className="ec-section ec-section--calendar">
        <div className="ec-toolbar">
          <div className="ec-toolbar__nav">
            <button type="button" className="ec-icon-btn"
                    onClick={() => setCursor(view === 'month'
                      ? new Date(cursor.getFullYear(), monthIdx - 1, 1)
                      : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7))}
                    data-testid="ec-prev"><ChevronLeft size={14} /></button>
            <button type="button" className="ec-month" onClick={() => setCursor(new Date())}
                    data-testid="ec-today">
              <Calendar size={12} strokeWidth={1.7} /> {view === 'week' ? fmtDay(cursor, intl) : fmtMonth(cursor, intl)}
            </button>
            <button type="button" className="ec-icon-btn"
                    onClick={() => setCursor(view === 'month'
                      ? new Date(cursor.getFullYear(), monthIdx + 1, 1)
                      : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7))}
                    data-testid="ec-next"><ChevronRight size={14} /></button>
            <div className="ec-view-switch">
              {['month', 'week'].map((v) => (
                <button key={v} type="button" className="ec-chip"
                        data-active={view === v}
                        data-testid={`ec-view-${v}`}
                        onClick={() => setView(v)}>
                  {v === 'month' ? t('editorial.view.month', null, 'Mese') : t('editorial.view.week', null, 'Settimana')}
                </button>
              ))}
            </div>
          </div>
          <div className="ec-toolbar__filters">
            <Filter size={11} strokeWidth={1.7} />
            {['all', 'article', 'project', 'page'].map((tk) => (
              <button key={tk} type="button" className="ec-chip"
                      data-active={typeFilter === tk}
                      data-testid={`ec-filter-${tk}`}
                      onClick={() => setTypeFilter(tk)}>
                {tk === 'all'
                  ? t('projects.tabs.all', null, 'All')
                  : t(`editorial.type.${tk}`, null, TYPE_LABEL[tk])}
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

        {/* Split layout: calendar + intelligence sidebar */}
        <div className="ec-split">
          <div className="ec-split__main">
            {view === 'month' ? (
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
                    const saturation = Math.min(evts.length, 5);
                    return (
                      <div key={key} className="ec-cell"
                           data-out={!inMonth}
                           data-today={isToday}
                           data-saturation={saturation}
                           data-drag-over={dragOverKey === key}
                           data-testid={`ec-cell-${key}`}
                           onDragOver={(e) => onCellDragOver(e, key)}
                           onDragLeave={onCellDragLeave}
                           onDrop={(e) => onCellDrop(e, day)}>
                        <div className="ec-cell__date">
                          <span className="ec-cell__day">{day.getDate()}</span>
                          {isToday && <span className="ec-cell__today-chip">OGGI</span>}
                        </div>
                        <div className="ec-cell__events">
                          {evts.slice(0, 3).map((ev) => <EventPill key={ev.id} event={ev} onDragStart={onPillDragStart} onSelect={setSelectedEvent} />)}
                          {evts.length > 3 && (
                            <span className="ec-cell__more">+{evts.length - 3} altri</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <WeekView cursor={cursor} eventsByDay={eventsByDay}
                        onDragStart={onPillDragStart}
                        onDragOver={onCellDragOver}
                        onDragLeave={onCellDragLeave}
                        onDrop={onCellDrop}
                        dragOverKey={dragOverKey}
                        onSelect={setSelectedEvent} />
            )}
          </div>
          <OperationsIntelligence data={intel} t={t} />
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

      <PublicPreviewDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onPublishNow={async (ev) => {
          try {
            // Publishing now = scheduling to now() — backend bumps status to scheduled
            // unless already published. For published events this is a no-op.
            const nowIso = new Date().toISOString();
            await api.patch(`/api/blueprint/calendar/${ev.id}/schedule`, { datetime: nowIso });
            toast.success('Pubblicazione avviata');
            setSelectedEvent(null);
            load();
          } catch (e) {
            toast.error('Pubblicazione fallita');
          }
        }}
      />
    </div>
  );
};

export default EditorialCalendarPage;
