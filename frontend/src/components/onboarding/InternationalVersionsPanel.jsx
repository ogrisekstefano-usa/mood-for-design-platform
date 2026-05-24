/**
 * ITER147 · International Profile Identity™ — Editorial UI panel.
 *
 * Versioni Internazionali™ — sits inside OwnerIntroductionModal as an
 * optional collapsible section. UX rules are STRICT:
 *
 *   · Feels editorial, premium, cinematic — NOT translation management.
 *   · Locale cards, preview-first, elegant badges, soft typography.
 *   · NEVER expose the words "AI generated" / "machine translated" to
 *     the user. The wording is "Adattato per i tuoi clienti
 *     internazionali" / "Adatto per il pubblico di {Country}".
 *
 * The data model is the same `editorial_blocks` namespace used by the
 * rest of the Editorial Runtime™ — this UI is a thin, cinematic skin
 * on top of `/api/profile/me/identity`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Globe2, Loader2, Lock, RefreshCw, RotateCcw, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const FIELD_LABEL = {
  role_label:           'Ruolo',
  short_bio:            'Biografia',
  response_time_label:  'Tempo di risposta',
  contact_cta_label:    'Etichetta CTA',
};

const LOCALE_DISPLAY = {
  'it-it': { flag: '🇮🇹', name: 'Italiano',     market: 'Italia' },
  'en-us': { flag: '🇺🇸', name: 'English (US)', market: 'Stati Uniti' },
  'en-gb': { flag: '🇬🇧', name: 'English (UK)', market: 'Regno Unito' },
  'fr-fr': { flag: '🇫🇷', name: 'Français',     market: 'Francia' },
  'de-de': { flag: '🇩🇪', name: 'Deutsch',      market: 'Germania' },
  'es-es': { flag: '🇪🇸', name: 'Español',      market: 'Spagna' },
};

// Status → editorial badge wording. NEVER says "AI generated".
const STATUS_BADGE = {
  source: {
    label: 'Versione originale',
    tone:  '#cdd5dc',
  },
  auto: {
    label: 'Adattata per il pubblico locale',
    tone:  '#7ce4f5',
  },
  manual: {
    label: 'Personalizzata',
    tone:  '#f4c97a',
  },
  manual_stale: {
    label: 'Personalizzata · da rivedere',
    tone:  '#e88d6d',
  },
  stale: {
    label: 'Da aggiornare',
    tone:  '#e88d6d',
  },
  locked: {
    label: 'Approvata · bloccata',
    tone:  '#c084fc',
  },
  missing: {
    label: 'Non ancora composta',
    tone:  'rgba(255,255,255,0.35)',
  },
};

const localeLabel = (code) =>
  LOCALE_DISPLAY[code] || { flag: '·', name: code, market: code };

const InternationalVersionsPanel = ({ canEdit = true }) => {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [pending, setPending]   = useState({});  // {`${field}:${locale}`: action-name}
  const [activeField, setActiveField] = useState('role_label');
  const [editing, setEditing]   = useState(null); // {field, locale, value}

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/profile/me/identity');
      setIdentity(data);
    } catch (e) {
      // Non-fatal — panel is optional. Silent for the initial load.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const fields = identity?.fields || {};
  const sourceLocale = (identity?.default_locale || 'it-it').toLowerCase();

  // Show only the fields with a source value — others are blanks.
  const fieldsWithSource = useMemo(
    () => Object.keys(FIELD_LABEL).filter((f) => fields[f]?.source_value),
    [identity],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] py-5"
            data-testid="intl-versions-loading">
        <Loader2 className="animate-spin" size={12} />
        Composizione in corso…
      </div>
    );
  }

  if (!fieldsWithSource.length) {
    return (
      <div className="text-[12px] text-[var(--bp-text-faint)] font-body py-3"
            data-testid="intl-versions-empty">
        Salva prima il tuo ruolo e la biografia. Le versioni internazionali
        verranno composte automaticamente per ogni mercato.
      </div>
    );
  }

  const setBusy = (k, name) => setPending((p) => ({ ...p, [k]: name }));
  const clearBusy = (k) => setPending((p) => {
    const cp = { ...p }; delete cp[k]; return cp;
  });

  const onRegenerate = async (field, locale) => {
    const k = `${field}:${locale}`;
    setBusy(k, 'regenerate');
    try {
      const { data } = await api.post(
        `/api/profile/me/identity/${field}/${locale}/regenerate`,
      );
      setIdentity(data.identity);
      toast.success('Versione composta nuovamente.');
    } catch (e) {
      toast.error('Impossibile rigenerare ora.');
    } finally {
      clearBusy(k);
    }
  };

  const onLock = async (field, locale, locked) => {
    const k = `${field}:${locale}`;
    setBusy(k, 'lock');
    try {
      const { data } = await api.post(
        `/api/profile/me/identity/${field}/${locale}/lock?locked=${locked}`,
      );
      setIdentity(data.identity);
      toast.success(locked ? 'Versione approvata.' : 'Approvazione rimossa.');
    } catch (e) {
      toast.error('Operazione fallita.');
    } finally {
      clearBusy(k);
    }
  };

  const onRestoreAle = async (field, locale) => {
    const k = `${field}:${locale}`;
    setBusy(k, 'restore');
    try {
      const { data } = await api.post(
        `/api/profile/me/identity/${field}/${locale}/restore-ale`,
      );
      setIdentity(data.identity);
      toast.success('Versione internazionale ripristinata.');
    } catch (e) {
      toast.error('Impossibile ripristinare.');
    } finally {
      clearBusy(k);
    }
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    const { field, locale, value } = editing;
    const k = `${field}:${locale}`;
    setBusy(k, 'save');
    try {
      const { data } = await api.patch(
        `/api/profile/me/identity/${field}/${locale}`,
        { value },
      );
      setIdentity(data.identity);
      setEditing(null);
      toast.success('Versione salvata.');
    } catch (e) {
      toast.error('Salvataggio fallito.');
    } finally {
      clearBusy(k);
    }
  };

  const field = fields[activeField] || {};
  const sourceValue = field.source_value || '';

  return (
    <div className="space-y-5" data-testid="international-versions-panel">

      {/* Editorial intro */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Globe2 size={14} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--bp-primary)] mb-1">
            Versioni Internazionali™
          </p>
          <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body leading-relaxed max-w-[56ch]">
            Ogni cliente vede la tua presentazione adattata al proprio
            mercato. La voce dello studio resta tua — la mettiamo in scena
            con il registro culturale appropriato.
          </p>
        </div>
      </div>

      {/* Field selector — only filled fields */}
      <div className="flex flex-wrap gap-1.5" data-testid="intl-field-tabs">
        {fieldsWithSource.map((f) => (
          <button
            key={f}
            type="button"
            data-testid={`intl-field-tab-${f}`}
            onClick={() => setActiveField(f)}
            className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.22em] transition-all
                        ${activeField === f
                          ? 'bg-[var(--bp-primary)]/10 border border-[var(--bp-primary)]/55 text-[var(--bp-primary)]'
                          : 'border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}
          >
            {FIELD_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Source preview */}
      <div className="rounded-[12px] border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40 px-4 py-3"
            data-testid="intl-source-preview">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1.5">
          {localeLabel(sourceLocale).flag} Originale · {localeLabel(sourceLocale).market}
        </p>
        <p className="font-body text-[14px] text-[var(--bp-text-primary)] leading-relaxed">
          {sourceValue}
        </p>
      </div>

      {/* Locale cards (per-locale, preview-first) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            data-testid="intl-locale-cards">
        {(field.locales || [])
          .filter((l) => l.locale !== sourceLocale)
          .map((row) => {
            const k = `${activeField}:${row.locale}`;
            const busy = pending[k];
            const meta = localeLabel(row.locale);
            const badge = STATUS_BADGE[row.status] || STATUS_BADGE.missing;
            const isLocked = row.status === 'locked';
            const hasValue = !!(row.value && String(row.value).trim());
            return (
              <div key={row.locale}
                    data-testid={`intl-locale-card-${row.locale}`}
                    data-status={row.status}
                    className="rounded-[14px] border border-[var(--bp-border)] bg-[var(--bp-surface-1)] p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] text-[var(--bp-text-primary)] font-medium">
                      <span className="mr-1.5">{meta.flag}</span>{meta.market}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-faint)]"
                        style={{ color: badge.tone }}>
                      {badge.label}
                    </p>
                  </div>
                  {isLocked && <Lock size={12} className="text-[#c084fc]" />}
                </div>

                <p className="font-body text-[13.5px] text-[var(--bp-text-primary)] leading-relaxed min-h-[44px]"
                    data-testid={`intl-locale-value-${row.locale}`}>
                  {hasValue ? row.value : '—'}
                </p>

                {canEdit && (
                  <div className="flex items-center justify-end gap-1 -mb-1">
                    {/* Edit */}
                    <button type="button" disabled={!!busy || isLocked}
                            onClick={() => setEditing({
                              field: activeField, locale: row.locale,
                              value: row.value || '',
                            })}
                            data-testid={`intl-locale-edit-${row.locale}`}
                            title="Personalizza"
                            className="p-1.5 rounded text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] disabled:opacity-30">
                      <Pencil size={12} strokeWidth={1.6} />
                    </button>
                    {/* Regenerate */}
                    <button type="button" disabled={!!busy || isLocked}
                            onClick={() => onRegenerate(activeField, row.locale)}
                            data-testid={`intl-locale-regen-${row.locale}`}
                            title="Adatta nuovamente"
                            className="p-1.5 rounded text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] disabled:opacity-30">
                      {busy === 'regenerate'
                        ? <Loader2 className="animate-spin" size={12} />
                        : <RefreshCw size={12} strokeWidth={1.6} />}
                    </button>
                    {/* Restore-ALE when manual */}
                    {(row.status === 'manual' || row.status === 'manual_stale') && (
                      <button type="button" disabled={!!busy}
                              onClick={() => onRestoreAle(activeField, row.locale)}
                              data-testid={`intl-locale-restore-${row.locale}`}
                              title="Ripristina versione internazionale"
                              className="p-1.5 rounded text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] disabled:opacity-30">
                        <RotateCcw size={12} strokeWidth={1.6} />
                      </button>
                    )}
                    {/* Lock / Unlock */}
                    {hasValue && (
                      <button type="button" disabled={!!busy}
                              onClick={() => onLock(activeField, row.locale, !isLocked)}
                              data-testid={`intl-locale-lock-${row.locale}`}
                              title={isLocked ? 'Sblocca' : 'Approva e blocca'}
                              className={`p-1.5 rounded transition-colors
                                          ${isLocked
                                            ? 'text-[#c084fc]'
                                            : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}
                                          disabled:opacity-30`}>
                        {busy === 'lock'
                          ? <Loader2 className="animate-spin" size={12} />
                          : <Lock size={12} strokeWidth={1.6} />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Inline editor — modal-in-modal */}
      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center"
              data-testid="intl-edit-modal" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/64 backdrop-blur-sm"
                onClick={() => setEditing(null)} />
          <div className="relative w-[520px] max-w-[92vw]
                          bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                          rounded-[14px] shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--bp-primary)] mb-1">
                  Personalizza · {localeLabel(editing.locale).market}
                </p>
                <p className="font-heading text-[18px] text-[var(--bp-text-primary)]">
                  {FIELD_LABEL[editing.field]}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)}
                      aria-label="Chiudi"
                      className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <textarea
              data-testid="intl-edit-textarea"
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              rows={4}
              className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                          rounded-[10px] px-4 py-3 text-[13.5px] font-body
                          text-[var(--bp-text-primary)] resize-vertical leading-relaxed
                          focus:outline-none focus:border-[var(--bp-border-hover)]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)}
                      className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
                Annulla
              </button>
              <button type="button" onClick={onSaveEdit}
                      data-testid="intl-edit-save"
                      disabled={!editing.value.trim() ||
                                !!pending[`${editing.field}:${editing.locale}`]}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px]
                                  bg-[var(--bp-primary)] text-black text-[10px]
                                  uppercase tracking-[0.18em] font-medium
                                  hover:opacity-90 disabled:opacity-40">
                <Check size={11} strokeWidth={2.4} />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternationalVersionsPanel;
