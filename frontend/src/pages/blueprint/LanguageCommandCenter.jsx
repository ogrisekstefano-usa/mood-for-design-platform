/**
 * Language Command Center™ · ITER127.
 *
 * Editorial governance console for MOOD's international voice. NOT a
 * translation admin — a calm bilingual atelier for the studio to inspect,
 * filter and (later) edit every UI string × every locale.
 *
 * MVP scope (iter127): browsing + inline edit + missing/leak surfacing.
 *   Areas:
 *     1. UI Copy Registry (registry table, filters, inline edit)
 *     2. Missing & Leakage Review (from last audit run)
 *
 *   Deferred: import/export, advanced ALE TM cross-link, audit run trigger
 *   from inside the UI, full Studio Voice editor (already exists at
 *   /blueprint/studio-voice).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from '../../i18n/useT';

const LOCALES = ['it-IT', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ar'];
const SURFACES = [
  'All',
  'Navigation', 'Dashboard', 'Design Journey', 'CRM', 'Inspirations',
  'Brand Atlas', 'Material View', 'Cultural Editions',
  'Editorial Calendar', 'Magazine', 'Market Editions',
  'Publication Review', 'Experience Studio', 'Insights',
  'Studio Identity', 'Integrations', 'Forms & Journeys',
  'Client Companion', 'Dossier', 'Common', 'Auth', 'Other',
];

const STATUS_LABEL = {
  ai_suggested:    'AI · SUGGESTED',
  human_reviewed:  'STUDIO · REVIEWED',
  locked_approved: 'STUDIO · LOCKED',
  stale:           'MISSING',
};

const Section = ({ eyebrow, title, lede, children, testid }) => (
  <section data-testid={testid} className="mb-14">
    <div className="mb-7">
      <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">{eyebrow}</p>
      <h2 className="font-heading text-[28px] leading-[1.15] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-2">{title}</h2>
      {lede && <p className="text-[13px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.6))] font-body max-w-[68ch]">{lede}</p>}
    </div>
    {children}
  </section>
);

const LanguageCommandCenter = () => {
  const { t } = useT();
  const [surface, setSurface]   = useState('All');
  const [search, setSearch]     = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [locale, setLocale]     = useState('en-US');
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('registry');
  const [leaks, setLeaks]       = useState({ items: [], scanned_at: null, run_id: null });
  const [audit, setAudit]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (surface && surface !== 'All') params.set('surface', surface);
      if (search.trim()) params.set('search', search.trim());
      if (missingOnly) params.set('missing_only', 'true');
      params.set('limit', '400');
      const { data } = await api.get(`/api/language/registry?${params.toString()}`);
      setItems(data.items || []);
    } catch (_) { toast.error('Caricamento registro fallito'); }
    finally { setLoading(false); }
  }, [surface, search, missingOnly]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/api/language/leaks').then((r) => setLeaks(r.data)).catch(() => {});
    api.get('/api/language/audit/last').then((r) => setAudit(r.data.item)).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    let missing = 0, overrides = 0, locked = 0;
    items.forEach((it) => {
      LOCALES.forEach((lc) => {
        const v = it.locales[lc];
        if (!v) return;
        if (v.source === 'missing') missing += 1;
        if (v.source === 'override') overrides += 1;
        if (v.review_status === 'locked_approved') locked += 1;
      });
    });
    return { keys: items.length, missing, overrides, locked };
  }, [items]);

  return (
    <div data-testid="language-command-center" className="max-w-[1240px] mx-auto px-10 py-12">
      <header className="mb-12 pb-10 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-3">
          Blueprint Command Center™ · International Voice
        </p>
        <h1 className="font-heading text-[44px] leading-[1.05] text-[var(--mood-text, #f0ebe0)] tracking-[-0.015em] mb-5">
          Language Command Center™
        </h1>
        <p className="text-[15px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.65))] font-body max-w-[72ch]">
          Editorial governance over every word MOOD says to the world.
          UI copy · taxonomy · Studio Voice · ALE — a single atelier to
          steer the studio's international voice.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-3 text-[11px] uppercase tracking-[0.22em] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
          <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{stats.keys}</strong> &nbsp;total keys</span>
          <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{stats.missing}</strong> &nbsp;missing</span>
          <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{stats.overrides}</strong> &nbsp;overrides</span>
          <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{stats.locked}</strong> &nbsp;locked</span>
          <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{(leaks.items || []).length}</strong> &nbsp;IT leaks (CLI)</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-6 mb-10 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
        {[
          ['registry', 'UI Copy Registry'],
          ['leakage',  `Missing & Leakage (${(leaks.items||[]).length})`],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            data-testid={`language-cc-tab-${id}`}
            className={`px-1 py-3 text-[11px] uppercase tracking-[0.24em] font-mono border-b-2 transition-colors
              ${tab === id
                ? 'border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)]'
                : 'border-transparent text-[var(--mood-text-muted, rgba(240,235,224,0.55))] hover:text-[var(--mood-text, #f0ebe0)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'registry' && (
        <Section
          eyebrow="01 · UI Copy Registry™"
          title={t('blueprint.language.all_phrases_title', null, 'All Blueprint phrases')}
          lede={t('blueprint.language.all_phrases_lede', null, "Every translation key, every surface, every locale. Filter, search, refine. Changes take effect at the next render — no deploy.")}
          testid="language-cc-registry-section"
        >
          <div className="flex flex-wrap gap-3 mb-7">
            <div className="relative flex-1 min-w-[260px]">
              <Search size={13} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                data-testid="language-cc-search"
                type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('blueprint.language.search_placeholder', null, 'Search by key or text…')}
                className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 pl-9 pr-4
                           text-[13px] font-body text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.4))]
                           placeholder:text-[var(--mood-text-muted, rgba(240,235,224,0.4))]"
              />
            </div>
            <select value={surface} onChange={(e) => setSurface(e.target.value)}
              data-testid="language-cc-surface-filter"
              className="bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 px-3 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]">
              {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={locale} onChange={(e) => setLocale(e.target.value)}
              data-testid="language-cc-locale-filter"
              className="bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 px-3 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]">
              {LOCALES.map((lc) => <option key={lc} value={lc}>{lc}</option>)}
            </select>
            <label className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.65))] cursor-pointer">
              <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)}
                data-testid="language-cc-missing-only" />
              {t('blueprint.language.only_missing', null, 'Only missing')}
            </label>
          </div>

          {loading ? (
            <div className="py-16 flex items-center gap-3 text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[11px] uppercase tracking-[0.24em]">{t('blueprint.language.loading_registry', null, 'Loading registry')}</span>
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              {t('blueprint.language.no_matches', null, 'No keys match your filters.')}
            </p>
          ) : (
            <ol className="space-y-3" data-testid="language-cc-registry-list">
              {items.map((it) => (
                <RegistryRow key={it.key} item={it} locale={locale} onChanged={load} />
              ))}
            </ol>
          )}
        </Section>
      )}

      {tab === 'leakage' && (
        <Section
          eyebrow="02 · Missing & Leakage Review™"
          title="Phrases that leak through to English"
          lede="Result of the latest `yarn localization:audit`. Each row marks a hardcoded Italian string that also surfaces under locale EN-US — a candidate to be lifted into the registry via `t()`."
          testid="language-cc-leakage-section"
        >
          {audit && (
            <p className="mb-7 text-[10.5px] uppercase tracking-[0.24em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              Latest audit · locale <strong className="text-[var(--mood-text, #f0ebe0)]">{audit.locale}</strong> ·
              &nbsp;{audit.pages_scanned} pages ·
              &nbsp;{audit.leaks_total} leaks ·
              &nbsp;{audit.missing_total} missing ·
              &nbsp;{new Date(audit.created_at).toLocaleString()}
            </p>
          )}
          {(leaks.items || []).length === 0 ? (
            <p className="py-16 font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              No leaks on file. Run <code className="font-mono text-[12px] text-[var(--mood-accent, #d9b285)]">yarn localization:audit</code> from <code>/app/frontend</code> to produce a fresh report.
            </p>
          ) : (
            <ol className="space-y-3" data-testid="language-cc-leakage-list">
              {(leaks.items || []).map((leak, idx) => (
                <li key={`${leak.page}-${leak.phrase}-${idx}`}
                  data-testid={`leakage-row-${idx}`}
                  className="p-6 border border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)]">
                  <div className="flex items-baseline justify-between gap-4 mb-3">
                    <p className="text-[10.5px] uppercase tracking-[0.24em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
                      {leak.page} · <span className="text-[var(--mood-text-faint, rgba(240,235,224,0.35))]">{leak.testid || '—'}</span>
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-danger, rgba(225,95,95,0.85))]">
                      <AlertTriangle size={11} strokeWidth={1.7} className="inline mr-1.5 align-baseline" />
                      ×{leak.count}
                    </p>
                  </div>
                  <p className="font-heading italic text-[15px] leading-[1.55] text-[var(--mood-text, #f0ebe0)]">
                    «{leak.phrase}»
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}
    </div>
  );
};

// ───────── Registry row with inline edit ─────────
const RegistryRow = ({ item, locale, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.locales[locale]?.text || '');
  const [busy, setBusy] = useState(false);
  const itLocale = item.locales['it-IT'];
  const target = item.locales[locale] || { text: null, source: 'missing', review_status: 'stale' };

  useEffect(() => { setDraft(target.text || ''); }, [target.text]);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/language/override', {
        key_path: item.key,
        locale,
        override_text: draft,
        review_status: 'human_reviewed',
        surface: item.surface,
      });
      setEditing(false);
      onChanged();
      toast.success('Traduzione salvata');
    } catch (_) { toast.error('Salvataggio fallito'); }
    finally { setBusy(false); }
  };

  const revert = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/language/override?key_path=${encodeURIComponent(item.key)}&locale=${locale}`);
      setEditing(false);
      onChanged();
    } catch (_) { toast.error('Ripristino fallito'); }
    finally { setBusy(false); }
  };

  const statusColor = {
    locked_approved: 'text-[var(--mood-accent, #d9b285)]',
    human_reviewed:  'text-[var(--mood-text, #f0ebe0)]',
    ai_suggested:    'text-[var(--mood-text-muted, rgba(240,235,224,0.55))]',
    stale:           'text-[var(--mood-danger, rgba(225,95,95,0.85))]',
  }[target.review_status] || 'text-[var(--mood-text-muted, rgba(240,235,224,0.55))]';

  return (
    <li data-testid={`language-cc-row-${item.key}`}
      className="p-6 border border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)]">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
          <span className="text-[var(--mood-accent, #d9b285)]">{item.surface}</span>
          &nbsp;·&nbsp;{item.key}
        </p>
        <p className={`text-[9.5px] uppercase tracking-[0.24em] font-mono ${statusColor}`}>
          {STATUS_LABEL[target.review_status] || target.review_status}
        </p>
      </div>
      <p className="font-heading italic text-[14px] leading-[1.55] text-[var(--mood-text-muted, rgba(240,235,224,0.7))] mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono mr-3 text-[var(--mood-text-faint, rgba(240,235,224,0.35))]">it-IT</span>
        {itLocale?.text ? `"${itLocale.text}"` : <em>missing</em>}
      </p>

      <div className="border-t border-[var(--mood-border, rgba(255,255,255,0.05))] pt-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-mono mb-1.5 text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">{locale}</p>
        {editing ? (
          <>
            <textarea
              data-testid={`language-cc-edit-${item.key}`}
              value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
              className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.1))] p-3 text-[14px] font-body text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent, #d9b285)]"
            />
            <div className="mt-3 flex gap-3 justify-end">
              <button type="button" onClick={() => { setEditing(false); setDraft(target.text || ''); }}
                className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
                Annulla
              </button>
              {target.source === 'override' && (
                <button type="button" onClick={revert} disabled={busy}
                  data-testid={`language-cc-revert-${item.key}`}
                  className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] flex items-center gap-1.5">
                  <RotateCcw size={11} strokeWidth={1.7} /> Ripristina
                </button>
              )}
              <button type="button" onClick={save} disabled={busy}
                data-testid={`language-cc-save-${item.key}`}
                className="px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-mono border border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)] flex items-center gap-1.5">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} strokeWidth={1.7} />}
                Salva
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setEditing(true)}
            data-testid={`language-cc-row-text-${item.key}`}
            className="text-left w-full">
            <p className="font-heading text-[15px] leading-[1.55] text-[var(--mood-text, #f0ebe0)]">
              {target.text ? `"${target.text}"` : <em className="text-[var(--mood-danger, rgba(225,95,95,0.7))]">⟦{item.key}⟧</em>}
              {target.source === 'override' && (
                <span className="ml-2 text-[9px] uppercase tracking-[0.2em] font-mono text-[var(--mood-accent, #d9b285)]">override</span>
              )}
            </p>
          </button>
        )}
      </div>
    </li>
  );
};

export default LanguageCommandCenter;
