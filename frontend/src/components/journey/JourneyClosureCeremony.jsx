/**
 * JourneyClosureCeremony — Sprint G.9 · Certified Closure™ (studio side).
 *
 * NON è una "completion modal". NON è una success screen. NON è una
 * award page. È una **cerimonia editoriale sobria** che lo studio
 * compie quando il percorso entra nella memoria della casa.
 *
 * Lo studio deposita 3 cose:
 *   · titolo definitivo (es. "Villa Riviera · una conversazione con la luce")
 *   · closure statement (paragrafo editoriale)
 *   · cover visiva (opzionale, URL)
 *
 * Backend: POST /api/journeys/{jid}/certify-closure
 */
import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from '../../contexts/BlueprintContext';

const JourneyClosureCeremony = ({ journeyId, projectTitle, onDeposited }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [finalTitle, setFinalTitle] = useState(projectTitle || '');
  const [statement, setStatement] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = finalTitle.trim().length >= 2 && statement.trim().length >= 10;

  const deposit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await api.post(`/api/journeys/${journeyId}/certify-closure`, {
        final_title: finalTitle.trim(),
        statement:   statement.trim(),
        cover_url:   coverUrl.trim() || null,
      });
      toast.success(t('closure.toast.success'));
      setOpen(false);
      if (onDeposited) onDeposited();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('closure.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="dj-inline" data-testid="dj-inline-closure">
        <p className="dj-inline__eyebrow">{t('closure.inline.eyebrow')}</p>
        <h3 className="dj-inline__title">
          <em>{t('closure.inline.title')}</em>
        </h3>
        <p className="dj-inline__sub">
          {t('closure.inline.sub')}
        </p>
        <button
          type="button"
          className="dj-closure__open"
          data-testid="dj-closure-open"
          onClick={() => setOpen(true)}
          style={{
            marginTop: 22,
            padding: '11px 22px',
            fontFamily: "var(--mood-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
            fontSize: 10.5,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--mood-gold, #b89870)',
            background: 'transparent',
            border: '1px solid var(--mood-gold, #b89870)',
            cursor: 'pointer',
            transition: 'all 0.28s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(184,152,112,0.10)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {t('closure.inline.cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="dj-inline" data-testid="dj-closure-ceremony">
      <p className="dj-inline__eyebrow">{t('closure.ceremony.eyebrow')}</p>
      <h3 className="dj-inline__title">
        <em>{t('closure.ceremony.title')}</em>
      </h3>
      <p className="dj-inline__sub" style={{ maxWidth: '60ch' }}>
        {t('closure.ceremony.sub')}
      </p>

      <div style={{ marginTop: 24, display: 'grid', gap: 18, maxWidth: 640 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={lblStyle}>Titolo definitivo del Journey</span>
          <input
            type="text"
            value={finalTitle}
            onChange={(e) => setFinalTitle(e.target.value)}
            maxLength={180}
            placeholder="Es. Villa Riviera · una conversazione con la luce"
            data-testid="dj-closure-title"
            style={inpStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={lblStyle}>Closure Statement</span>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            maxLength={800}
            rows={5}
            placeholder="Un paragrafo che riassume il percorso. Senza enfasi, senza retorica. Documentazione editoriale di ciò che è stato attraversato."
            data-testid="dj-closure-statement"
            style={{ ...inpStyle, fontFamily: "var(--mood-font-serif, 'Playfair Display', serif)", fontStyle: 'italic', fontSize: 15, resize: 'vertical' }}
          />
          <span style={{ ...lblStyle, opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>
            {statement.length} / 800
          </span>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={lblStyle}>Cover visiva (URL · opzionale)</span>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            maxLength={800}
            placeholder="https://…"
            data-testid="dj-closure-cover"
            style={inpStyle}
          />
        </label>
      </div>

      <div style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'center' }}>
        <button
          type="button"
          onClick={deposit}
          disabled={!canSubmit || busy}
          data-testid="dj-closure-submit"
          style={{
            padding: '12px 24px',
            fontFamily: "var(--mood-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
            fontSize: 10.5,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#0e0f11',
            background: 'var(--mood-gold, #b89870)',
            border: '1px solid var(--mood-gold, #b89870)',
            cursor: canSubmit && !busy ? 'pointer' : 'not-allowed',
            opacity: canSubmit && !busy ? 1 : 0.4,
            transition: 'all 0.28s ease',
          }}
        >
          {busy ? 'Sto depositando…' : 'Deposita il dossier'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          data-testid="dj-closure-cancel"
          style={{
            padding: '12px 18px',
            fontFamily: "var(--mood-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
            fontSize: 10.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'color-mix(in srgb, #efe8d8 55%, transparent)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Indietro
        </button>
      </div>
    </div>
  );
};

const lblStyle = {
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'color-mix(in srgb, #efe8d8 55%, transparent)',
};

const inpStyle = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid color-mix(in srgb, #efe8d8 18%, transparent)',
  color: '#efe8d8',
  padding: '11px 14px',
  fontSize: 14,
  fontFamily: "var(--mood-font-body, 'Inter', sans-serif)",
  outline: 'none',
};

export default JourneyClosureCeremony;
