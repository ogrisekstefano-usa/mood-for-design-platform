/**
 * NotificationItem — single row in the drawer.
 * Style aligned with Command Center tokens. Dark shell + structured FK
 * data. Click anywhere on the row marks read and navigates to action_url.
 */
import React from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const iconFor = (name) => {
  if (!name) return Icons.Bell;
  const key = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return Icons[key] || Icons.Bell;
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1)   return 'ora';
  if (min < 60)  return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h fa`;
  const days = Math.floor(h / 24);
  if (days < 7)  return `${days}g fa`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

const NotificationItem = ({ item, onMarkRead, onArchive }) => {
  const nav = useNavigate();
  const Icon = iconFor(item.icon);
  const isUnread = !item.read_at;
  const isHigh   = ['high', 'urgent'].includes(item.priority);

  const onClick = (e) => {
    if (e.target.closest('button')) return;
    if (isUnread) onMarkRead?.(item.id);
    if (item.action_url) nav(item.action_url);
  };

  return (
    <div
      data-testid={`notification-item-${item.id}`}
      onClick={onClick}
      style={{
        position: 'relative', display: 'flex', gap: 12, padding: '0.85rem 1.1rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
        background: isUnread ? 'rgba(0,201,179,0.04)' : 'transparent',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={(e) => e.currentTarget.style.background = isUnread ? 'rgba(0,201,179,0.04)' : 'transparent'}
    >
      {isUnread && (
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: isHigh ? 3 : 2,
          background: isHigh ? '#E5484D' : '#00C9B3',
        }} />
      )}
      <div style={{
        flexShrink: 0, width: 30, height: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.10)',
        background: '#16161A',
        color: item.color || (isHigh ? '#E5484D' : '#B5B5B8'),
      }}>
        <Icon size={14} strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.52rem', letterSpacing: '0.28em', textTransform: 'uppercase',
          color: isHigh ? '#E5484D' : '#7A7A80',
        }}
        data-testid={`notification-cat-${item.notification_type_code}`}>
          {item.label_it || item.title}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#FAFAFA', marginTop: 3, lineHeight: 1.45 }}>
          {item.narrative}
        </div>
        <div style={{
          fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase',
          color: '#525258', marginTop: 5,
        }}>
          {item.tenant_display || item.tenant_name || ''}
          {item.tenant_display ? ' · ' : ''}
          {fmtRelative(item.created_at)}
          {item.created_by_display ? ` · ${item.created_by_display}` : ''}
        </div>
      </div>
      <button
        data-testid={`notification-archive-${item.id}`}
        onClick={(e) => { e.stopPropagation(); onArchive?.(item.id); }}
        title="Archivia"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#525258', fontSize: '0.8rem', alignSelf: 'flex-start',
          padding: '2px 4px', opacity: 0.6,
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
      >×</button>
    </div>
  );
};

export default NotificationItem;
