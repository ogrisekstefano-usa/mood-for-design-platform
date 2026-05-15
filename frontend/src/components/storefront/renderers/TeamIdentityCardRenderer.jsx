import React, { useState, useEffect } from 'react';
import { UserCircle, Link2 } from 'lucide-react';
import InlineText from '../InlineText';
import api from '../../../lib/api';
import {
  getField,
  BlockToolbar, ToolbarSegment, ToolbarChip,
} from './shared';

// ─── LeaderAvatar ───────────────────────────────────────────────────────
// Graceful fallback: when the public team-leaders avatar is missing or
// fails to load, render the leader's initials inside a warm gold gradient
// — never a broken image frame. Phase U regression fix.

const LeaderAvatar = ({ leader, zoom = 100, className = '', testid }) => {
  const [broken, setBroken] = useState(false);
  const initials = (leader.display_name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((s) => s[0]).join('').toUpperCase() || '·';
  if (!leader.avatar_url || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#E8DFCF] to-[#C9A36E]/70 text-[#1E1E22] ${className}`}
        data-testid={testid}
      >
        <span className="font-heading text-[3.5rem] tracking-[0.05em] opacity-80">{initials}</span>
      </div>
    );
  }
  return (
    <img
      src={leader.avatar_url}
      alt={leader.display_name}
      onError={() => setBroken(true)}
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center 30%' }}
      className={`object-cover transition-transform duration-700 ${className}`}
      data-testid={testid}
    />
  );
};

// ─── team_identity_card ─────────────────────────────────────────────────
// Cinematic editorial introduction of the studio's real reference.
// HUMAN-FIRST RULE: advisors come from the live /team-leaders endpoint —
// no fake users, no stock avatars.

