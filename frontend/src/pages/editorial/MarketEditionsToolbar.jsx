/**
 * MarketEditionsToolbar™
 * ────────────────────────────────────────────────────────────────────
 * Top sticky operations bar for the Editorial Studio.
 *
 *   + NUOVO MASTER · + NUOVA MARKET EDITION · DUPLICA · PROGRAMMA ·
 *   APRI CALENDARIO · CREA DA PINTEREST · CREA DA PROGETTO
 *
 * Below the bar: editorial flow strip showing the 5 canonical stages
 * (Master → Market Editions → Review → Schedule → Publish) with the
 * active stage highlighted based on the selected variant status.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Copy, CalendarClock, Calendar, Compass, FolderOpen, ChevronRight,
  Loader2, X, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const FLOW_STAGES = [
  { id: 'master',   label: 'Master',         desc: 'Direzione editoriale globale' },
  { id: 'editions', label: 'Market Editions', desc: 'Versioni culturalmente native' },
  { id: 'review',   label: 'Review',          desc: 'Approvazione publication' },
  { id: 'schedule', label: 'Schedule',        desc: 'Programmazione internazionale' },
  { id: 'publish',  label: 'Publish',         desc: 'Live sulle superfici pubbliche' },
];

// Map variant.status → which flow stage is active
const STAGE_FOR_STATUS = (status) => {
  if (!status) return 'master';
  if (['draft', 'composing'].includes(status)) return 'editions';
  if (['awaiting_review', 'in_review', 'rebalancing'].includes(status)) return 'review';
  if (['approved', 'scheduled'].includes(status)) return 'schedule';
  if (['published', 'live'].includes(status)) return 'publish';
  return 'editions';
};

// ─── Modal: New Master ────────────────────────────────────────────────
const NewMasterModal = ({ open, onClose, onCreated }) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState('');
  const [locale, setLocale] = useState('it-IT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const submit = async () => {
    if (!code.trim() || !title.trim()) {
      setError('Code e titolo sono obbligatori');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await api.post('/api/editorial/masters', {
        code: code.trim(),
        title: title.trim(),
        canonical_locale: locale,
        conceptual_direction: direction.trim() || null,
      });
      toast.success('Editorial Master creato · ora componi le Market Editions');
      onCreated?.(r.data);
      onClose();
      // Reset
      setCode(''); setTitle(''); setDirection(''); setLocale('it-IT');
    } catch (e) {
      setError(e?.response?.data?.detail || 'Creazione fallita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="new-master-modal"
         className="fixed inset-0 z-[55] bg-black/72 backdrop-blur-sm flex items-center justify-center p-6"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-lg bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[14px] shadow-2xl">
        <header className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body mb-1">Editorial Studio</p>
            <h2 className="text-[20px] font-heading text-[var(--bp-text-primary)] leading-tight">Nuovo Editorial Master</h2>
            <p className="text-[12px] text-[var(--bp-text-muted)] font-body italic mt-1">
              La direzione editoriale globale da cui nasceranno le Market Editions.
            </p>
          </div>
          <button type="button" onClick={onClose} data-testid="new-master-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
                   placeholder="es. mediterranean-spring-2026"
                   data-testid="new-master-code"
                   className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13.5px] text-[var(--bp-text-primary)] font-mono focus:outline-none focus:border-[var(--bp-border-hover)]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Titolo</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="es. Atmosfere mediterranee 2026"
                   data-testid="new-master-title"
                   className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13.5px] text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Locale canonico</label>
            <select value={locale} onChange={(e) => setLocale(e.target.value)}
                    data-testid="new-master-locale"
                    className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13.5px] text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] cursor-pointer">
              <option value="it-IT">it-IT · Italiano</option>
              <option value="en-US">en-US · English (US)</option>
              <option value="en-GB">en-GB · English (UK)</option>
              <option value="es-ES">es-ES · Español (España)</option>
              <option value="fr-FR">fr-FR · Français</option>
              <option value="de-DE">de-DE · Deutsch</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Direzione concettuale</label>
            <textarea value={direction} onChange={(e) => setDirection(e.target.value)}
                      rows={3}
                      placeholder="Una frase che cattura l'atmosfera, non un brief tecnico."
                      data-testid="new-master-direction"
                      className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px] text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] resize-none" />
          </div>
          {error && <p className="text-[12px] text-red-400 font-body">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] rounded-b-[14px]">
          <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">Annulla</button>
          <button type="button" onClick={submit} disabled={saving}
                  data-testid="new-master-submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--bp-primary)] text-black hover:opacity-90 text-[12.5px] font-medium disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {saving ? 'Creazione…' : 'Crea Master'}
          </button>
        </footer>
      </div>
    </div>
  );
};

// ─── Modal: New Market Edition ────────────────────────────────────────
const NewMarketEditionModal = ({ open, master, markets, onClose, onCreated }) => {
  const [marketId, setMarketId] = useState('');
  const [targetLocale, setTargetLocale] = useState('');
  const [variantSlug, setVariantSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const submit = async () => {
    if (!master?.id) { setError('Seleziona prima un Editorial Master'); return; }
    if (!marketId || !targetLocale.trim() || !variantSlug.trim()) {
      setError('Mercato, locale e slug sono obbligatori');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post(`/api/editorial/masters/${master.id}/variants`, {
        market_id: marketId,
        target_locale: targetLocale.trim(),
        variant_slug: variantSlug.trim(),
        title: master.title || '',
      });
      toast.success(`Market Edition creata per ${markets.find((m) => m.id === marketId)?.code || marketId}`);
      onCreated?.(r.data);
      onClose();
      setMarketId(''); setTargetLocale(''); setVariantSlug(''); setError(null);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Creazione fallita');
    } finally { setSaving(false); }
  };

  const pickMarket = (m) => {
    setMarketId(m.id);
    setTargetLocale(m.primary_locale || '');
    if (master && !variantSlug) setVariantSlug(`${(master.code || 'edition').toLowerCase()}-${(m.code || 'market').toLowerCase()}`);
  };

  return (
    <div data-testid="new-edition-modal"
         className="fixed inset-0 z-[55] bg-black/72 backdrop-blur-sm flex items-center justify-center p-6"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-xl bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[14px] shadow-2xl">
        <header className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body mb-1">
              Master · {master?.code || '—'}
            </p>
            <h2 className="text-[20px] font-heading text-[var(--bp-text-primary)] leading-tight">Nuova Market Edition</h2>
            <p className="text-[12px] text-[var(--bp-text-muted)] font-body italic mt-1">
              Scegli il mercato di destinazione. Tono, CTA e ritmo si adatteranno alla cultura locale.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5 space-y-4">
          {!master?.id && (
            <p className="text-[12px] text-amber-400 font-body italic">Seleziona prima un Editorial Master dalla colonna a sinistra.</p>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-2">Mercato</label>
            <div className="grid grid-cols-2 gap-2">
              {(markets || []).map((m) => (
                <button key={m.id} type="button"
                        onClick={() => pickMarket(m)}
                        data-testid={`new-edition-market-${m.code}`}
                        className={`text-left p-3 rounded-[8px] border transition-colors ${
                          marketId === m.id
                            ? 'border-[var(--bp-primary)] bg-[var(--bp-primary-soft)]'
                            : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-hover)]'
                        }`}>
                  <p className="text-[12.5px] text-[var(--bp-text-primary)] font-body font-medium">{m.code}</p>
                  <p className="text-[10.5px] text-[var(--bp-text-muted)] font-mono mt-0.5">{m.primary_locale || '—'}</p>
                </button>
              ))}
              {(markets || []).length === 0 && (
                <p className="text-[12px] text-[var(--bp-text-muted)] font-body italic col-span-2 py-3 text-center">
                  Nessun mercato attivo · configura in International Presence.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Target locale</label>
              <input value={targetLocale} onChange={(e) => setTargetLocale(e.target.value)}
                     placeholder="es. en-AE"
                     data-testid="new-edition-locale"
                     className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px] font-mono text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">Variant slug</label>
              <input value={variantSlug} onChange={(e) => setVariantSlug(e.target.value)}
                     placeholder="es. spring-2026-ae"
                     data-testid="new-edition-slug"
                     className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px] font-mono text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]" />
            </div>
          </div>
          {error && <p className="text-[12px] text-red-400 font-body">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] rounded-b-[14px]">
          <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] text-[var(--bp-text-muted)]">Annulla</button>
          <button type="button" onClick={submit} disabled={saving || !master?.id}
                  data-testid="new-edition-submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--bp-primary)] text-black hover:opacity-90 text-[12.5px] font-medium disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {saving ? 'Creazione…' : 'Crea Market Edition'}
          </button>
        </footer>
      </div>
    </div>
  );
};

// ─── Modal: Schedule ──────────────────────────────────────────────────
const ScheduleModal = ({ open, variant, onClose, onScheduled }) => {
  const [when, setWhen] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setMinutes(0); d.setSeconds(0);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const iso = new Date(when).toISOString();
      await api.post(`/api/editorial/variants/${variant.id}/schedule`, { scheduled_at: iso });
      toast.success(`Programmato per ${new Date(iso).toLocaleString('it-IT')}`);
      onScheduled?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Programmazione fallita');
    } finally { setSaving(false); }
  };

  return (
    <div data-testid="schedule-modal"
         className="fixed inset-0 z-[55] bg-black/72 backdrop-blur-sm flex items-center justify-center p-6"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-md bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[14px] shadow-2xl">
        <header className="px-6 pt-6 pb-3 border-b border-[var(--bp-border)]">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body mb-1">Schedule</p>
          <h2 className="text-[20px] font-heading text-[var(--bp-text-primary)]">Programma la pubblicazione</h2>
        </header>
        <div className="px-6 py-5 space-y-3">
          <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body italic">
            Variant: <span className="text-[var(--bp-text-primary)] font-mono">{variant?.variant_slug || '—'}</span>
          </p>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                 data-testid="schedule-datetime"
                 className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px] text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]" />
        </div>
        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] rounded-b-[14px]">
          <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] text-[var(--bp-text-muted)]">Annulla</button>
          <button type="button" onClick={submit} disabled={saving}
                  data-testid="schedule-submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--bp-primary)] text-black hover:opacity-90 text-[12.5px] font-medium disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />}
            Programma
          </button>
        </footer>
      </div>
    </div>
  );
};

// ─── Flow strip ───────────────────────────────────────────────────────
const FlowStrip = ({ activeStage }) => (
  <div className="me-flow-strip" data-testid="me-flow-strip">
    {FLOW_STAGES.map((stage, idx) => {
      const active = stage.id === activeStage;
      const passed = FLOW_STAGES.findIndex((s) => s.id === activeStage) > idx;
      return (
        <React.Fragment key={stage.id}>
          <div className={`me-flow-step ${active ? 'is-active' : ''} ${passed ? 'is-passed' : ''}`}
               data-testid={`me-flow-step-${stage.id}`}>
            <span className="me-flow-step__index">{idx + 1}</span>
            <div className="me-flow-step__body">
              <p className="me-flow-step__label">{stage.label}</p>
              <p className="me-flow-step__desc">{stage.desc}</p>
            </div>
          </div>
          {idx < FLOW_STAGES.length - 1 && <ChevronRight size={12} className="me-flow-arrow" />}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main toolbar ─────────────────────────────────────────────────────
const MarketEditionsToolbar = ({
  selectedMaster, selectedVariant, markets = [], onReload,
}) => {
  const navigate = useNavigate();
  const [showNewMaster, setShowNewMaster] = useState(false);
  const [showNewEdition, setShowNewEdition] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const activeStage = STAGE_FOR_STATUS(selectedVariant?.status);

  const handleDuplicate = async () => {
    if (!selectedVariant?.id || !selectedMaster?.id) {
      toast.error('Seleziona prima una Market Edition da duplicare');
      return;
    }
    setDuplicating(true);
    try {
      // Pull full variant
      const r = await api.get(`/api/editorial/variants/${selectedVariant.id}`);
      const v = r.data || {};
      // Create a clone with -copy suffix on slug
      const newSlug = `${v.variant_slug || selectedVariant.variant_slug}-copy-${Date.now().toString(36).slice(-4)}`;
      const payload = {
        market_id: v.market_id,
        target_locale: v.target_locale,
        variant_slug: newSlug,
        blueprint_review_locale: v.blueprint_review_locale || 'it-IT',
        title: `${v.title || ''} (copia)`,
        excerpt: v.excerpt || null,
        body_blocks: v.body_blocks || [],
        hero_image_url: v.hero_image_url || null,
        cultural_angle: v.cultural_angle || null,
        tone_label: v.tone_label || null,
        pacing_label: v.pacing_label || null,
        seo: v.seo || {},
        cta_set: v.cta_set || [],
        hotspot_data: v.hotspot_data || [],
      };
      await api.post(`/api/editorial/masters/${selectedMaster.id}/variants`, payload);
      toast.success('Market Edition duplicata');
      onReload?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Duplicazione fallita');
    } finally { setDuplicating(false); }
  };

  return (
    <>
      <div className="me-toolbar" data-testid="me-toolbar">
        <div className="me-toolbar__primary">
          <button type="button"
                  className="me-btn me-btn--primary"
                  data-testid="me-cta-new-master"
                  onClick={() => setShowNewMaster(true)}>
            <Plus size={12} strokeWidth={2} />
            <span>Nuovo Master</span>
          </button>
          <button type="button"
                  className="me-btn"
                  data-testid="me-cta-new-edition"
                  onClick={() => setShowNewEdition(true)}
                  disabled={!selectedMaster?.id}
                  title={!selectedMaster?.id ? 'Seleziona prima un Master' : ''}>
            <Plus size={12} strokeWidth={2} />
            <span>Nuova Market Edition</span>
          </button>
          <button type="button"
                  className="me-btn"
                  data-testid="me-cta-duplicate"
                  onClick={handleDuplicate}
                  disabled={!selectedVariant?.id || duplicating}
                  title={!selectedVariant?.id ? 'Seleziona una Market Edition da duplicare' : ''}>
            {duplicating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} strokeWidth={1.6} />}
            <span>Duplica</span>
          </button>
          <button type="button"
                  className="me-btn"
                  data-testid="me-cta-schedule"
                  onClick={() => setShowSchedule(true)}
                  disabled={!selectedVariant?.id}
                  title={!selectedVariant?.id ? 'Seleziona una Market Edition' : ''}>
            <CalendarClock size={12} strokeWidth={1.6} />
            <span>Programma</span>
          </button>
        </div>
        <div className="me-toolbar__secondary">
          <button type="button"
                  className="me-btn me-btn--ghost"
                  data-testid="me-cta-open-calendar"
                  onClick={() => navigate('/blueprint/editorial-calendar')}>
            <Calendar size={12} strokeWidth={1.6} />
            <span>Apri Calendario</span>
          </button>
          <button type="button"
                  className="me-btn me-btn--ghost"
                  data-testid="me-cta-from-pinterest"
                  onClick={() => navigate('/workspace/references?openAdd=1')}>
            <Compass size={12} strokeWidth={1.6} />
            <span>Da Pinterest</span>
          </button>
          <button type="button"
                  className="me-btn me-btn--ghost"
                  data-testid="me-cta-from-project"
                  onClick={() => navigate('/blueprint/projects-studio')}>
            <FolderOpen size={12} strokeWidth={1.6} />
            <span>Da Progetto</span>
          </button>
        </div>
      </div>

      <FlowStrip activeStage={activeStage} />

      <NewMasterModal
        open={showNewMaster}
        onClose={() => setShowNewMaster(false)}
        onCreated={onReload}
      />
      <NewMarketEditionModal
        open={showNewEdition}
        master={selectedMaster}
        markets={markets}
        onClose={() => setShowNewEdition(false)}
        onCreated={onReload}
      />
      <ScheduleModal
        open={showSchedule}
        variant={selectedVariant}
        onClose={() => setShowSchedule(false)}
        onScheduled={onReload}
      />
    </>
  );
};

export default MarketEditionsToolbar;
