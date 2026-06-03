/**
 * NotificationDrawer — M4 right-side drawer (380px) with:
 *  • Filter tabs: Tutte / Non lette / Critiche / Attività / Tenant / Advisor
 *  • Critical-first section (per user spec: "separazione netta")
 *  • Mark-all-read action
 *  • Infinite scroll (Carica altre)
 */
import React, { useMemo } from 'react';
import { X as XIcon } from 'lucide-react';
import NotificationItem from './NotificationItem';

const FILTERS = [
  { kind: 'all',      label: 'Tutte' },
  { kind: 'unread',   label: 'Non lette' },
  { kind: 'critical', label: 'Critiche',  color: '#E5484D' },
  { kind: 'activity', label: 'Attività' },
  { kind: 'tenant',   label: 'Tenant' },
  { kind: 'advisor',  label: 'Advisor' },
];

const NotificationDrawer = ({
  open, count, items, filter, setFilter,
  onClose, onMarkRead, onMarkAllRead, onArchive,
  hasNext, loadMore, loading,
}) => {
  const { critical, rest } = useMemo(() => {
    if (filter.kind === 'critical') return { critical: items, rest: [] };
    if (filter.kind !== 'all')      return { critical: [],    rest: items };
    const c = [], r = [];
    items.forEach(it => {
      if (['high','urgent'].includes(it.priority) && !it.read_at) c.push(it);
      else r.push(it);
    });
    return { critical: c, rest: r };
  }, [items, filter]);

  if (!open) return null;

  const total = count?.total ?? 0;
  const criticalCount = (count?.by_priority?.high || 0) + (count?.by_priority?.urgent || 0);

  return (
    <>
      <div
        data-testid="notification-drawer-mask"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 49 }}
      />
      <aside
        data-testid="notification-drawer"
        style={{
          position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
          background: '#111113', borderLeft: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', flexDirection: 'column',
        }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.2rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.05rem', color: '#FAFAFA' }}>
              Notifiche
            </span>
            <span style={{
              fontSize: '0.6rem', letterSpacing: '0.18em', color: '#00C9B3', marginLeft: 8,
            }}>{total} {total === 1 ? 'nuova' : 'nuove'}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              data-testid="notification-mark-all-read"
              onClick={onMarkAllRead}
              disabled={total === 0}
              style={{
                background: 'none', border: 'none',
                color: total === 0 ? '#525258' : '#B5B5B8',
                fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: total === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>Mark all read</button>
            <button
              data-testid="notification-drawer-close"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#B5B5B8',
                cursor: 'pointer', padding: 4,
              }}><XIcon size={16} /></button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0 1.2rem', overflowX: 'auto',
        }}>
          {FILTERS.map(f => (
            <button
              key={f.kind}
              data-testid={`notification-filter-${f.kind}`}
              onClick={() => setFilter({ kind: f.kind })}
              style={{
                fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase',
                color: filter.kind === f.kind ? '#FAFAFA' : (f.color || '#7A7A80'),
                padding: '0.7rem 0', marginRight: '1rem',
                borderBottom: filter.kind === f.kind ? '2px solid #00C9B3' : '2px solid transparent',
                background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                ...(filter.kind === f.kind
                    ? { borderBottom: '2px solid #00C9B3' }
                    : {}),
              }}>
              {f.label}
              {f.kind === 'critical' && criticalCount > 0 && (
                <span style={{ marginLeft: 4, fontSize: '0.55rem', color: '#525258' }}>· {criticalCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }} data-testid="notification-drawer-body">
          {filter.kind === 'all' && critical.length > 0 && (
            <SectionHeader label="Critiche · richiedono attenzione" count={critical.length} accent="#E5484D" />
          )}
          {critical.map(it => (
            <NotificationItem key={it.id} item={it} onMarkRead={onMarkRead} onArchive={onArchive} />
          ))}

          {filter.kind === 'all' && critical.length > 0 && rest.length > 0 && (
            <SectionHeader label="Tutte le altre" count={rest.length} />
          )}
          {rest.map(it => (
            <NotificationItem key={it.id} item={it} onMarkRead={onMarkRead} onArchive={onArchive} />
          ))}

          {items.length === 0 && !loading && (
            <div
              data-testid="notification-empty"
              style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#7A7A80', fontSize: '0.78rem' }}>
              Nessuna notifica per questo filtro.
            </div>
          )}

          {hasNext && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <button
                data-testid="notification-load-more"
                onClick={loadMore}
                disabled={loading}
                style={{
                  border: '1px solid rgba(255,255,255,0.10)', background: 'none',
                  color: '#B5B5B8', padding: '0.4rem 1rem',
                  fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{loading ? 'Caricamento…' : 'Carica altre'}</button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

const SectionHeader = ({ label, count, accent }) => (
  <div style={{
    padding: '0.9rem 1.2rem 0.5rem',
    background: '#16161A',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  }}>
    <span style={{
      fontSize: '0.6rem', letterSpacing: '0.3em', textTransform: 'uppercase',
      color: accent || '#B5B5B8',
    }}>{label}</span>
    <span style={{ fontSize: '0.55rem', color: '#525258', letterSpacing: '0.14em' }}>
      {count} {count === 1 ? 'non letta' : 'non lette'}
    </span>
  </div>
);

export default NotificationDrawer;
