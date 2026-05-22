/**
 * Studio Voice™ · Editorial Language Identity · ITER125.
 *
 * "How this studio speaks."  Not a translation admin — an editorial
 * atelier surface where the studio shapes its international voice:
 *
 *   • Language DNA™ profile         (preset + density + hospitality + avoid)
 *   • Preferred Vocabulary™         (term-pair overrides)
 *   • Translation Memory Inspector™ (bilingual archive · lockable phrases)
 *   • Translation Analytics™        (top phrases · corrections · locale usage)
 *
 * Visual direction: monograph, not dashboard. Editorial bilingual atelier.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Unlock, PencilLine, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const REVIEW_LABELS = {
  ai_only:        'AI · DRAFT',
  human_reviewed: 'STUDIO · REVIEWED',
  locked_approved:'STUDIO · LOCKED',
};
const CATEGORY_LABELS = {
  editorial: 'editorial',
  material:  'material',
  atmosphere:'atmosphere',
  spatial:   'spatial',
  relational:'relational',
  technical: 'technical',
};

const Section = ({ eyebrow, title, lede, children, testid }) => (
  <section data-testid={testid} className="mb-16">
    <div className="mb-7">
      <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">{eyebrow}</p>
      <h2 className="font-heading text-[28px] leading-[1.15] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-2">{title}</h2>
      {lede && <p className="text-[13px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.6))] font-body max-w-[64ch]">{lede}</p>}
    </div>
    {children}
  </section>
);

const Card = ({ children, className = '' }) => (
  <div className={`p-7 border border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)] ${className}`}>
    {children}
  </div>
);

const StudioVoicePage = () => {
  const [profile, setProfile]   = useState(null);
  const [presets, setPresets]   = useState([]);
  const [vocab, setVocab]       = useState([]);
  const [memory, setMemory]     = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryFilter, setMemoryFilter] = useState('all');

  const refreshAll = useCallback(async () => {
    try {
      const [p, pr, v, m, a] = await Promise.all([
        api.get('/api/voice/profile'),
        api.get('/api/voice/presets'),
        api.get('/api/voice/vocabulary'),
        api.get('/api/voice/memory?limit=80'),
        api.get('/api/voice/analytics'),
      ]);
      setProfile(p.data);
      setPresets(pr.data.presets || []);
      setVocab(v.data.items || []);
      setMemory(m.data.items || []);
      setAnalytics(a.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const filteredMemory = useMemo(() => {
    let rows = memory;
    if (memoryFilter !== 'all') {
      rows = rows.filter((r) => r.review_status === memoryFilter);
    }
    if (memorySearch.trim()) {
      const q = memorySearch.toLowerCase();
      rows = rows.filter((r) =>
        (r.original_text || '').toLowerCase().includes(q) ||
        (r.localized_text || '').toLowerCase().includes(q));
    }
    return rows;
  }, [memory, memoryFilter, memorySearch]);

  const savePreset = async (preset) => {
    setSavingProfile(true);
    try {
      const { data } = await api.put('/api/voice/profile', {
        preset,
        communication_style: profile?.communication_style,
        hospitality_level:   profile?.hospitality_level,
        editorial_density:   profile?.editorial_density,
        avoid_terms:         profile?.avoid_terms,
        notes:               profile?.notes,
      });
      setProfile(data);
      toast.success('Studio Voice aggiornata');
    } catch (e) {
      toast.error('Aggiornamento non riuscito');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="studio-voice-page" className="max-w-[1100px] mx-auto px-10 py-16">
        <div className="flex items-center gap-3 text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] uppercase tracking-[0.24em]">Caricamento Studio Voice</span>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="studio-voice-page" className="max-w-[1100px] mx-auto px-10 py-12">
      {/* HEADER · editorial monograph */}
      <header className="mb-14 pb-12 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-3">
          Blueprint Command Center™ · Editorial Language
        </p>
        <h1 className="font-heading text-[44px] leading-[1.05] text-[var(--mood-text, #f0ebe0)] tracking-[-0.015em] mb-5">
          Studio Voice™
        </h1>
        <p className="text-[15px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.65))] font-body max-w-[72ch]">
          The international voice of the studio. MOOD learns from the way you write —
          tonal presets, preferred vocabulary, locked translations — and carries your
          identity into every language. <em>Not a translation system, an editorial identity.</em>
        </p>
        {analytics && (
          <div className="mt-8 flex flex-wrap gap-x-12 gap-y-3 text-[11px] uppercase tracking-[0.22em] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
            <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{analytics.total_variants}</strong> &nbsp;translated entries</span>
            <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{analytics.locked_count}</strong> &nbsp;lock-approved</span>
            <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{analytics.reviewed_count}</strong> &nbsp;reviewed</span>
            <span><strong className="font-mono text-[var(--mood-text, #f0ebe0)]">{(analytics.locale_pair_usage || []).length}</strong> &nbsp;language pairs</span>
          </div>
        )}
      </header>

      {/* ──────────────  STUDIO LANGUAGE DNA  ────────────── */}
      <Section
        eyebrow="01 · Studio Language DNA™"
        title="How the studio speaks"
        lede="Select the tonal preset that best represents the studio's voice. It shapes every editorial translation across every locale."
        testid="voice-language-dna"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="voice-preset-selector">
          {presets.map((p) => {
            const active = profile?.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => savePreset(p.id)}
                disabled={savingProfile}
                data-testid={`voice-preset-${p.id}`}
                className={`text-left p-7 border transition-all duration-200
                  ${active
                    ? 'border-[var(--mood-accent, #d9b285)] bg-[var(--mood-accent-soft, rgba(217,178,133,0.06))]'
                    : 'border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)] hover:border-[var(--mood-accent-soft, rgba(217,178,133,0.4))]'}`}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-heading text-[20px] leading-[1.2] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em]">
                    {p.label}
                  </h3>
                  {active && <span className="text-[9px] uppercase tracking-[0.24em] font-mono text-[var(--mood-accent, #d9b285)]">active</span>}
                </div>
                <p className="text-[12.5px] leading-[1.65] text-[var(--mood-text-muted, rgba(240,235,224,0.6))] font-body italic">
                  {p.summary}
                </p>
              </button>
            );
          })}
        </div>
        {profile?.directive && (
          <Card className="mt-8">
            <p className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))] mb-3">
              Directive currently injected into the prompt
            </p>
            <p className="font-heading italic text-[15px] leading-[1.65] text-[var(--mood-text, #f0ebe0)]">
              "{profile.directive}"
            </p>
          </Card>
        )}
      </Section>

      {/* ──────────────  PREFERRED VOCABULARY  ────────────── */}
      <Section
        eyebrow="02 · Preferred Vocabulary™"
        title="Studio vocabulary"
        lede="Editorial terms preferred per locale. They are injected into the prompt before every translation, becoming a stable part of the studio's voice."
        testid="voice-preferred-vocabulary"
      >
        <VocabularyEditor vocab={vocab} onChanged={refreshAll} />
      </Section>

      {/* ──────────────  TRANSLATION MEMORY INSPECTOR  ────────────── */}
      <Section
        eyebrow="03 · Translation Memory Inspector™"
        title="The studio's living dictionary"
        lede="Every translated phrase remains here. You can lock it (Lock Approved) to make it the studio's definitive voice, or correct it manually and MOOD will learn."
        testid="voice-memory-inspector"
      >
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 pb-5 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={13} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              data-testid="voice-memory-search"
              type="search"
              value={memorySearch}
              onChange={(e) => setMemorySearch(e.target.value)}
              placeholder="Cerca una frase, originale o tradotta…"
              className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2.5 pl-9 pr-4
                         text-[13px] font-body text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.4))]
                         placeholder:text-[var(--mood-text-muted, rgba(240,235,224,0.4))]"
            />
          </div>
          {[
            ['all',             'Tutte'],
            ['ai_only',         'AI'],
            ['human_reviewed',  'Riviste'],
            ['locked_approved', 'Lock'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMemoryFilter(id)}
              data-testid={`voice-memory-filter-${id}`}
              className={`px-4 py-2 text-[10.5px] uppercase tracking-[0.22em] font-mono border
                ${memoryFilter === id
                  ? 'border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)]'
                  : 'border-[var(--mood-border, rgba(255,255,255,0.1))] text-[var(--mood-text-muted, rgba(240,235,224,0.55))] hover:text-[var(--mood-text, #f0ebe0)]'}`}>
              {label}
            </button>
          ))}
        </div>

        {filteredMemory.length === 0 ? (
          <Card>
            <p className="font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              {memorySearch || memoryFilter !== 'all'
                ? 'Nessuna frase corrisponde ai filtri.'
                : 'Il dizionario è ancora vuoto. Ogni traduzione dello studio comparirà qui.'}
            </p>
          </Card>
        ) : (
          <ol className="space-y-4" data-testid="voice-memory-list">
            {filteredMemory.map((row) => (
              <MemoryRow key={row.id} row={row} onChanged={refreshAll} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
};

// ──────────────  VOCABULARY EDITOR  ──────────────
const VocabularyEditor = ({ vocab, onChanged }) => {
  const [draft, setDraft] = useState({
    source_term: '', source_locale: 'it', target_locale: 'en-US',
    preferred_translation: '', category: 'editorial', notes: '',
  });
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!draft.source_term.trim() || !draft.preferred_translation.trim()) return;
    setAdding(true);
    try {
      await api.post('/api/voice/vocabulary', draft);
      setDraft({ ...draft, source_term: '', preferred_translation: '', notes: '' });
      onChanged();
      toast.success('Vocabolo aggiunto');
    } catch (_) { toast.error('Aggiunta non riuscita'); }
    finally { setAdding(false); }
  };

  const removeVocab = async (id) => {
    try {
      await api.delete(`/api/voice/vocabulary/${id}`);
      onChanged();
    } catch (_) { toast.error('Rimozione non riuscita'); }
  };

  return (
    <>
      <Card className="mb-6" data-testid="voice-vocabulary-add">
        <p className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))] mb-4">
          Add a term
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_60px_1fr_120px_auto] gap-3 items-end">
          <input
            data-testid="voice-vocab-source-input"
            type="text" value={draft.source_term}
            onChange={(e) => setDraft({...draft, source_term: e.target.value})}
            placeholder="materico"
            className="bg-transparent border-b border-[var(--mood-border, rgba(255,255,255,0.15))] py-2 text-[14px] font-body italic text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent, #d9b285)]" />
          <span className="text-center text-[var(--mood-text-muted, rgba(240,235,224,0.5))] pb-2">→</span>
          <input
            data-testid="voice-vocab-target-input"
            type="text" value={draft.preferred_translation}
            onChange={(e) => setDraft({...draft, preferred_translation: e.target.value})}
            placeholder="material-rich"
            className="bg-transparent border-b border-[var(--mood-border, rgba(255,255,255,0.15))] py-2 text-[14px] font-body italic text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent, #d9b285)]" />
          <select
            value={draft.category}
            onChange={(e) => setDraft({...draft, category: e.target.value})}
            className="bg-transparent border-b border-[var(--mood-border, rgba(255,255,255,0.15))] py-2 text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.7))] outline-none">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={add} disabled={adding}
            className="px-5 py-2 text-[10.5px] uppercase tracking-[0.22em] font-mono border border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)] hover:bg-[var(--mood-accent-soft, rgba(217,178,133,0.06))] disabled:opacity-40 flex items-center gap-2">
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} strokeWidth={1.8} />}
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </Card>

      {vocab.length === 0 ? (
        <Card>
          <p className="font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
            Il vocabolario dello studio è ancora da costruire. Aggiungete i vostri termini editoriali signature qui sopra.
          </p>
        </Card>
      ) : (
        <ol className="space-y-3" data-testid="voice-vocabulary-list">
          {vocab.map((v) => (
            <li key={v.id} data-testid={`voice-vocab-row-${v.id}`}
                className="flex items-baseline gap-4 py-4 border-b border-[var(--mood-border, rgba(255,255,255,0.05))]">
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.42))] w-[80px] shrink-0">
                {v.source_locale} → {v.target_locale}
              </p>
              <p className="flex-1 font-heading text-[16px] leading-[1.4] text-[var(--mood-text, #f0ebe0)] italic">
                "{v.source_term}"
                <span className="text-[var(--mood-text-muted, rgba(240,235,224,0.5))] mx-3 not-italic">⟶</span>
                <span className="not-italic text-[var(--mood-accent, #d9b285)]">"{v.preferred_translation}"</span>
              </p>
              <span className="text-[9.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
                {v.category}
              </span>
              <button type="button" onClick={() => removeVocab(v.id)}
                title="Rimuovi"
                className="text-[var(--mood-text-muted, rgba(240,235,224,0.4))] hover:text-[var(--mood-danger, #c25b5b)]">
                <Trash2 size={13} strokeWidth={1.6} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
};

// ──────────────  MEMORY ROW  ──────────────
const MemoryRow = ({ row, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(row.localized_text || '');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy]       = useState(false);
  const isLocked = row.review_status === 'locked_approved';

  const lock = async () => {
    setBusy(true);
    try { await api.post(`/api/voice/lock/${row.id}`); onChanged(); toast.success('Frase fissata.'); }
    catch (_) { toast.error('Lock non riuscito.'); }
    finally { setBusy(false); }
  };
  const unlock = async () => {
    setBusy(true);
    try { await api.post(`/api/voice/unlock/${row.id}`); onChanged(); }
    catch (_) { toast.error('Unlock non riuscito.'); }
    finally { setBusy(false); }
  };
  const saveRewrite = async () => {
    setBusy(true);
    try {
      await api.post(`/api/voice/rewrite/${row.id}`, {
        studio_translation: draft, rationale, lock: true,
      });
      setEditing(false); setRationale('');
      onChanged(); toast.success('Riscrittura applicata · frase fissata');
    } catch (_) { toast.error('Riscrittura non riuscita.'); }
    finally { setBusy(false); }
  };

  return (
    <li data-testid={`voice-memory-row-${row.id}`} className="p-7 border border-[var(--mood-border, rgba(255,255,255,0.06))] bg-[var(--mood-surface, #11141a)]">
      <div className="flex items-baseline justify-between mb-5">
        <p className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))]">
          {row.source_locale} → {row.target_locale}
          <span className="ml-4 text-[var(--mood-text-faint, rgba(240,235,224,0.32))]">
            v{row.translation_version} · {row.usage_count}× usato
          </span>
        </p>
        <span className={`text-[9.5px] uppercase tracking-[0.26em] font-mono ${
          isLocked ? 'text-[var(--mood-accent, #d9b285)]' :
          row.review_status === 'human_reviewed' ? 'text-[var(--mood-text, #f0ebe0)]' :
          'text-[var(--mood-text-muted, rgba(240,235,224,0.45))]'}`}>
          {REVIEW_LABELS[row.review_status] || row.review_status}
        </span>
      </div>

      <p className="font-heading italic text-[15px] leading-[1.65] text-[var(--mood-text-muted, rgba(240,235,224,0.7))] mb-3">
        "{row.original_text}"
      </p>
      {editing ? (
        <>
          <textarea
            data-testid={`voice-memory-rewrite-${row.id}`}
            value={draft} onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.1))] p-4 mb-3 text-[15px] font-body leading-[1.6] text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent, #d9b285)]"
          />
          <input
            type="text" value={rationale} onChange={(e) => setRationale(e.target.value)}
            placeholder="Motivazione (opzionale) — perché lo studio preferisce questa formulazione"
            className="w-full bg-transparent border-b border-[var(--mood-border, rgba(255,255,255,0.1))] py-2 text-[12.5px] font-body italic text-[var(--mood-text-muted, rgba(240,235,224,0.7))] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.5))]"
          />
          <div className="mt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => { setEditing(false); setDraft(row.localized_text); }}
              className="text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.5))] hover:text-[var(--mood-text, #f0ebe0)]">
              Annulla
            </button>
            <button type="button" onClick={saveRewrite} disabled={busy}
              data-testid={`voice-memory-save-${row.id}`}
              className="px-5 py-2 text-[10.5px] uppercase tracking-[0.22em] font-mono border border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)] flex items-center gap-2">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} strokeWidth={1.7} />}
              Salva e fissa
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-heading text-[16px] leading-[1.55] text-[var(--mood-text, #f0ebe0)] mb-4">
            {row.localized_text}
          </p>
          {row.previous_localized_text && (
            <p className="text-[11.5px] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.42))] mb-4">
              ← era: <em>"{row.previous_localized_text}"</em>
            </p>
          )}
          <div className="flex gap-3 pt-3 border-t border-[var(--mood-border, rgba(255,255,255,0.04))]">
            <button type="button" onClick={() => setEditing(true)}
              data-testid={`voice-memory-edit-${row.id}`}
              className="text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.6))] hover:text-[var(--mood-text, #f0ebe0)] flex items-center gap-1.5">
              <PencilLine size={11} strokeWidth={1.7} />
              Riscrivi
            </button>
            {isLocked ? (
              <button type="button" onClick={unlock} disabled={busy}
                data-testid={`voice-memory-unlock-${row.id}`}
                className="text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.6))] hover:text-[var(--mood-text, #f0ebe0)] flex items-center gap-1.5">
                <Unlock size={11} strokeWidth={1.7} />
                Sblocca
              </button>
            ) : (
              <button type="button" onClick={lock} disabled={busy}
                data-testid={`voice-memory-lock-${row.id}`}
                className="text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-accent, #d9b285)] hover:opacity-80 flex items-center gap-1.5">
                <Lock size={11} strokeWidth={1.7} />
                Fissa
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
};

export default StudioVoicePage;