const TeamIdentityCard = ({ section, locale, draft, updateContent, updateSettings, tenantSlug }) => {
  const s = section.settings || {};
  const variant      = s.variant || 'warm';                       // 'warm' | 'dark'
  const alignment    = s.alignment || 'portrait_left';            // 'portrait_left' | 'portrait_right'
  const maxLeaders   = s.max_leaders === 2 ? 2 : 1;
  const portraitZoom = s.portrait_zoom != null ? s.portrait_zoom : 100;
  const showSignature = s.show_signature !== false;

  const [pool, setPool] = useState({ loading: true, leaders: [] });

  useEffect(() => {
    let alive = true;
    if (!tenantSlug) { setPool({ loading: false, leaders: [] }); return; }
    (async () => {
      try {
        const { data } = await api.get(`/api/storefront/public/${encodeURIComponent(tenantSlug)}/team-leaders?max_leaders=4`);
        if (alive) setPool({ loading: false, leaders: data?.leaders || [] });
      } catch (_) {
        if (alive) setPool({ loading: false, leaders: [] });
      }
    })();
    return () => { alive = false; };
  }, [tenantSlug]);

  const visibleLeaders = pool.leaders.slice(0, maxLeaders);
  const wrap = variant === 'dark'
    ? 'bg-[#0F0F12] text-white'
    : 'bg-[#F8F4EC] text-[#1E1E22]';
  const eyebrowColor = variant === 'dark' ? 'text-[#C9A36E]' : 'text-[#9B6B2B]';
  const quoteColor   = variant === 'dark' ? 'text-white/80' : 'text-[#5A4A38]';

  return (
    <div className={`${wrap} py-20 px-12 relative`} data-testid={`section-${section.id}`}>
      <BlockToolbar testid={`team-toolbar-${section.id}`}>
        <ToolbarSegment label="Variant">
          {['warm', 'dark'].map((k) => (
            <ToolbarChip key={k} active={variant === k} onClick={() => updateSettings('variant', k)} testid={`team-variant-${k}-${section.id}`}>
              {k}
            </ToolbarChip>
          ))}
        </ToolbarSegment>
        <ToolbarSegment label="Portrait">
          <ToolbarChip active={alignment === 'portrait_left'} onClick={() => updateSettings('alignment', 'portrait_left')} testid={`team-align-left-${section.id}`}>
            Left
          </ToolbarChip>
          <ToolbarChip active={alignment === 'portrait_right'} onClick={() => updateSettings('alignment', 'portrait_right')} testid={`team-align-right-${section.id}`}>
            Right
          </ToolbarChip>
        </ToolbarSegment>
        <ToolbarSegment label="Show">
          <ToolbarChip active={maxLeaders === 1} onClick={() => updateSettings('max_leaders', 1)} testid={`team-max-1-${section.id}`}>
            1 leader
          </ToolbarChip>
          <ToolbarChip active={maxLeaders === 2} onClick={() => updateSettings('max_leaders', 2)} testid={`team-max-2-${section.id}`}>
            2 leaders
          </ToolbarChip>
        </ToolbarSegment>
        <ToolbarSegment label="Signature">
          <ToolbarChip active={showSignature} onClick={() => updateSettings('show_signature', !showSignature)} testid={`team-sig-${section.id}`}>
            {showSignature ? 'On' : 'Off'}
          </ToolbarChip>
        </ToolbarSegment>
        <ToolbarSegment label="Zoom">
          <input
            type="range" min="80" max="140" step="5"
            value={portraitZoom}
            onChange={(e) => updateSettings('portrait_zoom', parseInt(e.target.value, 10))}
            data-testid={`team-zoom-${section.id}`}
            className="w-20 accent-[var(--bp-primary)]"
          />
          <span className="text-[9px] font-mono opacity-60 tabular-nums">{portraitZoom}</span>
        </ToolbarSegment>
      </BlockToolbar>

      <div className="max-w-6xl mx-auto">
        {pool.loading && (
          <p className="text-center text-current opacity-50 text-xs font-body italic">Loading reference profile…</p>
        )}

        {!pool.loading && visibleLeaders.length === 0 && (
          <div className="text-center py-12 max-w-xl mx-auto">
            <UserCircle size={42} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
            <p className="font-heading text-2xl font-light mb-3">Nessun referente introdotto.</p>
            <p className="text-current opacity-60 text-sm font-body leading-relaxed">
              Quando un membro dello studio completa la sua presentazione, apparirà qui come riferimento del cliente.
            </p>
            <p className="text-current opacity-40 text-[10px] font-body uppercase tracking-[0.25em] mt-5">
              Human-first · no fake profiles
            </p>
          </div>
        )}

        {!pool.loading && visibleLeaders.length === 1 && (() => {
          const leader = visibleLeaders[0];
          const portraitLeft = alignment === 'portrait_left';
          return (
            <div className={`grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-center ${portraitLeft ? '' : 'md:[direction:rtl]'}`}>
              <figure className={`md:col-span-5 ${portraitLeft ? '' : 'md:[direction:ltr]'}`}>
                <div className="aspect-[4/5] overflow-hidden bg-black/10 relative">
                  <LeaderAvatar
                    leader={leader}
                    zoom={portraitZoom}
                    className="absolute inset-0 w-full h-full"
                    testid={`team-portrait-${section.id}`}
                  />
                </div>
                <figcaption className="mt-4">
                  <p className="font-heading text-lg">{leader.display_name}</p>
                  <p className={`text-[10px] font-body uppercase tracking-[0.25em] mt-1 ${eyebrowColor}`}>{leader.role_label}</p>
                </figcaption>
              </figure>

              <div className={`md:col-span-7 ${portraitLeft ? '' : 'md:[direction:ltr]'}`}>
                <InlineText
                  value={getField(section, draft, locale, 'eyebrow')}
                  onChange={(v) => updateContent(locale, 'eyebrow', v)}
                  placeholder="THE STUDIO'S REFERENCE"
                  as="p"
                  className={`text-[10px] font-body uppercase tracking-[0.3em] mb-5 ${eyebrowColor}`}
                  testid={`team-eyebrow-${section.id}`}
                />
                <InlineText
                  value={getField(section, draft, locale, 'headline')}
                  onChange={(v) => updateContent(locale, 'headline', v)}
                  placeholder="Every project begins with a relationship."
                  multiline
                  as="h2"
                  className="font-heading text-4xl md:text-5xl font-light leading-tight mb-6 whitespace-pre-line"
                  testid={`team-headline-${section.id}`}
                />
                {leader.short_bio && (
                  <blockquote className={`relative pl-6 border-l border-current/20 ${quoteColor} text-base font-body leading-relaxed italic mb-6`}>
                    {leader.short_bio}
                  </blockquote>
                )}
                <InlineText
                  value={getField(section, draft, locale, 'subheadline')}
                  onChange={(v) => updateContent(locale, 'subheadline', v)}
                  placeholder="Subheadline — warm editorial copy."
                  multiline
                  as="p"
                  className="text-current opacity-80 text-sm font-body leading-relaxed mb-8 whitespace-pre-line"
                  testid={`team-subheadline-${section.id}`}
                />
                <div className="flex items-center gap-5 flex-wrap">
                  <InlineText
                    value={getField(section, draft, locale, 'cta_label')}
                    onChange={(v) => updateContent(locale, 'cta_label', v)}
                    placeholder="START YOUR PROJECT"
                    as="span"
                    className={`inline-flex items-center gap-2 px-6 py-3 text-[10px] font-body uppercase tracking-[0.25em] ${variant === 'dark' ? 'bg-[#C9A36E] text-black' : 'bg-[#1E1E22] text-white'}`}
                    testid={`team-cta-${section.id}`}
                  />
                  <div className="flex items-center gap-2 text-current opacity-60">
                    <Link2 size={11} strokeWidth={1.5} />
                    <input
                      type="text"
                      value={s.cta_href || ''}
                      onChange={(e) => updateSettings('cta_href', e.target.value)}
                      placeholder="/start-project"
                      data-testid={`team-cta-href-${section.id}`}
                      className="bg-transparent text-[10px] font-mono outline-none w-40 placeholder:text-current/30"
                    />
                  </div>
                  {showSignature && leader.response_time_label && (
                    <p className="text-current opacity-50 text-[10px] font-body uppercase tracking-[0.25em]">
                      · {leader.response_time_label}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {!pool.loading && visibleLeaders.length >= 2 && (
          <div>
            <header className="text-center max-w-3xl mx-auto mb-12">
              <InlineText
                value={getField(section, draft, locale, 'eyebrow')}
                onChange={(v) => updateContent(locale, 'eyebrow', v)}
                placeholder="OUR REFERENCES"
                as="p"
                className={`text-[10px] font-body uppercase tracking-[0.3em] mb-5 ${eyebrowColor}`}
                testid={`team-eyebrow-${section.id}`}
              />
              <InlineText
                value={getField(section, draft, locale, 'headline')}
                onChange={(v) => updateContent(locale, 'headline', v)}
                placeholder="Two people, one studio."
                multiline
                as="h2"
                className="font-heading text-3xl md:text-4xl font-light leading-tight mb-5 whitespace-pre-line"
                testid={`team-headline-${section.id}`}
              />
              <InlineText
                value={getField(section, draft, locale, 'subheadline')}
                onChange={(v) => updateContent(locale, 'subheadline', v)}
                placeholder="Subheadline copy"
                multiline
                as="p"
                className="text-current opacity-75 text-sm font-body leading-relaxed whitespace-pre-line"
                testid={`team-subheadline-${section.id}`}
              />
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto">
              {visibleLeaders.map((l) => (
                <article key={l.id} className="text-center" data-testid={`team-leader-${l.id}`}>
                  <div className="aspect-square overflow-hidden bg-black/10 max-w-[280px] mx-auto mb-4">
                    <LeaderAvatar leader={l} zoom={portraitZoom} className="w-full h-full" testid={`team-leader-portrait-${l.id}`} />
                  </div>
                  <p className="font-heading text-xl">{l.display_name}</p>
                  <p className={`text-[10px] font-body uppercase tracking-[0.25em] mt-1 mb-3 ${eyebrowColor}`}>{l.role_label}</p>
                  {l.short_bio && (
                    <p className="text-current opacity-70 text-sm font-body leading-relaxed max-w-xs mx-auto italic">{l.short_bio}</p>
                  )}
                </article>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5 flex-wrap mt-10">
              <InlineText
                value={getField(section, draft, locale, 'cta_label')}
                onChange={(v) => updateContent(locale, 'cta_label', v)}
                placeholder="START YOUR PROJECT"
                as="span"
                className={`inline-flex items-center gap-2 px-6 py-3 text-[10px] font-body uppercase tracking-[0.25em] ${variant === 'dark' ? 'bg-[#C9A36E] text-black' : 'bg-[#1E1E22] text-white'}`}
                testid={`team-cta-${section.id}`}
              />
            </div>
          </div>
        )}

        {!pool.loading && visibleLeaders.length > 0 && (
          <div className="mt-10 pt-6 border-t border-current/10 text-center">
            <p className="text-current opacity-40 text-[9px] font-body uppercase tracking-[0.3em]">
              {pool.leaders.length} real {pool.leaders.length === 1 ? 'reference' : 'references'} from this studio · public-safe
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamIdentityCard;
