/**
 * Market Matrix™ — Language Governance Page
 * ────────────────────────────────────────────────────────────────────
 * Visually separates LANGUAGE ≠ MARKET ≠ EDITORIAL REGISTER.
 *
 *   Market · Language · Macro Region · Editorial Register ·
 *   Hospitality Profile · CTA Psychology · SEO Behavior ·
 *   Publishing Windows · Luxury Perception Model
 *
 * Read/write surface: GET /api/markets · PATCH /api/markets/{id}
 * Backing JSONB fields:
 *   cultural_profile · tone_of_voice · cta_style · seo_intent
 */
import './market-matrix.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, Languages, MapPin, ScrollText, Coffee, Megaphone, Search, Clock, Crown, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const LANG_OF = (locale) => {
  if (!locale) return '—';
  const lang = locale.split('-')[0];
  return ({
    en: 'English', it: 'Italian', es: 'Spanish', fr: 'French', de: 'German',
    pt: 'Portuguese', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
  })[lang.toLowerCase()] || lang.toUpperCase();
};

const HEAD_CELL = ({ icon: Icon, label }) => (
  <th className="mxm-th">
    <span className="mxm-th__inner">
      <Icon size={11} strokeWidth={1.5} />
      {label}
    </span>
  </th>
);

const InlineEditableCell = ({ value, onChange, placeholder, mono, testid }) => {
  const [draft, setDraft] = useState(value || '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(value || ''); }, [value]);

  if (!editing) {
    return (
      <td className={`mxm-td ${mono ? 'is-mono' : ''} ${!value ? 'is-empty' : ''}`} onClick={() => setEditing(true)} data-testid={testid}>
        {value || <span className="mxm-td__placeholder">{placeholder || '—'}</span>}
      </td>
    );
  }
  return (
    <td className="mxm-td is-editing" data-testid={testid}>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if ((draft || '') !== (value || '')) onChange?.(draft); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        className={`mxm-td__input ${mono ? 'is-mono' : ''}`}
      />
    </td>
  );
};

const MarketMatrixPage = () => {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/markets');
      const list = r.data?.markets || r.data || [];
      setMarkets(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Impossibile caricare i mercati');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const patchMarket = async (id, patch) => {
    setSavingId(id);
    try {
      await api.patch(`/api/markets/${id}`, patch);
      toast.success('Mercato aggiornato');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setSavingId(null); }
  };

  const setNested = (m, path, value) => {
    // path = ['cultural_profile', 'editorial_register']
    const [root, leaf] = path;
    const current = (m[root] || {});
    return { [root]: { ...current, [leaf]: value || null } };
  };

  const sortedMarkets = useMemo(
    () => [...markets].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.code || '').localeCompare(b.code || '')),
    [markets],
  );

  return (
    <div className="mxm-page" data-testid="market-matrix-page" data-surface="os">
      <header className="mxm-hero">
        <p className="mxm-hero__eyebrow">Language Governance™</p>
        <h1 className="mxm-hero__title">Market Matrix™</h1>
        <p className="mxm-hero__lead">
          La direzione editoriale di MOOD parla a mercati diversi con la stessa lingua —
          e a mercati uguali con registri diversi. Qui distingui esplicitamente
          <strong> Market</strong>, <strong> Language</strong> e <strong> Editorial Register</strong> per
          evitare ogni ambiguità culturale.
        </p>
      </header>

      {loading ? (
        <p className="mxm-loading">Caricamento mercati…</p>
      ) : (
        <div className="mxm-table-wrap">
          <table className="mxm-table" data-testid="market-matrix-table">
            <thead>
              <tr>
                <HEAD_CELL icon={Globe2}     label="Market" />
                <HEAD_CELL icon={Languages}  label="Language" />
                <HEAD_CELL icon={MapPin}     label="Macro Region" />
                <HEAD_CELL icon={ScrollText} label="Editorial Register" />
                <HEAD_CELL icon={Coffee}     label="Hospitality Profile" />
                <HEAD_CELL icon={Megaphone}  label="CTA Psychology" />
                <HEAD_CELL icon={Search}     label="SEO Behavior" />
                <HEAD_CELL icon={Clock}      label="Publishing Windows" />
                <HEAD_CELL icon={Crown}      label="Luxury Perception" />
              </tr>
            </thead>
            <tbody>
              {sortedMarkets.map((m) => {
                const cp = m.cultural_profile || {};
                const cs = m.cta_style || {};
                const si = m.seo_intent || {};
                const isSaving = savingId === m.id;
                return (
                  <tr key={m.id} data-testid={`market-row-${m.code}`}>
                    <td className="mxm-td is-anchor">
                      <p className="mxm-td__code">{m.code}</p>
                      <p className="mxm-td__locale">{m.primary_locale}</p>
                      {isSaving && <Loader2 size={11} className="animate-spin mxm-td__saving" />}
                    </td>
                    <td className="mxm-td is-mono">{LANG_OF(m.primary_locale)}</td>
                    <td className="mxm-td">{m.macro_region || '—'}</td>
                    <InlineEditableCell
                      value={cp.editorial_register}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['cultural_profile', 'editorial_register'], v))}
                      placeholder="es. Ceremonial Hospitality"
                      testid={`market-register-${m.code}`}
                    />
                    <InlineEditableCell
                      value={cp.hospitality_profile}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['cultural_profile', 'hospitality_profile'], v))}
                      placeholder="es. Discrete · Family-first"
                      testid={`market-hospitality-${m.code}`}
                    />
                    <InlineEditableCell
                      value={cs.psychology}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['cta_style', 'psychology'], v))}
                      placeholder="es. Private Consultation"
                      testid={`market-cta-${m.code}`}
                    />
                    <InlineEditableCell
                      value={si.behavior}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['seo_intent', 'behavior'], v))}
                      placeholder="es. High-intent transactional"
                      testid={`market-seo-${m.code}`}
                    />
                    <InlineEditableCell
                      value={cp.publishing_windows}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['cultural_profile', 'publishing_windows'], v))}
                      placeholder="es. Wed · 8AM GMT+4"
                      mono
                      testid={`market-publishing-${m.code}`}
                    />
                    <InlineEditableCell
                      value={cp.luxury_perception_model}
                      onChange={(v) => patchMarket(m.id, setNested(m, ['cultural_profile', 'luxury_perception_model'], v))}
                      placeholder="es. Heritage > Innovation"
                      testid={`market-luxury-${m.code}`}
                    />
                  </tr>
                );
              })}
              {sortedMarkets.length === 0 && (
                <tr>
                  <td colSpan={9} className="mxm-td is-empty" style={{ padding: '40px 16px', textAlign: 'center' }}>
                    Nessun mercato configurato. Crea il primo da International Presence.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mxm-footer">
        <p className="mxm-footer__hint">
          <Save size={11} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
          Le modifiche sono salvate automaticamente all'uscita dal campo.
          <strong> Language ≠ Market</strong>: EN-US, EN-GB e EN-AE condividono la stessa lingua ma rispondono a tre culture editoriali distinte.
        </p>
      </footer>
    </div>
  );
};

export default MarketMatrixPage;
