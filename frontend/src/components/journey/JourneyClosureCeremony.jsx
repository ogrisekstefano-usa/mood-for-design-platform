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

const JourneyClosureCeremony = ({ journeyId, projectTitle, onDeposited }) => {
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
      toast.success('Il percorso entra nella memoria della casa.');
      setOpen(false);
      if (onDeposited) onDeposited();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Non è stato possibile depositare il dossier.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="dj-inline" data-testid="dj-inline-closure">
        <p className="dj-inline__eyebrow">Certified Closure™</p>
        <h3 className="dj-inline__title">
          <em>Il percorso entra nella memoria della casa</em>
        </h3>
        <p className="dj-inline__sub">
          Quando il Journey raggiunge la sua forma definitiva, lo studio deposita
          un dossier editoriale: titolo, statement, cover. Il percorso non
          finisce — viene cristallizzato come memoria progettuale viva.
        </p>
        <button
          type="button"
          className="dj-closure__open"
          data-testid="dj-closure-open"
          onClick={() => setOpen(true)}
          style={{
            marginTop: 22,
            padding: '11px 22px',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10.5,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#b89870',
            background: 'transparent',
            border: '1px solid #b89870',
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
          Apri il rituale di chiusura
        </button>
      </div>
    );
  }

  return (
    <div className="dj-inline" data-testid="dj-closure-ceremony">
      <p className="dj-inline__eyebrow">Rituale di chiusura · Certified Closure™</p>
      <h3 className="dj-inline__title">
        <em>Deposita il dossier del percorso</em>
      </h3>
      <p className="dj-inline__sub" style={{ maxWidth: '60ch' }}>
        Tono editoriale, sobrio, atemporale. Nessuna celebrazione, nessun
        marketing — solo la sintesi del percorso che entrerà nella memoria
        della casa.
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
            style={{ ...inpStyle, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 15, resize: 'vertical' }}
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
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10.5,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#0e0f11',
            background: '#b89870',
            border: '1px solid #b89870',
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
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
};

export default JourneyClosureCeremony;
