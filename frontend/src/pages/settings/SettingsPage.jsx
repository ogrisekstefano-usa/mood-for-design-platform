/**
 * SettingsPage — tenant branding + locale management.
 */
import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Palette, Globe } from 'lucide-react';

const SettingsPage = () => {
  const { t, tenant, availableLocales, locale, setLocale } = useBlueprint();
  const [form, setForm] = useState({ primary_color: '', secondary_color: '', logo_url: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (tenant) {
      setForm({
        primary_color: tenant.theme?.primary_color || '',
        secondary_color: tenant.theme?.secondary_color || '',
        logo_url: tenant.theme?.logo_url || '',
        name: tenant.name || '',
      });
    }
  }, [tenant]);

  const saveBranding = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await api.put('/api/settings/branding', form);
      setMsg(t('common.save') + ' ✓');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) { setMsg(formatError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto" data-testid="settings-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.system')}</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('settings.title')}</h1>
      </div>

      <section className="bg-[#141416] border border-white/[0.06] rounded-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Palette size={14} className="text-[var(--bp-primary,#D4AF37)]" />
          <h2 className="text-[#EFEBE4] text-sm font-body font-semibold">{t('settings.branding')}</h2>
        </div>
        <form onSubmit={saveBranding} className="space-y-4">
          {[['name', 'auth.signup.company', 'text'], ['logo_url', 'Logo URL', 'url'],
            ['primary_color', 'Primary Color', 'text'], ['secondary_color', 'Accent Color', 'text']].map(([k, lk, type]) => (
            <div key={k}>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t(lk, null, lk)}</label>
              <div className="flex items-center gap-2">
                <input data-testid={`settings-${k}`} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="input-luxury flex-1 px-3 py-2.5 text-sm font-body rounded-[3px]" />
                {(k === 'primary_color' || k === 'secondary_color') && form[k] && (
                  <span className="w-9 h-9 rounded-[3px] border border-white/[0.1]" style={{ backgroundColor: form[k] }} />
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            {msg && <p className="text-xs font-body text-[#A19D98]">{msg}</p>}
            <button data-testid="save-branding-btn" type="submit" disabled={saving}
              className="ml-auto px-5 py-2.5 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] disabled:opacity-50">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-[#141416] border border-white/[0.06] rounded-md p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe size={14} className="text-[var(--bp-primary,#D4AF37)]" />
          <h2 className="text-[#EFEBE4] text-sm font-body font-semibold">{t('settings.locale')}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availableLocales.map((l) => (
            <button key={l.code} data-testid={`pick-locale-${l.code}`} onClick={() => setLocale(l.code)}
              className={`flex items-center justify-between px-3 py-2 rounded-[3px] border text-sm font-body transition-colors ${
                locale === l.code ? 'border-[var(--bp-primary,#D4AF37)]/40 bg-[var(--bp-primary,#D4AF37)]/5 text-[var(--bp-primary,#D4AF37)]'
                  : 'border-white/[0.06] text-[#A19D98] hover:border-white/[0.12]'}`}>
              <span>{l.native}</span>
              <span className="text-[10px] text-[#4A4845] uppercase">{l.code}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
