/**
 * NotificationBell — topbar button.
 * - Numeric badge (sober, professional — per user spec: NO pulsing `!`)
 * - Critical highlight: badge background turns red when has_critical
 *   (still numeric, never with an exclamation mark or animation)
 */
import React from 'react';
import { Bell } from 'lucide-react';
import useNotifications from './useNotifications';
import NotificationDrawer from './NotificationDrawer';

const NotificationBell = ({ enabled = true }) => {
  const n = useNotifications({ enabled });
  const { count, open, setOpen } = n;
  const total = count?.total ?? 0;
  const hasCritical = !!count?.has_critical;

  return (
    <>
      <button
        data-testid="notification-bell"
        onClick={() => setOpen(true)}
        title={total > 0 ? `${total} non lette` : 'Nessuna notifica'}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: '#B5B5B8', padding: 6,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#FAFAFA'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#B5B5B8'}
      >
        <Bell size={18} strokeWidth={1.6} />
        {total > 0 && (
          <span
            data-testid="notification-bell-badge"
            style={{
              position: 'absolute', top: -3, right: -3,
              background: hasCritical ? '#E5484D' : '#00C9B3',
              color: hasCritical ? '#FFFFFF' : '#0A0A0B',
              fontSize: '0.55rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              padding: '1px 5px', borderRadius: 10,
              fontFamily: 'Montserrat, sans-serif',
              minWidth: 14, textAlign: 'center', lineHeight: '1.1',
            }}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      <NotificationDrawer
        open={open}
        count={count}
        items={n.items}
        filter={n.filter}
        setFilter={n.setFilter}
        onClose={() => setOpen(false)}
        onMarkRead={n.markRead}
        onMarkAllRead={n.markAllRead}
        onArchive={n.archive}
        hasNext={n.hasNext}
        loadMore={n.loadMore}
        loading={n.loading}
      />
    </>
  );
};

export default NotificationBell;
