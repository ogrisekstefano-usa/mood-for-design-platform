/**
 * CuratorialTeamCluster — ITER152 Fase B
 *
 * Shows the people following the client's design journey.
 * Editorial language ALWAYS:
 *   ✅ "Curatorial Team"   "Studio Presence"   "Project Direction"
 *   ❌ collaborators · staff · team members · operators
 *
 * Behavior:
 *  - Single avatar  → soft pill: portrait · "Stefano · In studio"
 *  - Multi-avatar   → stacked cluster (max 3 visible + "+N")
 *  - Click          → DesignerPresentationModal with bio, presence,
 *                     specialties, languages, CTA message/call
 *  - Realtime       → subscribes to designer_presence updates so the
 *                     pill state crossfades live (reuses F3 pattern)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Phone, X } from 'lucide-react';
import { getCuratorialTeam } from '../../lib/curatorialTeam';
import { subscribe } from '../../lib/realtimeBus';
import './curatorial-team.css';

const SOFT_REFRESH_MS = 30000;

const Avatar = ({ d, size = 36, onClick }) => (
  <button
    type="button"
    className="ct-avatar"
    style={{ width: size, height: size }}
    onClick={onClick}
    title={d.name}
    data-testid={`ct-avatar-${d.id}`}
  >
    {d.avatar_url
      ? <img src={d.avatar_url} alt={d.name} />
      : <span className="ct-avatar__initials">{d.initials}</span>}
  </button>
);

const PresenceDot = () => <span className="ct-presence-dot" aria-hidden />;

const PresenceLabel = ({ presence, locale }) => {
  const key = presence?.state_key || 'in_studio';
  const text = locale === 'en'
    ? (presence?.state_label_en || 'In studio')
    : (presence?.state_label_it || 'In studio');
  return (
    <span key={key} className="ct-presence-label ct-presence-label--crossfade">
      {text}
    </span>
  );
};

const DesignerPresentationModal = ({ designer, locale, onClose }) => {
  if (!designer) return null;
  const isIt = locale !== 'en';
  return createPortal(
    <div className="ct-modal-overlay" onClick={onClose} data-testid="ct-modal">
      <article
        className="ct-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="ct-modal__close" onClick={onClose}
                aria-label="Close" data-testid="ct-modal-close">
          <X size={16} />
        </button>

        <div className="ct-modal__portrait">
          {designer.avatar_url
            ? <img src={designer.avatar_url} alt={designer.name} />
            : <span className="ct-modal__initials">{designer.initials}</span>}
        </div>

        <p className="ct-modal__eyebrow">
          {isIt ? 'PRESENZA CURATORIALE' : 'CURATORIAL PRESENCE'}
        </p>
        <h2 className="ct-modal__name">{designer.name}</h2>
        <p className="ct-modal__role">{designer.role_label}</p>

        <p className="ct-modal__presence">
          <PresenceDot />
          <PresenceLabel presence={designer.current_presence} locale={locale} />
        </p>

        {designer.short_bio && (
          <p className="ct-modal__bio">{designer.short_bio}</p>
        )}

        {(designer.specialties?.length > 0 || designer.languages?.length > 0) && (
          <dl className="ct-modal__facts">
            {designer.specialties?.length > 0 && (
              <div>
                <dt>{isIt ? 'Direzione progettuale' : 'Project direction'}</dt>
                <dd>{designer.specialties.join(' · ')}</dd>
              </div>
            )}
            {designer.languages?.length > 0 && (
              <div>
                <dt>{isIt ? 'Lingue' : 'Languages'}</dt>
                <dd>{designer.languages.join(' · ')}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="ct-modal__actions">
          <a
            href="/client#conversazione"
            className="ct-cta ct-cta--primary"
            onClick={onClose}
            data-testid="ct-cta-message"
          >
            <MessageCircle size={14} strokeWidth={1.7} />
            <span>{isIt ? 'Scrivi un messaggio' : 'Send a message'}</span>
          </a>
          <a
            href="/client#prenota"
            className="ct-cta"
            onClick={onClose}
            data-testid="ct-cta-call"
          >
            <Phone size={14} strokeWidth={1.7} />
            <span>{isIt ? 'Richiedi una call' : 'Request a call'}</span>
          </a>
        </div>
      </article>
    </div>,
    document.body
  );
};

const CuratorialTeamCluster = ({ locale = 'it' }) => {
  const [team, setTeam] = useState([]);
  const [openId, setOpenId] = useState(null);
  const isIt = locale !== 'en';

  // Initial load + soft polling
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getCuratorialTeam()
        .then(({ data }) => { if (alive) setTeam(data?.data || []); })
        .catch(() => {});
    refresh();
    const t = setInterval(refresh, SOFT_REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Realtime presence merge — listen on each designer in the team
  useEffect(() => {
    if (!team.length) return undefined;
    const unsubs = team.map(d => subscribe({
      key: `presence:${d.id}`,
      table: 'designer_presence',
      event: '*',
      filter: `designer_id=eq.${d.id}`,
      onPayload: (p) => {
        if (!p.new) return;
        queueMicrotask(() => {
          setTeam(prev => prev.map(x => x.id === d.id
            ? { ...x, current_presence: { ...x.current_presence, ...p.new } }
            : x));
        });
      },
    }));
    return () => unsubs.forEach(u => u && u());
  }, [team.map(d => d.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const opened = useMemo(
    () => team.find(d => d.id === openId) || null,
    [team, openId]
  );

  if (!team.length) return null;

  // Single → soft pill
  if (team.length === 1) {
    const d = team[0];
    return (
      <>
        <button
          type="button"
          className="ct-pill"
          onClick={() => setOpenId(d.id)}
          data-testid="ct-pill-single"
        >
          <Avatar d={d} size={28} onClick={() => setOpenId(d.id)} />
          <span className="ct-pill__text">
            <span className="ct-pill__name">{d.name.split(' ')[0]}</span>
            <span className="ct-pill__sep">·</span>
            <PresenceLabel presence={d.current_presence} locale={locale} />
          </span>
        </button>
        <DesignerPresentationModal
          designer={opened}
          locale={locale}
          onClose={() => setOpenId(null)}
        />
      </>
    );
  }

  // Multi → stacked cluster
  const visible = team.slice(0, 3);
  const overflow = team.length - visible.length;
  return (
    <>
      <div className="ct-cluster" data-testid="ct-cluster-multi">
        <p className="ct-cluster__label">
          {isIt ? 'Team curatoriale' : 'Curatorial team'}
        </p>
        <div className="ct-cluster__avatars">
          {visible.map(d => (
            <Avatar key={d.id} d={d} size={32} onClick={() => setOpenId(d.id)} />
          ))}
          {overflow > 0 && (
            <button
              type="button"
              className="ct-avatar ct-avatar--overflow"
              onClick={() => setOpenId(team[3].id)}
              data-testid="ct-cluster-overflow"
            >+{overflow}</button>
          )}
        </div>
      </div>
      <DesignerPresentationModal
        designer={opened}
        locale={locale}
        onClose={() => setOpenId(null)}
      />
    </>
  );
};

export default CuratorialTeamCluster;
