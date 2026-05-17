/**
 * ArticleEditorPanel — right pane of the Composition Room.
 *
 * Strict tab semantics (the user's hard rule):
 *   • "Internal Understanding" tab → REVIEW-ONLY viewer of
 *     `internal_translation` (mirror into blueprint_review_locale).
 *     NEVER editable. NEVER publishable. Banner explains why.
 *   • "Published Locale" tab → EDITABLE + PUBLISHABLE.
 *     Title · excerpt · body blocks · CTA set · SEO.
 *
 * Toolbar verbs use the editorial vocabulary ONLY:
 *   Compose Direction · Refine Editorial Angle · Rebalance Hospitality Tone
 *   No "AI", no "Generate", no "GPT".
 *
 * Preview opens a new tab to `/<locale>/magazine/<slug>?preview=1`.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { statusMeta } from './editorialStatus';
import { Eye, Send, Wand2, Compass, Sparkles, Calendar, BookOpen, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';

const debounce = (fn, ms = 600) => {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export const ArticleEditorPanel = ({ variant: initialVariant, onVariantChanged }) => {
  const [variant, setVariant] = useState(initialVariant);
  const [activeTab, setActiveTab] = useState('published');  // 'published' | 'internal'
  const [internal, setInternal] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [composing, setComposing] = useState(false);
  const [dirty, setDirty] = useState(false);

  // When the parent swaps the selected variant, refresh local state.
  useEffect(() => {
    setVariant(initialVariant);
    setActiveTab('published');
    setInternal(null);
    setDirty(false);
  }, [initialVariant?.id]);

  // Load the internal translation lazily on tab switch.
  useEffect(() => {
    if (activeTab !== 'internal' || !variant?.id || internal) return;
    (async () => {
      try {
        const r = await api.get(`/api/editorial/variants/${variant.id}/internal-translation`);
        setInternal(r.data || {});
      } catch {
        setInternal({});
      }
    })();
  }, [activeTab, variant?.id, internal]);

  if (!variant) return null;
  const meta = statusMeta(variant.status);

  // ── Field patch helpers ─────────────────────────────────────────
  const persistPatch = debounce(async (body) => {
    try {
      const r = await api.patch(`/api/editorial/variants/${variant.id}`, body);
      setVariant((v) => ({ ...v, ...r.data }));
      onVariantChanged?.(r.data);
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    }
  }, 700);

  const patchField = (field, value) => {
    setVariant((v) => ({ ...v, [field]: value }));
    setDirty(true);
    persistPatch({ [field]: value });
  };
  const patchSeo = (key, value) => {
    const seo = { ...(variant.seo || {}), [key]: value };
    patchField('seo', seo);
  };
  const patchCta = (idx, key, value) => {
    const set = [...(variant.cta_set || [])];
    set[idx] = { ...set[idx], [key]: value };
    patchField('cta_set', set);
  };
  const addCta = () => {
    const set = [...(variant.cta_set || []), { tier: 'soft', label: '', action: 'save_reference' }];
    patchField('cta_set', set);
  };
  const removeCta = (idx) => {
    const set = (variant.cta_set || []).filter((_, i) => i !== idx);
    patchField('cta_set', set);
  };
  const patchBlock = (idx, value) => {
    const blocks = [...(variant.body_blocks || [])];
    blocks[idx] = { ...blocks[idx], text: value };
    patchField('body_blocks', blocks);
  };
  const addBlock = () => {
    const blocks = [...(variant.body_blocks || []), { type: 'paragraph', text: '' }];
    patchField('body_blocks', blocks);
  };
  const removeBlock = (idx) => {
    const blocks = (variant.body_blocks || []).filter((_, i) => i !== idx);
    patchField('body_blocks', blocks);
  };

  // ── Editorial verbs (NEVER expose "AI" / "GPT") ─────────────────
  const compose = async () => {
    setComposing(true);
    try {
      const r = await api.post(`/api/editorial/variants/${variant.id}/compose`);
      setVariant(r.data || variant);
      onVariantChanged?.(r.data);
      toast.success('Direzione composta');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Composizione non riuscita');
    } finally { setComposing(false); }
  };

  const refineAngle = async () => {
    const note = window.prompt('Indica l\'angolo editoriale da raffinare:');
    if (!note) return;
    setComposing(true);
    try {
      const r = await api.post(`/api/editorial/variants/${variant.id}/refine-angle`, {
        editor_notes: note, revision_options: [],
      });
      setVariant(r.data || variant);
      onVariantChanged?.(r.data);
      toast.success('Angolo editoriale raffinato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Rifinitura fallita');
    } finally { setComposing(false); }
  };

  const rebalanceTone = async () => {
    const note = window.prompt('Come riequilibrare ritmo / tono / intensità?');
    if (!note) return;
    setComposing(true);
    try {
      const r = await api.post(`/api/editorial/variants/${variant.id}/rebalance-tone`, {
        editor_notes: note,
      });
      setVariant(r.data || variant);
      onVariantChanged?.(r.data);
      toast.success('Tono di hospitality riequilibrato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Riequilibrio fallito');
    } finally { setComposing(false); }
  };

  const transition = async (to) => {
    try {
      const r = await api.post(`/api/editorial/variants/${variant.id}/transition`, { to });
      setVariant((v) => ({ ...v, status: to }));
      onVariantChanged?.({ ...variant, status: to });
      toast.success(`Stato → ${statusMeta(to).label}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Transizione non riuscita');
    }
  };

  const openSchedule = () => {
    setScheduledAt(variant.scheduled_at ? variant.scheduled_at.slice(0, 16) : '');
    setScheduling(true);
  };
  const confirmSchedule = async () => {
    if (!scheduledAt) return setScheduling(false);
    try {
      // Persist created_at + tenant timezone hints inside metadata for
      // future per-market timezone scheduling.
      const iso = new Date(scheduledAt).toISOString();
      await api.post(`/api/editorial/variants/${variant.id}/schedule`, {
        scheduled_at: iso,
      });
      setVariant((v) => ({ ...v, scheduled_at: iso, status: 'scheduled' }));
      onVariantChanged?.({ ...variant, scheduled_at: iso, status: 'scheduled' });
      toast.success('Programmazione confermata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Programmazione fallita');
    } finally { setScheduling(false); }
  };

  const publishNow = () => transition('published');
  const sendToReview = () => transition('ready_for_editorial_review');
  const approveDraft = () => transition('approved');

  const previewUrl = () => {
    const locale = variant.target_locale || 'it-IT';
    const slug = variant.variant_slug || '';
    return `/${locale}/magazine/${slug}?preview=1`;
  };

  return (
    <section className="ed-pane" data-testid="ed-pane">
      {/* TOOLBAR */}
      <header className="ed-toolbar" data-testid="ed-toolbar">
        <div className="ed-toolbar__title">
          <p className="ed-toolbar__market">
            {variant.target_locale}{variant.target_sub_region ? ` · ${variant.target_sub_region}` : ''}
          </p>
          <h1 className="ed-toolbar__h" data-testid="ed-toolbar-title">{variant.title || variant.variant_slug || 'Senza titolo'}</h1>
          <p className="ed-toolbar__status" data-testid="ed-toolbar-status">
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: meta.dot, display: 'inline-block' }} />
            {meta.label}
            {variant.scheduled_at && variant.status === 'scheduled' && (
              <span style={{ marginLeft: 10, opacity: 0.7 }}>
                · {new Date(variant.scheduled_at).toLocaleString('it-IT')}
              </span>
            )}
            {dirty && <span style={{ marginLeft: 12, opacity: 0.55 }}>Salvataggio…</span>}
          </p>
        </div>
        <div className="ed-toolbar__actions">
          <button className="ed-btn" data-testid="ed-action-compose"
            onClick={compose} disabled={composing}>
            <Wand2 size={13} strokeWidth={1.5} /> Compose Direction
          </button>
          <button className="ed-btn" data-testid="ed-action-refine"
            onClick={refineAngle} disabled={composing}>
            <Compass size={13} strokeWidth={1.5} /> Refine Editorial Angle
          </button>
          <button className="ed-btn" data-testid="ed-action-rebalance"
            onClick={rebalanceTone} disabled={composing}>
            <Sparkles size={13} strokeWidth={1.5} /> Rebalance Hospitality Tone
          </button>
          <a className="ed-btn" data-testid="ed-action-preview"
            href={previewUrl()} target="_blank" rel="noreferrer">
            <Eye size={13} strokeWidth={1.5} /> Preview <ExternalLink size={10} strokeWidth={1.5} />
          </a>
          {variant.status === 'ready_for_editorial_review' && (
            <button className="ed-btn" data-testid="ed-action-approve" onClick={approveDraft}>
              Approva
            </button>
          )}
          {(variant.status === 'draft' || variant.status === 'ai_composing' || variant.status === 'revision_requested') && (
            <button className="ed-btn" data-testid="ed-action-send-review" onClick={sendToReview}>
              <Send size={13} strokeWidth={1.5} /> Invia in review
            </button>
          )}
          {(variant.status === 'approved' || variant.status === 'scheduled') && (
            <button className="ed-btn" data-testid="ed-action-schedule" onClick={openSchedule}>
              <Calendar size={13} strokeWidth={1.5} /> Programma
            </button>
          )}
          {(variant.status === 'approved' || variant.status === 'scheduled') && (
            <button className="ed-btn ed-btn--primary" data-testid="ed-action-publish" onClick={publishNow}>
              Pubblica ora
            </button>
          )}
        </div>
      </header>

      {/* TABS */}
      <div className="ed-tabs" data-testid="ed-tabs">
        <button
          type="button"
          className="ed-tab"
          data-testid="ed-tab-published"
          data-active={activeTab === 'published'}
          onClick={() => setActiveTab('published')}
        >
          <span className="ed-tab__eyebrow">Final · Public</span>
          Published Locale
        </button>
        <button
          type="button"
          className="ed-tab"
          data-testid="ed-tab-internal"
          data-active={activeTab === 'internal'}
          onClick={() => setActiveTab('internal')}
        >
          <span className="ed-tab__eyebrow">Editor · Review-only</span>
          Internal Understanding
        </button>
      </div>

      {/* BODY */}
      <div className="ed-body" data-testid="ed-body">
        {activeTab === 'internal' && (
          <InternalReviewView internal={internal} />
        )}

        {activeTab === 'published' && (
          <PublishedEditorView
            variant={variant}
            patchField={patchField}
            patchSeo={patchSeo}
            patchCta={patchCta}
            addCta={addCta}
            removeCta={removeCta}
            patchBlock={patchBlock}
            addBlock={addBlock}
            removeBlock={removeBlock}
          />
        )}
      </div>

      {/* Schedule modal */}
      {scheduling && (
        <div className="ed-modal-bg" data-testid="ed-modal-bg" onClick={() => setScheduling(false)}>
          <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Programma pubblicazione</h2>
            <p className="ed-modal__sub">
              La variante apparirà online esattamente all'orario indicato (UTC del browser).
            </p>
            <input
              type="datetime-local"
              className="ed-input"
              data-testid="ed-schedule-input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <div className="ed-modal__actions">
              <button className="ed-btn" data-testid="ed-schedule-cancel" onClick={() => setScheduling(false)}>Annulla</button>
              <button className="ed-btn ed-btn--primary" data-testid="ed-schedule-confirm" onClick={confirmSchedule}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// ─── Internal Translation = review-only viewer ───────────────────
const InternalReviewView = ({ internal }) => {
  if (!internal) return <p className="ed-internal-empty">Caricamento della comprensione editoriale…</p>;
  const has = internal && (internal.title || internal.excerpt || (internal.body_blocks || []).length > 0);
  return (
    <>
      <div className="ed-internal-banner" data-testid="ed-internal-banner">
        <BookOpen size={15} strokeWidth={1.5} className="ed-internal-banner__icon" />
        <div className="ed-internal-banner__text">
          <strong>Review Translation — Internal Use Only</strong>
          Questa è la comprensione editoriale nella lingua di review (it-IT). Serve unicamente al
          redattore Blueprint per verificare l'angolo culturale: <strong>non è pubblicabile</strong>,
          <strong> non è indicizzata</strong> e <strong>non sostituisce</strong> la versione market.
        </div>
      </div>
      {!has && (
        <p className="ed-internal-empty">Nessuna comprensione editoriale disponibile per questa variante.</p>
      )}
      {has && (
        <article className="ed-internal-readonly" data-testid="ed-internal-content">
          {internal.title && <h3>{internal.title}</h3>}
          {internal.excerpt && <p style={{ fontStyle: 'italic', opacity: 0.85 }}>{internal.excerpt}</p>}
          {(internal.body_blocks || []).map((b, i) => (
            <p key={i}>{b.text || ''}</p>
          ))}
        </article>
      )}
    </>
  );
};

// ─── Published Locale = editable form ────────────────────────────
const PublishedEditorView = ({ variant, patchField, patchSeo, patchCta, addCta, removeCta, patchBlock, addBlock, removeBlock }) => {
  const seo = variant.seo || {};
  return (
    <>
      <div className="ed-section" data-testid="ed-section-title">
        <p className="ed-section__label">Titolo · final public</p>
        <input
          type="text"
          className="ed-input ed-input--display"
          data-testid="ed-field-title"
          value={variant.title || ''}
          onChange={(e) => patchField('title', e.target.value)}
          placeholder="Il titolo definitivo per il mercato"
        />
      </div>

      <div className="ed-section">
        <p className="ed-section__label">Excerpt · cultural angle</p>
        <textarea
          className="ed-textarea ed-input--excerpt"
          data-testid="ed-field-excerpt"
          rows={3}
          value={variant.excerpt || ''}
          onChange={(e) => patchField('excerpt', e.target.value)}
          placeholder="L'angolo emotivo che apre l'articolo nel mercato target."
        />
      </div>

      <div className="ed-section">
        <p className="ed-section__label">Body</p>
        {(variant.body_blocks || []).map((b, i) => (
          <div key={i} className="ed-block" data-testid={`ed-block-${i}`}>
            <p className="ed-block__type">{b.type || 'paragraph'}</p>
            <textarea
              className="ed-textarea"
              rows={3}
              data-testid={`ed-block-${i}-text`}
              value={b.text || ''}
              onChange={(e) => patchBlock(i, e.target.value)}
            />
            <button className="ed-block__remove" data-testid={`ed-block-${i}-remove`}
              onClick={() => removeBlock(i)} title="Rimuovi blocco">×</button>
          </div>
        ))}
        <button type="button" className="ed-btn" data-testid="ed-add-block" onClick={addBlock}>
          + Aggiungi paragrafo
        </button>
      </div>

      <div className="ed-section" data-testid="ed-section-cta">
        <p className="ed-section__label">CTA · tier · azione · transizione editoriale</p>
        {(variant.cta_set || []).map((cta, i) => (
          <div key={i} className="ed-cta" data-testid={`ed-cta-${i}`}>
            <div className="ed-cta__row">
              <select
                className="ed-cta__tier"
                data-testid={`ed-cta-${i}-tier`}
                value={cta.tier || 'soft'}
                onChange={(e) => patchCta(i, 'tier', e.target.value)}
              >
                <option value="soft">Soft</option>
                <option value="medium">Medium</option>
                <option value="strong">Strong</option>
              </select>
              <input
                type="text"
                className="ed-cta__label"
                data-testid={`ed-cta-${i}-label`}
                value={cta.label || ''}
                onChange={(e) => patchCta(i, 'label', e.target.value)}
                placeholder="Copy editoriale della CTA"
              />
              <select
                className="ed-cta__tier"
                data-testid={`ed-cta-${i}-action`}
                value={cta.action || 'save_reference'}
                onChange={(e) => patchCta(i, 'action', e.target.value)}
              >
                <option value="save_reference">Save reference</option>
                <option value="discuss_with_advisor">Discuss with advisor</option>
                <option value="add_to_moodboard">Add to moodboard</option>
                <option value="explore_material">Explore material</option>
                <option value="book_visit">Book visit</option>
              </select>
              <button className="ed-block__remove" data-testid={`ed-cta-${i}-remove`}
                onClick={() => removeCta(i)} title="Rimuovi CTA">×</button>
            </div>
          </div>
        ))}
        <button type="button" className="ed-btn" data-testid="ed-add-cta" onClick={addCta}>
          + Aggiungi CTA
        </button>
      </div>

      <div className="ed-section" data-testid="ed-section-seo">
        <p className="ed-section__label">SEO · editorial-grade</p>
        <input
          type="text"
          className="ed-input"
          data-testid="ed-field-seo-title"
          value={seo.seo_title || ''}
          onChange={(e) => patchSeo('seo_title', e.target.value)}
          placeholder="SEO title — narrativo, ≤ 60 caratteri"
        />
        <p style={{ marginTop: 16 }} />
        <textarea
          className="ed-textarea"
          data-testid="ed-field-seo-description"
          rows={2}
          value={seo.meta_description || ''}
          onChange={(e) => patchSeo('meta_description', e.target.value)}
          placeholder="Meta description editoriale — ≤ 155 caratteri"
        />
        <p style={{ marginTop: 16 }} />
        <input
          type="text"
          className="ed-input"
          data-testid="ed-field-seo-focus"
          value={seo.focus_intent || ''}
          onChange={(e) => patchSeo('focus_intent', e.target.value)}
          placeholder="Focus intent (es. 'editorial:atmosphere')"
        />
      </div>
    </>
  );
};

export default ArticleEditorPanel;
