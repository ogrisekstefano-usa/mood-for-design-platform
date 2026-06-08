/**
 * ProofreadingInboxPage · STORE-008A MVP
 * Gmail-style approval queue · NOT a content editor.
 * 4 actions only: APPROVA · CHIEDI MODIFICA · RIGENERA · PUBBLICA
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, MessageSquare, RefreshCw, Send, AlertTriangle,
  Loader2, Inbox,
} from 'lucide-react';
import api from '../../lib/api';
import './proofreading-inbox.css';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 7) return `${days}g fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

const STATUS_TO_CARD_CLS = {
  in_proofreading: '',
  ready_for_editorial_review: '',
  draft: '',
  changes_requested: '',
  approved: 'epi-card--approved',
  ready_to_publish: 'epi-card--approved',
  published: 'epi-card--published',
  media_required: 'epi-card--blocked',
};

const ProofreadingInboxPage = () => {
  const [params] = useSearchParams();
  const statusFilter = params.get('status') || 'in_proofreading';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  /* List fetcher */
  const loadList = useCallback(() => {
    setLoading(true);
    api.get(`/api/editorial/inbox?status_filter=${encodeURIComponent(statusFilter)}`)
      .then((r) => {
        const arr = r.data?.items || [];
        setItems(arr);
        if (arr.length > 0 && !selectedId) setSelectedId(arr[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, selectedId]);

  useEffect(() => { loadList(); }, [statusFilter]);// eslint-disable-line react-hooks/exhaustive-deps

  /* Detail fetcher */
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancel = false;
    setDetailLoading(true);
    api.get(`/api/editorial/inbox/${selectedId}`)
      .then((r) => { if (!cancel) { setDetail(r.data); setDetailLoading(false); } })
      .catch(() => { if (!cancel) setDetailLoading(false); });
    return () => { cancel = true; };
  }, [selectedId]);

  /* Action wrappers */
  const act = async (verb, body = null) => {
    if (!selectedId || acting) return;
    setActing(true);
    try {
      const url = `/api/editorial/inbox/${selectedId}/${verb}`;
      await api.post(url, body || {});
      // Refresh list + detail
      loadList();
      const r = await api.get(`/api/editorial/inbox/${selectedId}`);
      setDetail(r.data);
    } catch (e) {
      console.warn('[inbox] action failed', verb, e);
    } finally {
      setActing(false);
    }
  };
  const onApprove        = () => act('approve');
  const onRequestRevision = () => {
    const notes = window.prompt('Quali modifiche chiedere a Blueprint AI?');
    if (notes !== null) act('request-revision', { notes });
  };
  const onRegenerate     = () => {
    if (window.confirm('Rigenero il contenuto da capo?')) act('regenerate');
  };
  const onPublish        = () => {
    if (window.confirm('Pubblicare ora?')) act('publish');
  };

  const isBlocked = detail?.is_blocked;
  /* STORE-008A · locale-mismatch guard (cheap heuristic)
     Flags variants where body_blocks looks like it was inherited from the
     master canonical_locale instead of the variant target_locale. */
  const localeMismatch = useMemo(() => {
    if (!detail) return false;
    const tl = (detail.target_locale || '').slice(0, 2).toLowerCase();
    if (!tl) return false;
    const bodyText = (detail.body_blocks || [])
      .map((b) => b.text || b.body || b.content || '')
      .join(' ')
      .slice(0, 1200);
    if (bodyText.length < 60) return false;
    // very lightweight cheat-detector based on language-specific function-words
    const hits = {
      en: (bodyText.match(/\b(the|and|with|of|for|is|are|this|that|which|in)\b/gi) || []).length,
      it: (bodyText.match(/\b(il|la|le|gli|lo|del|della|che|con|per|sono|è|nel|nella|come)\b/gi) || []).length,
      fr: (bodyText.match(/\b(le|la|les|des|du|et|qui|dans|pour|avec|une|aux|aux)\b/gi) || []).length,
      es: (bodyText.match(/\b(el|la|los|las|de|que|con|por|para|este|esta)\b/gi) || []).length,
      de: (bodyText.match(/\b(der|die|das|und|mit|für|ist|sind|von|im|den)\b/gi) || []).length,
    };
    const top = Object.entries(hits).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 5) return false;
    return top[0] !== tl;
  }, [detail]);

  const channelEmoji = useMemo(() => {
    if (!detail?.channel) return '📝';
    const c = detail.channel.toLowerCase();
    if (c.includes('linkedin'))  return '💼';
    if (c.includes('pinterest')) return '📌';
    if (c.includes('instagram')) return '📷';
    if (c.includes('newsletter')) return '✉️';
    if (c.includes('case'))      return '🏛';
    if (c.includes('landing'))   return '🌐';
    return '📝';
  }, [detail]);

  return (
    <div className="epi-shell" data-testid="proofreading-inbox">
      <header className="epi-header">
        <div>
          <p className="epi-header__eyebrow">Proofreading Inbox™</p>
          <h1 className="epi-header__title">In attesa di approvazione</h1>
        </div>
        <span className="epi-header__count">{items.length} {statusFilter === 'in_proofreading' ? 'da revisionare' : 'risultati'}</span>
      </header>

      <div className="epi-body">
        {/* LIST */}
        <div className="epi-list" data-testid="epi-list">
          {loading && <div className="epi-list-empty"><Loader2 size={16} className="epi-spin" /> Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="epi-list-empty">
              <Inbox size={28} strokeWidth={1.5} style={{ opacity: 0.4 }} />
              <p style={{ marginTop: 12 }}>Nessun contenuto in {statusFilter === 'in_proofreading' ? 'proofreading' : statusFilter}.</p>
            </div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              data-testid={`epi-card-${it.id}`}
              className={`epi-card ${STATUS_TO_CARD_CLS[it.status] || ''} ${selectedId === it.id ? 'epi-card--active' : ''}`}
              onClick={() => setSelectedId(it.id)}
            >
              <div className="epi-card__top">
                <span className="epi-card__dot" />
                <span>{it.market_label || it.market_code || '—'}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{fmtDate(it.updated_at || it.created_at)}</span>
              </div>
              <div className="epi-card__title">{it.title}</div>
              <div className="epi-card__meta">
                <span><b>{it.channel}</b></span>
                <span>{it.target_locale}</span>
                <span>· {it.status_label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* DETAIL */}
        {!detail && !detailLoading && (
          <div className="epi-empty">
            <Inbox size={36} strokeWidth={1.2} style={{ opacity: 0.4 }} />
            <p className="epi-empty__title">Seleziona un contenuto</p>
            <p>La revisione bilingue apparirà qui.</p>
          </div>
        )}
        {detailLoading && <div className="epi-empty"><Loader2 size={18} className="epi-spin" /> Loading…</div>}
        {detail && (
          <div className="epi-detail">
            {/* LEFT · target market version */}
            <div className="epi-detail__col epi-detail__col--left" data-testid="epi-target">
              <div className="epi-target">
                <div className="epi-target__hero">
                  {detail.hero_image_url && <img src={detail.hero_image_url} alt="" />}
                  <div className="epi-target__hero-veil" />
                  {isBlocked && (
                    <div className="epi-blocked-banner" data-testid="epi-media-required">
                      <p className="epi-blocked-banner__title">⚠ Media Required</p>
                      <p className="epi-blocked-banner__sub">
                        Blueprint AI non pubblica con stock photos.
                        Seleziona immagini autorizzate dalla Media Library.
                      </p>
                    </div>
                  )}
                </div>

                <p className="epi-eyebrow">{detail.channel} · {detail.target_locale}</p>
                <h2 className="epi-title">{detail.title}</h2>
                <p className="epi-excerpt">{detail.excerpt}</p>

                <div className="epi-target__meta">
                  <div className="epi-meta">
                    <span className="epi-meta__label">Mercato</span>
                    <span className="epi-meta__value">{detail.market?.code?.replace(/_/g, ' ') || '—'}</span>
                  </div>
                  <div className="epi-meta">
                    <span className="epi-meta__label">Tono</span>
                    <span className="epi-meta__value">{detail.tone || detail.locale_profile?.editorial_tone || '—'}</span>
                  </div>
                  <div className="epi-meta">
                    <span className="epi-meta__label">Stato</span>
                    <span className="epi-meta__value">{detail.status_label}</span>
                  </div>
                  <div className="epi-meta">
                    <span className="epi-meta__label">Aggiornato</span>
                    <span className="epi-meta__value">{fmtDate(detail.updated_at)}</span>
                  </div>
                </div>

                {detail.body_blocks && Array.isArray(detail.body_blocks) && detail.body_blocks.length > 0 && (
                  detail.body_blocks.slice(0, 4).map((b, i) => (
                    <p key={i} className="epi-body-block">{b.text || b.body || b.content || ''}</p>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT · explanation in tenant language */}
            <div className="epi-detail__col" data-testid="epi-explanation">
              <div className="epi-expl-block">
                <p className="epi-expl-block__label">Spiegazione in italiano · perché esiste questo contenuto</p>
                <p className={`epi-expl-block__body ${detail.explanation_local ? '' : 'epi-expl-block__body--mute'}`}>
                  {detail.explanation_local || 'Blueprint AI sta ancora preparando la motivazione per questo contenuto.'}
                </p>
              </div>

              {detail.ai_motivation && (
                <div className="epi-expl-block">
                  <p className="epi-expl-block__label">Motivazione strategica</p>
                  <p className="epi-expl-block__body">{detail.ai_motivation}</p>
                </div>
              )}

              {detail.ai_audience && (
                <div className="epi-expl-block">
                  <p className="epi-expl-block__label">Audience target</p>
                  <p className="epi-expl-block__body">{detail.ai_audience}</p>
                </div>
              )}

              {detail.ai_keywords && detail.ai_keywords.length > 0 && (
                <div className="epi-expl-block">
                  <p className="epi-expl-block__label">Parole chiave</p>
                  <div className="epi-keywords">
                    {detail.ai_keywords.map((k, i) => <span key={i} className="epi-kw">{k}</span>)}
                  </div>
                </div>
              )}

              {detail.ai_notes && detail.ai_notes.length > 0 && (
                <div className="epi-expl-block">
                  <p className="epi-expl-block__label">Note AI</p>
                  <ul className="epi-notes-list">
                    {detail.ai_notes.map((n, i) => <li key={i}>{typeof n === 'string' ? n : (n.text || JSON.stringify(n))}</li>)}
                  </ul>
                </div>
              )}

              {detail.ai_sources && detail.ai_sources.length > 0 && (
                <div className="epi-expl-block">
                  <p className="epi-expl-block__label">Fonti utilizzate</p>
                  <ul className="epi-notes-list">
                    {detail.ai_sources.map((s, i) => <li key={i}>{s.label || s.type || JSON.stringify(s)}</li>)}
                  </ul>
                </div>
              )}

              <div className="epi-expl-block">
                <p className="epi-expl-block__label">Hotspot proposti</p>
                {(!detail.proposed_hotspots || detail.proposed_hotspots.length === 0)
                  ? <p className="epi-expl-block__body epi-expl-block__body--mute">Nessun hotspot proposto · review only nel MVP.</p>
                  : (
                    <div className="epi-hotspots">
                      {detail.proposed_hotspots.slice(0, 6).map((h, i) => (
                        <div key={i} className="epi-hotspot">
                          <span className="epi-hotspot__plus">+</span>
                          <div>
                            <span className="epi-hotspot__title">{h.title || h.label || `Hotspot ${i + 1}`}</span>
                            {h.body && <span className="epi-hotspot__sub">· {h.body.slice(0, 60)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <div className="epi-actions" data-testid="epi-actions">
                <button
                  type="button"
                  className="epi-action-btn epi-action-btn--approve"
                  data-testid="epi-action-approve"
                  onClick={onApprove}
                  disabled={acting || isBlocked || localeMismatch || detail.status === 'approved' || detail.status === 'published'}
                  title={isBlocked ? 'Sblocca i media richiesti prima di approvare' : (localeMismatch ? 'Rigenera nella lingua target prima di approvare' : '')}
                >
                  <CheckCircle2 size={13} strokeWidth={2} /> Approva
                </button>
                <button
                  type="button"
                  className="epi-action-btn epi-action-btn--revise"
                  data-testid="epi-action-revise"
                  onClick={onRequestRevision}
                  disabled={acting || detail.status === 'published'}
                >
                  <MessageSquare size={13} strokeWidth={2} /> Chiedi modifica
                </button>
                <button
                  type="button"
                  className="epi-action-btn epi-action-btn--regenerate"
                  data-testid="epi-action-regenerate"
                  onClick={onRegenerate}
                  disabled={acting || detail.status === 'published'}
                >
                  <RefreshCw size={13} strokeWidth={2} /> Rigenera
                </button>
                <button
                  type="button"
                  className="epi-action-btn epi-action-btn--publish"
                  data-testid="epi-action-publish"
                  onClick={onPublish}
                  disabled={acting || isBlocked || detail.status === 'published'}
                >
                  <Send size={13} strokeWidth={2} /> Pubblica
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProofreadingInboxPage;
