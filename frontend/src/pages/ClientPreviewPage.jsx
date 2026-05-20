/**
 * ClientPreviewPage — Private Curatorial Presentation Experience™.
 * Sprint F2.4.
 *
 * Route: /preview/:token  (PUBLIC, no auth)
 *
 * NON è una gallery condivisa.
 * NON è un client portal enterprise.
 * È **una stanza digitale curatoriale privata** firmata dallo studio.
 *
 * Stile:
 *   • dark luxury cinematic
 *   • zero sidebar / topbar / tools
 *   • fullscreen optimized (works on iPad / showroom monitor / mobile)
 *   • transitions morbide (Apple keynote feeling)
 *
 * Layout:
 *   • Header minimale: titolo + studio + stato
 *   • Hero della direzione (eyebrow + title Playfair)
 *   • Sequence narrativa di asset a 1 colonna immersiva
 *   • Footer minimale: Approvo · Esplora alternative · Aggiungi nota
 *
 * Modes (consumati dal backend):
 *   editorial · material · storytelling · composition
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import './client-preview.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// ─── Mode-specific cinematic tuning ─────────────────────────────────
const MODE_AMBIENT = {
  editorial: {
    eyebrow:    'Una direzione progettuale',
    accentHex:  '#d9b285',
    intro:      'Una sequenza editoriale luminosa, da percorrere come una conversazione visiva.',
  },
  material: {
    eyebrow:    'Una lettura materica',
    accentHex:  '#c9b08a',
    intro:      'La materialità che dialoga con l\'atmosfera del progetto.',
  },
  storytelling: {
    eyebrow:    'Una narrazione progettuale',
    accentHex:  '#a8b8c8',
    intro:      'Frammenti che raccontano l\'atmosfera che immaginiamo per te.',
  },
  composition: {
    eyebrow:    'Una composizione curatoriale',
    accentHex:  '#9fb4a8',
    intro:      'Asset selezionati per costruire insieme il linguaggio del tuo progetto.',
  },
};


export default function ClientPreviewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeAsset, setActiveAsset] = useState(null);  // null = full sequence, otherwise zoom
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteClientId, setNoteClientId] = useState('');
  const [targetAssetForNote, setTargetAssetForNote] = useState(null);
  const [thanks, setThanks] = useState(null);

  const viewedRef = useRef(new Set());

  // ── Load preview ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/inspirations/public/preview/${encodeURIComponent(token)}`)
      .then(r => {
        if (r.status === 410) throw new Error('expired');
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => {
        setError(e.message === 'expired'
          ? 'expired'
          : 'not_found');
        setLoading(false);
      });
  }, [token]);

  const ambient = useMemo(
    () => MODE_AMBIENT[data?.preview_mode] || MODE_AMBIENT.editorial,
    [data?.preview_mode],
  );

  // ── Track asset view (best-effort) ──────────────────────────────
  const recordView = (assetId, duration = null) => {
    if (!token) return;
    if (assetId && viewedRef.current.has(assetId) && duration == null) return;
    if (assetId) viewedRef.current.add(assetId);
    fetch(`${BACKEND}/api/inspirations/public/preview/${encodeURIComponent(token)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_asset_id: assetId, duration_ms: duration }),
    }).catch(() => {});
  };

  const submitFeedback = (action_type, opts = {}) => {
    if (!token) return Promise.reject();
    return fetch(`${BACKEND}/api/inspirations/public/preview/${encodeURIComponent(token)}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type, ...opts }),
    }).then(r => r.json());
  };

  const onApprove = async () => {
    await submitFeedback('approve_direction', { client_identifier: noteClientId || undefined });
    setThanks({
      title: 'Grazie',
      body:  'La tua direzione è stata trasmessa allo studio. Continueremo a coltivarla insieme.',
    });
  };

  const onAlternatives = async () => {
    await submitFeedback('request_alternatives', { client_identifier: noteClientId || undefined });
    setThanks({
      title: 'Ricevuto',
      body:  'Lo studio preparerà direzioni alternative ispirate al tuo sentire.',
    });
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    await submitFeedback('note', {
      note:             noteText.trim(),
      target_asset_id:  targetAssetForNote?.id,
      client_identifier: noteClientId || undefined,
    });
    setNoteOpen(false);
    setNoteText('');
    setTargetAssetForNote(null);
    setThanks({
      title: 'Nota inviata',
      body:  'Lo studio la leggerà con attenzione.',
    });
  };

  // ── States ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cp-shell cp-shell--loading" data-testid="cp-loading">
        <div className="cp-skel cp-skel--hero" />
        <p className="cp-loading-text">Sto preparando la stanza…</p>
      </div>
    );
  }
  if (error === 'expired') {
    return (
      <div className="cp-shell cp-shell--gone" data-testid="cp-expired">
        <p className="cp-eyebrow">Questa direzione non è più attiva</p>
        <h1 className="cp-title"><em>L'anteprima si è chiusa</em></h1>
        <p className="cp-sub">
          Lo studio potrebbe averla aggiornata. Chiedi un nuovo link per ritrovare il percorso.
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="cp-shell cp-shell--gone" data-testid="cp-notfound">
        <p className="cp-eyebrow">Direzione non trovata</p>
        <h1 className="cp-title"><em>La stanza non è disponibile</em></h1>
        <p className="cp-sub">Verifica con lo studio il link ricevuto.</p>
      </div>
    );
  }

  const accent = ambient.accentHex;

  return (
    <div className="cp-shell" data-testid="cp-shell"
         style={{ '--cp-accent': accent }}>
      {/* ─── HEADER minimale ─── */}
      <header className="cp-header" data-testid="cp-header">
        <div className="cp-studio">
          <span className="cp-studio__dot" style={{ background: accent }} />
          <span className="cp-studio__name">{data.studio?.name || 'Studio'}</span>
        </div>
        <p className="cp-status" data-testid="cp-status">Presentazione privata</p>
      </header>

      {/* ─── HERO ─── */}
      <section className="cp-hero" data-testid="cp-hero">
        <p className="cp-eyebrow">{ambient.eyebrow}</p>
        <h1 className="cp-title" data-testid="cp-title">
          <em>{data.title || data.direction?.title || 'La tua direzione progettuale'}</em>
        </h1>
        {data.direction?.description && (
          <p className="cp-sub" data-testid="cp-direction-desc">
            {data.direction.description}
          </p>
        )}
        <p className="cp-intro">{ambient.intro}</p>
      </section>

      {/* ─── SEQUENCE ─── */}
      <main className="cp-sequence" data-testid="cp-sequence">
        {data.assets.length === 0 && (
          <div className="cp-empty">
            <p>Questa direzione è ancora in fase di curatela.</p>
          </div>
        )}
        {data.assets.map((a, idx) => (
          <article
            key={a.id}
            className="cp-frame"
            data-testid={`cp-frame-${a.id}`}
            onMouseEnter={() => recordView(a.id)}
          >
            <div className="cp-frame__num">
              {String(idx + 1).padStart(2, '0')}
            </div>
            <button
              type="button"
              className="cp-frame__media"
              onClick={() => { setActiveAsset(a); recordView(a.id); }}
              aria-label={`Apri ${a.product_name || 'asset'}`}
            >
              {a.file_url
                ? <img src={a.file_url} alt={a.alt_text || ''} loading="lazy" />
                : <div className="cp-frame__placeholder"><Icons.Image size={20} /></div>}
            </button>
            <div className="cp-frame__caption">
              <p className="cp-frame__name">
                <em>{a.product_name || 'Asset visuale'}</em>
              </p>
              <p className="cp-frame__meta">
                {a.brand}{a.collection ? ` · ${a.collection}` : ''}
              </p>
              {a.client_note && (
                <p className="cp-frame__note">
                  &mdash; {a.client_note}
                </p>
              )}
              <button
                type="button"
                className="cp-frame__note-cta"
                onClick={() => { setTargetAssetForNote(a); setNoteOpen(true); }}
                data-testid={`cp-frame-note-${a.id}`}
              >
                <Icons.MessageCircle size={11} />
                <span>Aggiungi una nota</span>
              </button>
            </div>
          </article>
        ))}
      </main>

      {/* ─── FOOTER · Client Actions™ ─── */}
      <footer className="cp-footer" data-testid="cp-footer">
        <p className="cp-footer__eyebrow">Una direzione ti parla?</p>
        <div className="cp-actions">
          <button
            type="button"
            className="cp-btn cp-btn--approve"
            onClick={onApprove}
            data-testid="cp-approve"
          >
            <Icons.Check size={14} />
            <span>Approvo questa direzione</span>
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--alt"
            onClick={onAlternatives}
            data-testid="cp-alternatives"
          >
            <Icons.Compass size={14} />
            <span>Vorrei esplorare alternative</span>
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--note"
            onClick={() => { setTargetAssetForNote(null); setNoteOpen(true); }}
            data-testid="cp-add-note"
          >
            <Icons.PenLine size={14} />
            <span>Aggiungi una nota</span>
          </button>
        </div>
        <p className="cp-footer__sub">
          Il tuo studio: <strong>{data.studio?.name}</strong>
        </p>
      </footer>

      {/* ─── Zoom modal ─── */}
      {activeAsset && (
        <div
          className="cp-zoom"
          role="dialog"
          aria-modal="true"
          data-testid="cp-zoom"
          onClick={() => setActiveAsset(null)}
        >
          <button
            type="button"
            className="cp-zoom__close"
            aria-label="Chiudi"
            onClick={() => setActiveAsset(null)}
            data-testid="cp-zoom-close"
          >
            <Icons.X size={16} />
          </button>
          <img
            src={activeAsset.file_url}
            alt={activeAsset.alt_text || ''}
            onClick={(e) => e.stopPropagation()}
          />
          <p className="cp-zoom__caption" onClick={(e) => e.stopPropagation()}>
            <em>{activeAsset.product_name}</em>
            <span> · {activeAsset.brand}</span>
          </p>
        </div>
      )}

      {/* ─── Note modal ─── */}
      {noteOpen && (
        <div
          className="cp-note-modal"
          role="dialog"
          aria-modal="true"
          data-testid="cp-note-modal"
          onClick={(e) => { if (e.target === e.currentTarget) setNoteOpen(false); }}
        >
          <div className="cp-note-card">
            <header className="cp-note-card__head">
              <p className="cp-eyebrow">
                {targetAssetForNote
                  ? `Una nota su "${targetAssetForNote.product_name || 'questo asset'}"`
                  : 'Una nota progettuale'}
              </p>
              <h3 className="cp-note-card__title">
                <em>Lasciaci sentire la tua direzione</em>
              </h3>
            </header>
            <input
              type="text"
              placeholder="Il tuo nome (opzionale)"
              value={noteClientId}
              onChange={(e) => setNoteClientId(e.target.value)}
              className="cp-note-card__input"
              data-testid="cp-note-name"
              maxLength={120}
            />
            <textarea
              placeholder="Cosa ti emoziona di questa direzione? Cosa vorresti approfondire?"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              autoFocus
              className="cp-note-card__textarea"
              data-testid="cp-note-text"
              maxLength={2000}
            />
            <div className="cp-note-card__actions">
              <button
                type="button"
                className="cp-btn cp-btn--ghost"
                onClick={() => { setNoteOpen(false); setNoteText(''); }}
              >
                Annulla
              </button>
              <button
                type="button"
                className="cp-btn cp-btn--approve"
                onClick={submitNote}
                disabled={!noteText.trim()}
                data-testid="cp-note-submit"
              >
                <Icons.Send size={13} />
                <span>Invia la nota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Thanks modal ─── */}
      {thanks && (
        <div className="cp-thanks" data-testid="cp-thanks"
             onClick={() => setThanks(null)}>
          <div className="cp-thanks__card">
            <p className="cp-eyebrow">Direzione condivisa</p>
            <h3 className="cp-thanks__title"><em>{thanks.title}</em></h3>
            <p className="cp-thanks__body">{thanks.body}</p>
            <button
              type="button"
              className="cp-btn cp-btn--ghost"
              onClick={() => setThanks(null)}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
