/**
 * DesignerPresencePicker — ITER151 Sprint C + Sprint F · F3 Realtime
 *
 * Compact narrative state selector for the designer. NOT online/offline.
 * Sits in the workspace header / dashboard. Persists via PUT /orchestra/presence/me.
 *
 * Realtime: subscribes to own presence row so external changes
 * (other tab, admin tool) reflect here with a soft crossfade.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getMyPresence, setMyPresence, getPresenceOptions } from '../../lib/orchestra';
import { subscribe } from '../../lib/realtimeBus';
import { useAuth } from '../../contexts/AuthContext';
import './designer-presence-picker.css';

const DesignerPresencePicker = ({ locale = 'it', compact = false }) => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [options, setOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const myId = user?.id || null;

  useEffect(() => {
    getPresenceOptions().then(({ data }) => setOptions(data?.data || [])).catch(() => {});
    getMyPresence().then(({ data }) => setCurrent(data)).catch(() => {});
  }, []);

  // Realtime — keep the picker in sync with external changes
  useEffect(() => {
    if (!myId) return undefined;
    const unsub = subscribe({
      key: `presence:${myId}`,
      table: 'designer_presence',
      event: '*',
      filter: `designer_id=eq.${myId}`,
      onPayload: (p) => {
        if (!p.new) return;
        queueMicrotask(() => setCurrent(prev => ({ ...prev, ...p.new })));
      },
    });
    return unsub;
  }, [myId]);

  const choose = async (state_key) => {
    setSaving(true);
    try {
      const { data } = await setMyPresence({ state_key });
      setCurrent(data.presence);
      toast.success(locale === 'it' ? 'Stato aggiornato.' : 'Status updated.');
      setOpen(false);
    } catch {
      toast.error(locale === 'it' ? 'Impossibile aggiornare.' : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const label = current ? (locale === 'it' ? current.state_label_it : current.state_label_en) : '—';

  return (
    <div className={`dpp ${compact ? 'dpp--compact' : ''}`} data-testid="designer-presence-picker">
      <button
        type="button"
        className="dpp__pill"
        onClick={() => setOpen(o => !o)}
        data-testid="dpp-toggle"
      >
        <span className="dpp__dot" aria-hidden />
        <span key={current?.state_key || 'idle'} className="dpp__label dpp__label--crossfade">{label}</span>
        <span className="dpp__caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="dpp__menu" role="menu" data-testid="dpp-menu">
          <p className="dpp__head">
            {locale === 'it' ? 'Come ti presenti ai tuoi clienti' : 'How you appear to your clients'}
          </p>
          <ul>
            {options.map(o => (
              <li key={o.key}>
                <button
                  type="button"
                  className={`dpp__item ${current?.state_key === o.key ? 'dpp__item--current' : ''}`}
                  disabled={saving}
                  onClick={() => choose(o.key)}
                  data-testid={`dpp-option-${o.key}`}
                >
                  <span className="dpp__item-label">
                    {locale === 'it' ? o.label_it : o.label_en}
                  </span>
                  {current?.state_key === o.key && <span aria-hidden>✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DesignerPresencePicker;
