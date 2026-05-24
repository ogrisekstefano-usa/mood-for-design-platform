/**
 * WelcomeDrawer · Sprint C · Blueprint Welcome Experience™.
 *
 * Side drawer surfaced when opening a Lead/Prospect/Account. Renders the
 * ceremonial welcome payload:
 *   · the relationship's first name + register + atmosphere chosen
 *   · the designer cultivating
 *   · suggested "next moments" — narrative, not task-style
 *
 * Editorial · operator-facing · NOT client-facing.
 */
import React, { useEffect, useState } from 'react';
import { X, ArrowRight, MessageCircle, Compass, Send, Heart } from 'lucide-react';
import api from '../../lib/api';
import DesignerChip from './DesignerChip';

const NEXT_ICON = {
  continuation_interview: MessageCircle,
  moodboard_invitation:   Heart,
  promote_account:        Compass,
  listen:                 Send,
};

const tempLabel = (t) => {
  const v = Number(t || 0);
  if (v >= 0.85) return 'Warm · ready';
  if (v >= 0.65) return 'Engaged';
  if (v >= 0.40) return 'Curious';
  if (v >= 0.20) return 'Early';
  return 'First contact';
};

const WelcomeDrawer = ({ subjectId, open, onClose, onAction }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!open || !subjectId) return;
    let cancelled = false;
    setLoading(true); setError(null);
    api.get(`/api/relations/leads/${subjectId}/welcome`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.detail || 'Unable to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, subjectId]);

  if (!open) return null;

  const lead       = data?.lead || {};
  const designer   = data?.designer || null;
  const next       = data?.next_moments || [];
  const atmos      = lead.atmosphere_signals || [];
  const heroAtmos  = atmos[0] || 'silent_signal';
  const register   = lead.cultural_register || 'discovery';
  const tier       = lead.luxury_perception_tier || null;

  return (
    <div className="welcome-drawer" data-testid="welcome-drawer" role="dialog" aria-modal="true">
      <div className="welcome-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <aside className="welcome-drawer__panel">
        <header className="welcome-drawer__top">
          <span className="welcome-drawer__eyebrow">Blueprint Welcome Experience™</span>
          <button type="button" className="welcome-drawer__close" onClick={onClose} aria-label="Close" data-testid="welcome-drawer-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {loading && <div className="welcome-drawer__loading">Opening the relationship folder…</div>}
        {error && <div className="welcome-drawer__error" data-testid="welcome-drawer-error">{error}</div>}

        {!loading && !error && data && (
          <div className="welcome-drawer__body" data-testid="welcome-drawer-body">
            <p className="welcome-drawer__greeting">A relationship has opened.</p>
            <h2 className="welcome-drawer__name" data-testid="welcome-drawer-name">{lead.name || 'New friend'}</h2>
            <p className="welcome-drawer__sub">
              {(lead.lead_type || 'private').replace(/_/g, ' ')} · {(lead.locale_code || 'it').toUpperCase()} · {tempLabel(lead.relationship_temperature)}
            </p>

            <section className="welcome-drawer__section">
              <span className="welcome-drawer__section-eyebrow">Atmosphere captured</span>
              <h3 className="welcome-drawer__atmos">
                <em>{String(heroAtmos).replace(/_/g, ' ')}</em>
              </h3>
              <p className="welcome-drawer__atmos-sub">
                {register} register{tier ? <> · {tier.replace(/_/g, ' ')} tier</> : null}
              </p>
            </section>

            <section className="welcome-drawer__section">
              <span className="welcome-drawer__section-eyebrow">Cultivated by</span>
              <DesignerChip designer={designer} size="lg" testid="welcome-drawer-designer" />
            </section>

            <section className="welcome-drawer__section">
              <span className="welcome-drawer__section-eyebrow">Next moments</span>
              <ul className="welcome-drawer__moments" data-testid="welcome-drawer-moments">
                {next.map((m, i) => {
                  const Icon = NEXT_ICON[m.kind] || ArrowRight;
                  return (
                    <li key={i} className="welcome-drawer__moment">
                      <button
                        type="button"
                        className="welcome-drawer__moment-btn"
                        onClick={() => onAction && onAction(m, lead)}
                        data-testid={`welcome-drawer-action-${m.kind}`}
                      >
                        <Icon size={18} strokeWidth={1.6} />
                        <span>
                          <span className="welcome-drawer__moment-label">{m.label}</span>
                          <span className="welcome-drawer__moment-sub">{m.sub}</span>
                        </span>
                        <ArrowRight size={16} strokeWidth={1.6} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

export default WelcomeDrawer;
