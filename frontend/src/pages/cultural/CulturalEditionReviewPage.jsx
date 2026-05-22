/**
 * CulturalEditionReviewPage — Side-by-side editorial review.
 *
 * Mostra il Contenuto base (sinistra) e la Versione mercato (destra)
 * per una specifica edizione culturale. Atto editoriale, non gestionale.
 *
 * Linguaggio: 100% italiano, niente jargon. "Master/Variant/Conversion"
 * → "Contenuto base/Versione mercato/Revisione editoriale".
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './cultural-editions.css';
import { useT } from '../../i18n/useT';

const STATUS_LABEL_KEY = {
  draft:     'taxonomy.cultural_edition.draft',
  in_review: 'taxonomy.cultural_edition.in_review',
  approved:  'taxonomy.cultural_edition.approved',
  archived:  'taxonomy.cultural_edition.archived',
};

const CulturalEditionReviewPage = () => {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get(`/api/cultural-editions/drafts/${id}`)
      .then((r) => setDraft(r.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Edizione non trovata'));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const setStatus = async (status) => {
    setSaving(true);
    try {
      const r = await api.patch(`/api/cultural-editions/drafts/${id}`, { status });
      setDraft({ ...draft, ...r.data });
      toast.success(`${t('cultural.cultural_edition_review.status_updated', null, 'Status updated')} · ${t(STATUS_LABEL_KEY[status] || `taxonomy.cultural_edition.${status}`, null, status)}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Aggiornamento fallito');
    } finally { setSaving(false); }
  };

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-empty" data-testid="ce-review-error">
          <Icons.AlertCircle size={22} strokeWidth={1.2} />
          <p>{error}</p>
          <Link to="/workspace/cultural-editions" className="ce-btn">
            <Icons.ArrowLeft size={12} /> Torna all'indice
          </Link>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="ce-page">
        <div className="ce-skel-block" data-testid="ce-review-loading">Apertura dell'edizione…</div>
      </div>
    );
  }

  const src = draft.source_payload || {};
  const ver = draft.market_version || {};
  const market = draft.market || {};
  const fallback = draft.generation_meta?.fallback;

  return (
    <div className="ce-page" data-testid="cultural-edition-review">
      <header className="ce-review-head">
        <div className="ce-review-head__top">
          <Link to="/workspace/cultural-editions" className="ce-back" data-testid="ce-back">
            <Icons.ArrowLeft size={12} /> Cultural Edition™
          </Link>
          <span className={`ce-status ce-status--${draft.status}`} data-testid="ce-status">
            {t(STATUS_LABEL_KEY[draft.status] || `taxonomy.cultural_edition.${draft.status}`, null, draft.status)}
          </span>
        </div>
        <p className="ce-eyebrow">{t('cultural.cultural_edition_review.revisione_editoriale')}</p>
        <h1 className="ce-title">
          {draft.source_title || 'Contenuto base'} <span className="ce-arrow">→</span> {draft.target_market_label}
        </h1>
        {market?.atmosphere && (
          <p className="ce-lede">{market.atmosphere}</p>
        )}
        {fallback && (
          <div className="ce-note-banner" data-testid="ce-review-fallback">
            <Icons.Info size={13} />
            <span>
              Adattamento provvisorio in attesa della redazione editoriale completa.
              Puoi modificarlo direttamente o richiedere una nuova passata.
            </span>
          </div>
        )}
      </header>

      <div className="ce-review-grid" data-testid="ce-review-grid">
        {/* SINISTRA — Contenuto base */}
        <section className="ce-pane" data-testid="ce-pane-source">
          <div className="ce-pane__head">
            <p className="ce-pane__eyebrow">Contenuto base</p>
            <h2 className="ce-pane__title">{draft.source_title || 'Senza titolo'}</h2>
            <p className="ce-pane__sub">{src.type || draft.source_type}</p>
          </div>
          {src.cover_url && (
            <div className="ce-pane__cover">
              <img src={src.cover_url} alt={draft.source_title || ''} />
            </div>
          )}
          {src.description && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Descrizione</p>
              <p className="ce-block-body">{src.description}</p>
            </div>
          )}
          {Array.isArray(src.style_tags) && src.style_tags.length > 0 && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Stili</p>
              <div className="ce-chips">{src.style_tags.slice(0, 8).map((s, i) => <span key={i}>{s}</span>)}</div>
            </div>
          )}
          {Array.isArray(src.atmosphere) && src.atmosphere.length > 0 && (
            <div className="ce-pane__block">
              <p className="ce-block-label">{t('cultural.cultural_edition_review.atmosfera_originaria')}</p>
              <div className="ce-chips">{src.atmosphere.slice(0, 8).map((s, i) => <span key={i}>{s}</span>)}</div>
            </div>
          )}
          {src.location && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Location</p>
              <p className="ce-block-body">{src.location}</p>
            </div>
          )}
        </section>

        {/* DESTRA — Versione mercato */}
        <section className="ce-pane ce-pane--market" data-testid="ce-pane-market">
          <div className="ce-pane__head">
            <p className="ce-pane__eyebrow">
              <Icons.Globe size={11} /> Versione mercato · {draft.target_market_label}
            </p>
            <h2 className="ce-pane__title ce-pane__title--editorial">{ver.headline || 'Titolo in preparazione'}</h2>
            {ver.lede && <p className="ce-pane__lede">{ver.lede}</p>}
          </div>
          {ver.body && (
            <div className="ce-pane__block">
              <p className="ce-block-label">{t('cultural.cultural_edition_review.corpo_editoriale')}</p>
              <p className="ce-block-body ce-block-body--narrative">{ver.body}</p>
            </div>
          )}
          {(ver.cta_label || ver.cta_subtext) && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Call to action</p>
              <div className="ce-cta-card">
                <span className="ce-cta-card__label">{ver.cta_label}</span>
                {ver.cta_subtext && <span className="ce-cta-card__sub">{ver.cta_subtext}</span>}
              </div>
            </div>
          )}
          {ver.atmosphere_notes && (
            <div className="ce-pane__block">
              <p className="ce-block-label">{t('cultural.cultural_edition_review.atmosfera')}</p>
              <p className="ce-block-body ce-block-body--narrative">{ver.atmosphere_notes}</p>
            </div>
          )}
          {ver.material_notes && (
            <div className="ce-pane__block">
              <p className="ce-block-label">{t('atelier_voice.cultural_edition.palette_label', null, 'Material palette')}</p>
              <p className="ce-block-body ce-block-body--narrative">{ver.material_notes}</p>
            </div>
          )}
          {ver.imagery_notes && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Riferimenti visivi</p>
              <p className="ce-block-body ce-block-body--narrative">{ver.imagery_notes}</p>
            </div>
          )}
          {ver.cultural_notes && (
            <div className="ce-pane__block">
              <p className="ce-block-label">Riferimenti culturali</p>
              <p className="ce-block-body ce-block-body--narrative">{ver.cultural_notes}</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Market Narrative Profile™ — direzione narrativa applicata ── */}
      {(draft.selected_narrative_mode || draft.suggested_narrative_mode) && (
        <section className="ce-narrative-trace" data-testid="ce-narrative-trace">
          <p className="ce-eyebrow">
            <Icons.Compass size={11} /> Direzione narrativa applicata
          </p>
          <div className="ce-narrative-trace__grid">
            <div>
              <span className="ce-narrative-trace__lbl">Modalità</span>
              <span className="ce-narrative-trace__val">{draft.selected_narrative_mode || draft.suggested_narrative_mode}</span>
            </div>
            <div>
              <span className="ce-narrative-trace__lbl">Intensità</span>
              <span className="ce-narrative-trace__val">{draft.selected_intensity || draft.suggested_intensity}</span>
            </div>
            <div>
              <span className="ce-narrative-trace__lbl">Origine</span>
              <span className="ce-narrative-trace__val">
                {draft.manual_override
                  ? 'personalizzata dal designer'
                  : `suggerita dal mercato ${draft.target_market_label || ''}`.trim()}
              </span>
            </div>
          </div>
          {draft.applied_market_biases?.narrative_direction?.length > 0 && (
            <div className="ce-narrative-trace__chips" data-testid="ce-narrative-trace-chips">
              {draft.applied_market_biases.narrative_direction.slice(0, 6).map((d, i) => (
                <span key={i} className="ce-narrative-trace__chip">{d}</span>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="ce-review-foot">
        <div className="ce-review-foot__meta">
          <span>Lingua: {draft.target_locale}</span>
          <span>·</span>
          <span>Creato: {new Date(draft.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="ce-review-foot__actions">
          {draft.status === 'draft' && (
            <button type="button" className="ce-btn"
                    onClick={() => setStatus('in_review')} disabled={saving}
                    data-testid="ce-action-review">
              <Icons.Eye size={12} /> Manda in revisione
            </button>
          )}
          {draft.status === 'in_review' && (
            <button type="button" className="ce-btn ce-btn--primary"
                    onClick={() => setStatus('approved')} disabled={saving}
                    data-testid="ce-action-approve">
              <Icons.Check size={12} /> Approva versione mercato
            </button>
          )}
          {draft.status !== 'archived' && (
            <button type="button" className="ce-btn ce-btn--ghost"
                    onClick={() => setStatus('archived')} disabled={saving}
                    data-testid="ce-action-archive">
              <Icons.Archive size={12} /> Archivia
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default CulturalEditionReviewPage;
