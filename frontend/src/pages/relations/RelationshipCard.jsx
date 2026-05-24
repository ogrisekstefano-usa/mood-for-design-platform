/**
 * RelationshipCard — Cinematic editorial card.
 *
 * Surfaces:
 *   - identity (name + email + locale)
 *   - progression badge (Lead/Prospect/Account)
 *   - relationship temperature meter
 *   - atmosphere + material signal pills
 *   - cultural register + luxury tier
 *   - optional progression suggestion banner
 *
 * NO tables, NO status colored badges, NO Hubspot CRM feel.
 * This component is shared across Leads, Prospects, Accounts views.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const STAGE_LABEL = {
  lead:     'LEAD',
  prospect: 'PROSPECT',
  account:  'ACCOUNT',
  dormant:  'DORMANT',
};

const formatRelativeTime = (iso) => {
  if (!iso) return '';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m || 1}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d`;
    const mo = Math.floor(d / 30);
    return `${mo}mo`;
  } catch (_) { return ''; }
};

const tempLabel = (t) => {
  const v = Number(t || 0);
  if (v >= 0.85) return 'Warm · Ready';
  if (v >= 0.65) return 'Engaged';
  if (v >= 0.40) return 'Curious';
  if (v >= 0.20) return 'Early';
  return 'Discovery';
};

const RelationshipCard = ({ item, stage, onPromote }) => {
  const navigate = useNavigate();
  const name = item.account_name
    || `${item.first_name || ''} ${item.last_name || ''}`.trim()
    || item.email
    || 'Untitled';
  const email = item.email || '';
  const temp = stage === 'account'
    ? Number(item.relationship_score || 0) / 100
    : Number(item.relationship_temperature || 0);
  const tempPct = Math.max(2, Math.min(100, Math.round(temp * 100)));

  const atmospheres = Array.isArray(item.atmosphere_signals) ? item.atmosphere_signals.slice(0, 2)
                     : Array.isArray(item.mood_dominant)     ? item.mood_dominant.slice(0, 2)
                     : [];
  const materials   = Array.isArray(item.material_signals) ? item.material_signals.slice(0, 2) : [];
  const register    = typeof item.cultural_register === 'string' ? item.cultural_register
                     : (typeof item.cultural_profile === 'string' ? item.cultural_profile : null);
  const tier        = typeof item.luxury_perception_tier === 'string' ? item.luxury_perception_tier
                     : (typeof item.luxury_perception_axis === 'string' ? item.luxury_perception_axis : null);

  const targetMap = { lead: '/relations/leads', prospect: '/relations/prospects', account: '/relations/accounts' };

  const handleOpen = () => {
    if (stage === 'account') navigate(`/relations/accounts/${item.id}`);
    else navigate(`/relations/leads/${item.id}`);
  };

  const handlePromote = (e) => {
    e.stopPropagation();
    if (onPromote) onPromote(item);
  };

  const promotionTarget = stage === 'lead' ? 'prospect' : (stage === 'prospect' ? 'account' : null);
  const showSuggestion = promotionTarget && temp >= 0.75;

  return (
    <div className="cr-card" data-testid={`cr-card-${stage}-${item.id}`} onClick={handleOpen}>
      <div className="cr-card__top">
        <div className="cr-card__identity">
          <h3 className="cr-card__name">{name}</h3>
          {email && <div className="cr-card__email">{email}</div>}
        </div>
        <span className={`cr-badge cr-badge--${stage}`}>
          {STAGE_LABEL[stage] || stage.toUpperCase()}
        </span>
      </div>

      <div className="cr-temp" data-testid="cr-card-temperature">
        <span className="cr-temp__track">
          <span className="cr-temp__fill" style={{ width: `${tempPct}%` }} />
        </span>
        <span className="cr-temp__value">{tempLabel(temp)}</span>
      </div>

      {(atmospheres.length > 0 || materials.length > 0 || register) && (
        <div className="cr-signals" data-testid="cr-card-signals">
          {atmospheres.map((a, i) => (
            <span key={`a-${i}`} className="cr-signal cr-signal--atmosphere">
              {String(a).replace(/_/g, ' ')}
            </span>
          ))}
          {materials.map((m, i) => (
            <span key={`m-${i}`} className="cr-signal cr-signal--material">
              {String(m).replace(/_/g, ' ')}
            </span>
          ))}
          {register && (
            <span className="cr-signal cr-signal--register">{register}</span>
          )}
          {tier && (
            <span className="cr-signal cr-signal--register">{String(tier).replace(/_/g, ' ')}</span>
          )}
        </div>
      )}

      {showSuggestion && (
        <div className="cr-suggestion" data-testid="cr-card-suggestion">
          <span>
            <span style={{ color: 'var(--cr-cyan)', fontWeight: 600 }}>Suggestion</span> · Ready for {promotionTarget}.
          </span>
          <button
            className="cr-suggestion__action"
            onClick={handlePromote}
            data-testid={`cr-card-promote-${stage}-${item.id}`}
          >
            Promote
          </button>
        </div>
      )}

      <div className="cr-meta">
        <span className="cr-meta__label">
          {item.locale_code || item.language || 'it'} · {item.lead_type || item.account_type || 'private'}
        </span>
        <span>{formatRelativeTime(item.updated_at || item.last_activity_at)} ago</span>
      </div>
    </div>
  );
};

export default RelationshipCard;
