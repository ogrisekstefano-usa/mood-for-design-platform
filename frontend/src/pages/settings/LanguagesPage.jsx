/**
 * LanguagesPage — Global Language Management System (Phase H.4 admin foundation)
 *
 * One source of truth for ALL locale logic across:
 *   • public site (homepage, projects, onboarding, professionals)
 *   • Blueprint authenticated app
 *   • future CMS, AI translation, tenant overrides
 *
 * Currently writes overrides to localStorage (`mfd_language_registry_override`)
 * which immediately propagates via `mfd:languages:change` event. Future:
 * persist to backend table `platform_languages`.
 */
import React, { useState } from 'react';
import { ArrowLeft, Globe, Save, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  LANGUAGE_REGISTRY,
  getLanguageRegistry,
  setLanguageRegistry,
  BLUEPRINT_OPERATIONAL_CODES,
  isBlueprintOperational,
} from '../../site/content/languages';
import '../admin/platform-capabilities.css'; // reuse .pcap-toggle styles

// Stessa estetica del toggle in /admin/modules — pill cyan con thumb che scorre.
const Toggle = ({ checked, onChange, disabled, label, testid }) => (
  <label
    className={`pcap-toggle ${disabled ? 'is-disabled' : ''}`}
    title={label}
    style={{ display: 'inline-block', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => !disabled && onChange?.(e.target.checked)}
      data-testid={testid}
    />
    <span className="pcap-toggle__slider" />
  </label>
);

// Default-locale selector — single-choice (radio semantics) ma stessa
// estetica del toggle per coerenza visiva con il resto della pagina.
const DefaultPin = ({ active, disabled, onSelect, testid, label }) => (
  <button
    type="button"
    onClick={() => !disabled && !active && onSelect?.()}
    disabled={disabled}
    title={label}
    data-testid={testid}
    aria-pressed={!!active}
    className="pcap-toggle"
    style={{
      border: 'none', padding: 0, background: 'transparent',
      opacity: disabled ? 0.35 : 1,
      cursor: disabled ? 'not-allowed' : (active ? 'default' : 'pointer'),
    }}
  >
    <input type="checkbox" checked={!!active} readOnly disabled={disabled} tabIndex={-1} aria-hidden />
    <span className="pcap-toggle__slider" />
  </button>
);

const LanguagesPage = () => {
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [registry, setRegistry] = useState(() => getLanguageRegistry());
  const [dirty, setDirty] = useState(false);

  const update = (code, patch) => {
    setRegistry((prev) => prev.map((l) => {
      if (l.code !== code) return l;
      // Guard: cannot enable Blueprint on a non-operational language.
      // The Blueprint Command Center™ workspace is locked to 6 fixed locales.
      const safePatch = { ...patch };
      if ('blueprint_enabled' in safePatch && safePatch.blueprint_enabled && !isBlueprintOperational(code)) {
        delete safePatch.blueprint_enabled;
      }
      return { ...l, ...safePatch };
    }));
    setDirty(true);
  };

  const setDefault = (code) => {
    setRegistry((prev) => prev.map((l) => ({ ...l, default_locale: l.code === code })));
    setDirty(true);
  };

  const onSave = () => {
    setLanguageRegistry(registry);
    setDirty(false);
  };

  const onReset = () => {
    setRegistry(LANGUAGE_REGISTRY);
    setLanguageRegistry(LANGUAGE_REGISTRY);
    setDirty(false);
  };

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="languages-page">
      <button
        onClick={() => navigate('/settings')}
        className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-xs font-body uppercase tracking-[0.2em] mb-6 inline-flex items-center gap-2"
        data-testid="languages-back"
      >
        <ArrowLeft size={14} /> {t('common.back', null, 'Back')}
      </button>

      <div className="mb-8">
        <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">
          {t('settings.languages.eyebrow', null, 'Global Language Registry')}
        </p>
        <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] mb-2">
          {t('settings.languages.title', null, 'Languages')}
        </h1>
        <p className="text-[var(--bp-text-muted)] text-sm font-body max-w-2xl">
          {t('settings.languages.intro', null, 'One source of truth shared by the public site, Blueprint workspace, onboarding flows and future CMS. Enable, disable and configure visibility per surface.')}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="languages-governance-grid">
        <div className="p-4 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]"
             data-testid="languages-blueprint-note">
          <p className="text-[var(--bp-primary)] text-[9.5px] font-body uppercase tracking-[0.24em] mb-1.5">
            {t('settings.languages.blueprint.eyebrow', null, 'Blueprint Languages')}
          </p>
          <p className="text-[var(--bp-text-secondary)] text-[12.5px] font-body leading-relaxed">
            {t('settings.languages.blueprint.copy', null,
              'Lingue operative disponibili per il workspace Blueprint.')}
          </p>
          <p className="mt-2 text-[var(--bp-text-muted)] text-[11px] font-body">
            <code style={{ fontSize: 11 }}>
              {BLUEPRINT_OPERATIONAL_CODES.join(' · ')}
            </code>
          </p>
        </div>
        <div className="p-4 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]"
             data-testid="languages-public-note">
          <p className="text-[var(--bp-primary)] text-[9.5px] font-body uppercase tracking-[0.24em] mb-1.5">
            {t('settings.languages.public.eyebrow', null, 'Public Site Languages')}
          </p>
          <p className="text-[var(--bp-text-secondary)] text-[12.5px] font-body leading-relaxed">
            {t('settings.languages.public.copy', null,
              'Lingue disponibili per sito pubblico, form, onboarding e Client Companion.')}
          </p>
          <p className="mt-2 text-[var(--bp-text-muted)] text-[11px] font-body">
            {t('settings.languages.ai.copy', null,
              'AI Translate: precompila traduzioni per le lingue pubbliche abilitate.')}
          </p>
        </div>
      </div>

      <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-x-auto" data-testid="languages-table-wrap">
        <table className="mfd-langs-table" style={{ minWidth: 880 }}>
          <thead>
            <tr>
              <th>{t('settings.languages.col.code', null, 'Code')}</th>
              <th>{t('settings.languages.col.name', null, 'Name')}</th>
              <th>{t('settings.languages.col.native', null, 'Native')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.enabled', null, 'Enabled')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.public', null, 'Public site')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.blueprint', null, 'Blueprint')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.default', null, 'Default')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.rtl', null, 'RTL')}</th>
              <th>{t('settings.languages.col.fallback', null, 'Fallback')}</th>
              <th style={{ textAlign: 'center' }}>{t('settings.languages.col.ai', null, 'AI Translate')}</th>
            </tr>
          </thead>
          <tbody>
            {registry.map((l) => (
              <tr key={l.code} className="mfd-langs-row" data-rtl={l.rtl} data-testid={`languages-row-${l.code}`}>
                <td><code style={{ fontSize: 12 }}>{l.code}</code></td>
                <td>{l.name}</td>
                <td>{l.native_name}</td>
                <td style={{ textAlign: 'center' }}>
                  <Toggle checked={l.enabled}
                          onChange={(v) => update(l.code, { enabled: v })}
                          label={l.enabled ? 'Disattiva lingua' : 'Attiva lingua'}
                          testid={`lang-enabled-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Toggle checked={l.public_enabled}
                          disabled={!l.enabled}
                          onChange={(v) => update(l.code, { public_enabled: v })}
                          label={l.public_enabled ? 'Nascondi dal sito pubblico' : 'Mostra sul sito pubblico'}
                          testid={`lang-public-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Toggle checked={l.blueprint_enabled && isBlueprintOperational(l.code)}
                          disabled={!l.enabled || !isBlueprintOperational(l.code)}
                          onChange={(v) => update(l.code, { blueprint_enabled: v })}
                          label={
                            !isBlueprintOperational(l.code)
                              ? t('settings.languages.blueprint.locked',
                                  null,
                                  'Lingua non operativa per Blueprint — disponibile solo per sito pubblico e Client Companion.')
                              : (l.blueprint_enabled ? 'Nascondi da Blueprint' : 'Mostra in Blueprint')
                          }
                          testid={`lang-blueprint-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <DefaultPin active={l.default_locale}
                              disabled={!l.enabled}
                              onSelect={() => setDefault(l.code)}
                              label={l.default_locale ? 'Lingua predefinita attuale' : 'Imposta come predefinita'}
                              testid={`lang-default-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center', color: l.rtl ? '#C9A36E' : 'inherit', fontWeight: l.rtl ? 600 : 400 }}>{l.rtl ? 'RTL' : '\u2014'}</td>
                <td><code style={{ fontSize: 12 }}>{l.fallback_locale}</code></td>
                <td style={{ textAlign: 'center' }}>
                  <Toggle checked={l.ai_translation_enabled}
                          onChange={(v) => update(l.code, { ai_translation_enabled: v })}
                          label={l.ai_translation_enabled ? 'Disattiva traduzione AI' : 'Abilita traduzione AI'}
                          testid={`lang-ai-${l.code}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!dirty}
          className="bg-[var(--bp-primary)] text-[var(--bp-on-primary)] disabled:opacity-30 px-5 py-2.5 text-xs font-body uppercase tracking-[0.2em] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          data-testid="languages-save"
        >
          <Save size={12} /> {t('common.save', null, 'Save')}
        </button>
        <button
          onClick={onReset}
          className="bg-transparent border border-[var(--bp-border)] text-[var(--bp-text-secondary)] px-5 py-2.5 text-xs font-body uppercase tracking-[0.2em] inline-flex items-center gap-2 hover:border-[var(--bp-border-strong)] transition-colors"
          data-testid="languages-reset"
        >
          <RotateCcw size={12} /> {t('common.reset', null, 'Reset to defaults')}
        </button>
        <span className="text-[var(--bp-text-muted)] text-xs font-body ml-auto inline-flex items-center gap-2">
          <Globe size={12} /> {registry.filter((l) => l.enabled).length} / {registry.length} {t('settings.languages.active', null, 'active')}
        </span>
      </div>

      <div className="mt-8 p-5 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] text-[var(--bp-text-muted)] text-xs font-body" data-testid="languages-architecture-note">
        <strong className="text-[var(--bp-text-secondary)]">{t('settings.languages.architecture', null, 'Architecture')}:</strong>{' '}
        {t('settings.languages.architectureBody', null, 'This registry is the single source of truth for all locale logic. Changes propagate live to the public site (homepage, projects, onboarding, professionals) and to the Blueprint workspace via the shared `mfd_locale` storage key and `mfd:languages:change` event. AI translation is opt-in per language and will be wired in Phase H.5.')}
      </div>
    </div>
  );
};

export default LanguagesPage;
