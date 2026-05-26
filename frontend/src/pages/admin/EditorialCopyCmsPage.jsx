/**
 * Editorial Copy CMS · Surface Governance System™
 * =================================================
 *
 * Admin-only surface to govern the editorial language of Blueprint OS™.
 *
 * Layout (3 zones):
 *   [LEFT]   Surface sidebar — Home, Begin Journey, Guided Tour, ...
 *   [CENTER] Phrase cards — eyebrow / title / body / cta, editable inline,
 *            with voice guardrails from the surface config.
 *   [RIGHT]  Live preview iframe — actual route rendered, refreshed
 *            after every save so you see your copy LIVE.
 *
 * Mounted at: /admin/editorial-copy
 *
 * Backend: /api/admin/editorial-copy/{surfaces, surfaces/{code}/phrases, phrases/{id}}
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Home, Compass, Layout, Sparkles, Rocket, Bell, Heart, Lock,
  ChevronRight, Eye, Loader2, Save, RotateCcw, Globe2,
  AlertTriangle, Info, ExternalLink,
} from 'lucide-react';
import api from '../../lib/api';
import './editorial-copy-cms.css';

const ICON_MAP = { home: Home, compass: Compass, layout: Layout,
  sparkles: Sparkles, rocket: Rocket, bell: Bell, heart: Heart, lock: Lock };

const LOCALES = [
  { code: 'it', label: 'IT · Italiano' },
  { code: 'en', label: 'EN · English' },
];

const L = (v, l) => (v && (v[l] || v.it || v.en)) || '';

// ─────────────────────────────────────────────────────────────────
// Surface sidebar
// ─────────────────────────────────────────────────────────────────
const SurfaceSidebar = ({ surfaces, active, onPick, locale }) => (
  <aside className="ecc-sidebar" data-testid="ecc-sidebar">
    <header className="ecc-sidebar__head">
      <p className="ecc-sidebar__eyebrow">SURFACE GOVERNANCE™</p>
      <h1 className="ecc-sidebar__title">Editorial Copy</h1>
      <p className="ecc-sidebar__lede">
        Governa la voce di Blueprint OS™ per superficie. Salvataggio per
        tenant — il default piattaforma resta intatto.
      </p>
    </header>
    <nav className="ecc-sidebar__nav" aria-label="Editorial surfaces">
      {surfaces.map((s) => {
        const Icon = ICON_MAP[s.icon] || Layout;
        const isActive = active?.code === s.code;
        return (
          <button
            key={s.code}
            type="button"
            onClick={() => onPick(s)}
            className={`ecc-surf ${isActive ? 'ecc-surf--active' : ''}`}
            data-testid={`ecc-surface-${s.code.replace(/\./g, '-')}`}
          >
            <span className="ecc-surf__icon" aria-hidden><Icon size={15} strokeWidth={1.5} /></span>
            <span className="ecc-surf__body">
              <span className="ecc-surf__name">{L(s.name, locale)}</span>
              <span className="ecc-surf__route">{s.preview_route}</span>
            </span>
            <ChevronRight size={14} className="ecc-surf__chev" strokeWidth={1.4} />
          </button>
        );
      })}
    </nav>
  </aside>
);

// ─────────────────────────────────────────────────────────────────
// Voice guardrails
// ─────────────────────────────────────────────────────────────────
const VoiceGuardrails = ({ hints, locale }) => {
  if (!hints || hints.length === 0) return null;
  return (
    <div className="ecc-guardrails" data-testid="ecc-guardrails">
      <p className="ecc-guardrails__head">VOICE GUARDRAILS</p>
      <ul className="ecc-guardrails__list">
        {hints.map((h, i) => {
          const Icon = h.level === 'warn' ? AlertTriangle : Info;
          return (
            <li key={i} className={`ecc-guardrail ecc-guardrail--${h.level}`}>
              <Icon size={12} strokeWidth={1.6} />
              <span>{L(h.rule, locale) || h.rule}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Phrase card — one editable block
// ─────────────────────────────────────────────────────────────────
const PhraseCard = ({ phrase, locale, onSave, onReset }) => {
  const [draft, setDraft] = useState(() => ({
    eyebrow: phrase.override?.eyebrow || phrase.default.eyebrow || {},
    title:   phrase.override?.title   || phrase.default.title   || {},
    body:    phrase.override?.body    || phrase.default.body    || {},
    cta:     phrase.override?.cta     || phrase.default.cta     || {},
  }));
  const [saving, setSaving] = useState(false);
  const hasOverride = Boolean(phrase.override);

  // Re-sync draft when underlying phrase changes (e.g. after reset)
  useEffect(() => {
    setDraft({
      eyebrow: phrase.override?.eyebrow || phrase.default.eyebrow || {},
      title:   phrase.override?.title   || phrase.default.title   || {},
      body:    phrase.override?.body    || phrase.default.body    || {},
      cta:     phrase.override?.cta     || phrase.default.cta     || {},
    });
  }, [phrase.id, phrase.override?.updated_at]);

  const update = (field, value) =>
    setDraft((d) => ({ ...d, [field]: { ...(d[field] || {}), [locale]: value } }));

  const has = (field) => phrase.default[field] || phrase.override?.[field];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields that have something
      const payload = {};
      ['eyebrow', 'title', 'body', 'cta'].forEach((f) => {
        const v = draft[f];
        if (v && (v.it || v.en) && Object.values(v).some((x) => (x || '').trim().length > 0)) {
          payload[f] = v;
        }
      });
      await onSave(phrase.id, payload);
      toast.success('Copy aggiornato.');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await onReset(phrase.id);
      toast.success('Override rimosso — ripristinato il default piattaforma.');
    } catch (e) {
      toast.error('Reset non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const location = phrase.meta?.location;

  return (
    <article
      className={`ecc-card ${hasOverride ? 'ecc-card--override' : ''}`}
      data-testid={`ecc-phrase-${phrase.phrase_key}`}
    >
      <header className="ecc-card__head">
        <div>
          <p className="ecc-card__key">{phrase.phrase_key}</p>
          {location && <p className="ecc-card__location">{location}</p>}
        </div>
        {hasOverride && (
          <span className="ecc-card__badge" title="Customizzato dal tenant">
            CUSTOM
          </span>
        )}
      </header>

      <div className="ecc-card__fields">
        {has('eyebrow') && (
          <Field label="Eyebrow" value={draft.eyebrow?.[locale] || ''}
            onChange={(v) => update('eyebrow', v)} testid="eyebrow" />
        )}
        {has('title') && (
          <Field label="Title" value={draft.title?.[locale] || ''}
            onChange={(v) => update('title', v)} testid="title" />
        )}
        {has('body') && (
          <Field label="Body" multiline
            value={draft.body?.[locale] || ''}
            onChange={(v) => update('body', v)} testid="body" />
        )}
        {has('cta') && (
          <Field label="CTA" value={draft.cta?.[locale] || ''}
            onChange={(v) => update('cta', v)} testid="cta" />
        )}
      </div>

      <footer className="ecc-card__actions">
        {hasOverride && (
          <button type="button" className="ecc-btn ecc-btn--ghost"
                  onClick={handleReset} disabled={saving}
                  data-testid={`ecc-reset-${phrase.phrase_key}`}>
            <RotateCcw size={12} strokeWidth={1.6} /> Reset al default
          </button>
        )}
        <button type="button" className="ecc-btn ecc-btn--primary"
                onClick={handleSave} disabled={saving}
                data-testid={`ecc-save-${phrase.phrase_key}`}>
          {saving ? <Loader2 size={12} className="ecc-spin" /> : <Save size={12} strokeWidth={1.8} />}
          Salva
        </button>
      </footer>
    </article>
  );
};

const Field = ({ label, value, onChange, multiline, testid }) => (
  <label className="ecc-field">
    <span className="ecc-field__label">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="ecc-field__input ecc-field__input--multiline"
        data-testid={`ecc-field-${testid}`}
      />
    ) : (
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ecc-field__input"
        data-testid={`ecc-field-${testid}`}
      />
    )}
  </label>
);

// ─────────────────────────────────────────────────────────────────
// Live preview pane
// ─────────────────────────────────────────────────────────────────
const LivePreview = ({ surface, refreshKey }) => {
  const route = surface?.preview_route || '/';
  const src = useMemo(() => {
    const sep = route.includes('?') ? '&' : '?';
    return `${route}${sep}preview=1&_=${refreshKey}`;
  }, [route, refreshKey]);

  return (
    <aside className="ecc-preview" data-testid="ecc-preview">
      <header className="ecc-preview__head">
        <div>
          <p className="ecc-preview__eyebrow">ANTEPRIMA LIVE</p>
          <p className="ecc-preview__route">{route}</p>
        </div>
        <a href={route} target="_blank" rel="noreferrer" className="ecc-preview__open">
          <ExternalLink size={12} /> Apri
        </a>
      </header>
      <div className="ecc-preview__frame-wrap">
        <iframe
          key={refreshKey}
          src={src}
          title={`preview-${surface?.code}`}
          className="ecc-preview__frame"
          data-testid="ecc-preview-iframe"
        />
      </div>
    </aside>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
const EditorialCopyCmsPage = () => {
  const [surfaces, setSurfaces] = useState([]);
  const [active, setActive] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [voiceHints, setVoiceHints] = useState([]);
  const [locale, setLocale] = useState('it');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/admin/editorial-copy/surfaces');
        const list = data?.surfaces || [];
        setSurfaces(list);
        setActive(list[0] || null);
      } catch (e) {
        toast.error('Impossibile caricare le superfici editoriali');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPhrases = useCallback(async (surface) => {
    if (!surface) return;
    try {
      const { data } = await api.get(
        `/api/admin/editorial-copy/surfaces/${encodeURIComponent(surface.code)}/phrases`,
      );
      setPhrases(data?.phrases || []);
      setVoiceHints(surface.voice_hints || data?.surface?.voice_hints || []);
    } catch (e) {
      toast.error('Impossibile caricare le frasi');
    }
  }, []);

  useEffect(() => { if (active) loadPhrases(active); }, [active, loadPhrases]);

  const handleSave = async (phraseId, payload) => {
    await api.patch(`/api/admin/editorial-copy/phrases/${phraseId}`, payload);
    await loadPhrases(active);
    setRefreshKey((k) => k + 1);
  };

  const handleReset = async (phraseId) => {
    await api.delete(`/api/admin/editorial-copy/phrases/${phraseId}/override`);
    await loadPhrases(active);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="ecc-loading" data-testid="ecc-loading">
        <Loader2 size={24} className="ecc-spin" />
      </div>
    );
  }

  return (
    <div className="ecc-shell" data-testid="editorial-copy-cms">
      <SurfaceSidebar
        surfaces={surfaces} active={active}
        onPick={setActive} locale={locale}
      />

      <main className="ecc-main">
        <header className="ecc-main__head">
          <div>
            <p className="ecc-main__eyebrow">SURFACE</p>
            <h2 className="ecc-main__title">{L(active?.name, locale)}</h2>
            <p className="ecc-main__desc">{L(active?.description, locale)}</p>
          </div>
          <div className="ecc-main__controls">
            <label className="ecc-locale" data-testid="ecc-locale-selector">
              <Globe2 size={13} />
              <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="ecc-btn ecc-btn--ghost"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    data-testid="ecc-refresh-preview">
              <Eye size={12} /> Aggiorna anteprima
            </button>
          </div>
        </header>

        <VoiceGuardrails hints={voiceHints} locale={locale} />

        <section className="ecc-cards" data-testid="ecc-cards">
          {phrases.length === 0 ? (
            <p className="ecc-empty">Nessuna frase su questa superficie ancora — verranno aggiunte progressivamente con la migrazione C.</p>
          ) : phrases.map((p) => (
            <PhraseCard
              key={p.id} phrase={p} locale={locale}
              onSave={handleSave} onReset={handleReset}
            />
          ))}
        </section>
      </main>

      <LivePreview surface={active} refreshKey={refreshKey} />
    </div>
  );
};

export default EditorialCopyCmsPage;
