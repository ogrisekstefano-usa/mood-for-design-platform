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
} from '../../site/content/languages';

const LanguagesPage = () => {
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [registry, setRegistry] = useState(() => getLanguageRegistry());
  const [dirty, setDirty] = useState(false);

  const update = (code, patch) => {
    setRegistry((prev) => prev.map((l) => (l.code === code ? { ...l, ...patch } : l)));
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
                  <input type="checkbox" checked={l.enabled} onChange={(e) => update(l.code, { enabled: e.target.checked })} data-testid={`lang-enabled-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={l.public_enabled} disabled={!l.enabled} onChange={(e) => update(l.code, { public_enabled: e.target.checked })} data-testid={`lang-public-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={l.blueprint_enabled} disabled={!l.enabled} onChange={(e) => update(l.code, { blueprint_enabled: e.target.checked })} data-testid={`lang-blueprint-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="radio" name="default-locale" checked={l.default_locale} disabled={!l.enabled} onChange={() => setDefault(l.code)} data-testid={`lang-default-${l.code}`} />
                </td>
                <td style={{ textAlign: 'center', color: l.rtl ? '#C9A36E' : 'inherit', fontWeight: l.rtl ? 600 : 400 }}>{l.rtl ? 'RTL' : '\u2014'}</td>
                <td><code style={{ fontSize: 12 }}>{l.fallback_locale}</code></td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={l.ai_translation_enabled} onChange={(e) => update(l.code, { ai_translation_enabled: e.target.checked })} data-testid={`lang-ai-${l.code}`} />
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
