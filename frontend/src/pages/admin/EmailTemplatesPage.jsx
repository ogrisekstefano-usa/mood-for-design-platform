/**
 * EmailTemplatesPage · ITER173 · P1.5
 *
 * 3-panel layout:
 *   [Sidebar list of templates] [Editor subject+body] [Live preview]
 *
 * Locale switch IT / EN. Magic Link is shown read-only (System Template).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Eye, Lock, ShieldCheck, Mail, Hash } from 'lucide-react';
import api from '../../lib/api';

const LOCALES = [{ code: 'it', label: 'Italiano' }, { code: 'en', label: 'English' }];

const VARS_DOC = [
  '{{client_name}}',
  '{{journey_name}}',
  '{{designer_name}}',
  '{{tenant_name}}',
  '{{magic_link}}',
  '{{appointment_date}}',
];

const Badge = ({ type, label }) => {
  const palette = {
    editable: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    protected: 'bg-red-500/15 text-red-300 border-red-500/30',
    system: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  }[type] || 'bg-white/10 text-white/70 border-white/15';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${palette}`}>
      {label}
    </span>
  );
};

const EmailTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [activeLocale, setActiveLocale] = useState('it');
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [preview, setPreview] = useState({ subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    return api.get('/api/admin/tenant/email-templates').then((r) => {
      setTemplates(r.data?.templates || []);
      if (!activeKey && r.data?.templates?.length) {
        setActiveKey(r.data.templates[0].key);
      }
    });
  };

  useEffect(() => { fetchAll().finally(() => setLoading(false)); }, []); // eslint-disable-line

  const activeTemplate = useMemo(
    () => templates.find((t) => t.key === activeKey) || null,
    [templates, activeKey]
  );
  const activeLocaleData = activeTemplate?.locales?.[activeLocale] || null;

  // Sync draft on template/locale change
  useEffect(() => {
    if (activeLocaleData) {
      setDraft({
        subject: activeLocaleData.subject || '',
        body:    activeLocaleData.body || '',
      });
    }
  }, [activeKey, activeLocale, activeLocaleData?.source]); // eslint-disable-line

  // Live preview: debounce 400ms
  useEffect(() => {
    if (!activeKey || !activeTemplate) return;
    const t = setTimeout(() => {
      api.post(`/api/admin/tenant/email-templates/${activeKey}/${activeLocale}/preview`, {
        subject: draft.subject || null,
        body:    draft.body    || null,
      }).then((r) => {
        setPreview({ subject: r.data?.subject || '', body: r.data?.body || '' });
      }).catch(() => { /* silent */ });
    }, 400);
    return () => clearTimeout(t);
  }, [draft.subject, draft.body, activeKey, activeLocale, activeTemplate]);

  const handleSave = async () => {
    if (!activeTemplate || activeTemplate.protected) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/tenant/email-templates/${activeKey}/${activeLocale}`,
        { subject: draft.subject, body: draft.body });
      await fetchAll();
      toast.success(`Template ${activeTemplate.label} (${activeLocale.toUpperCase()}) salvato.`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-white/60" data-testid="email-templates-loading">Caricamento template…</div>;
  }

  return (
    <div className="flex h-[calc(100vh-80px)]" data-testid="email-templates-page">
      {/* Sidebar list */}
      <aside className="w-72 border-r border-white/10 overflow-y-auto" data-testid="email-templates-list">
        <header className="p-6 pb-4 border-b border-white/8">
          <p className="text-[11px] uppercase tracking-[0.28em] text-bronze-400 mb-1">Communication</p>
          <h2 className="text-xl font-serif italic text-white">Email Templates</h2>
        </header>
        <ul>
          {templates.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                data-testid={`email-template-item-${t.key}`}
                onClick={() => setActiveKey(t.key)}
                className={`w-full text-left px-6 py-4 border-b border-white/5 transition-colors
                            ${activeKey === t.key ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-white">{t.label}</span>
                  {t.protected && <Lock size={11} strokeWidth={1.6} className="text-red-400/80" aria-label="Protected" />}
                </div>
                <p className="text-[12px] text-white/45 line-clamp-2 italic">{t.description}</p>
                <div className="flex gap-1.5 mt-2">
                  {t.protected ? <Badge type="protected" label="Read Only" /> : <Badge type="editable" label="Editable" />}
                  {t.system && <Badge type="system" label="System" />}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor + preview */}
      {activeTemplate && (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 overflow-hidden" data-testid="email-templates-workspace">
          {/* Editor */}
          <section className="overflow-y-auto p-8 border-r border-white/10">
            <header className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-serif italic text-white">{activeTemplate.label}</h1>
                {activeTemplate.protected && <Lock size={16} className="text-red-400" />}
              </div>
              <p className="text-[13px] text-white/55 italic mb-4">{activeTemplate.description}</p>

              {/* Locale switch */}
              <div className="flex gap-2 mb-4" role="tablist">
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    role="tab"
                    aria-selected={activeLocale === loc.code}
                    data-testid={`email-template-locale-${loc.code}`}
                    onClick={() => setActiveLocale(loc.code)}
                    className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.18em] transition-colors
                                ${activeLocale === loc.code
                                  ? 'bg-bronze-500 text-black'
                                  : 'border border-white/15 text-white/70 hover:border-white/35'}`}
                  >
                    {loc.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 text-[11px]">
                  <span className="text-white/40">Source:</span>
                  <Badge
                    type={activeLocaleData?.source === 'tenant' ? 'editable' : 'system'}
                    label={activeLocaleData?.source === 'tenant' ? 'Override Tenant' : 'System Default'}
                  />
                </div>
              </div>
            </header>

            {activeTemplate.protected && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 rounded text-[13px] text-red-200" data-testid="email-template-protected-notice">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} strokeWidth={1.5} />
                  <strong>Template protetto · System</strong>
                </div>
                Questo template è la mail di autenticazione del cliente.
                Per evitare regressioni del Magic Link, non è modificabile.
                Puoi vederne l'anteprima.
              </div>
            )}

            <label className="block mb-5">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-bronze-400 mb-2">Subject</span>
              <input
                data-testid="email-template-subject"
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                disabled={activeTemplate.protected}
                className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors disabled:opacity-50"
              />
            </label>

            <label className="block mb-5">
              <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-bronze-400 mb-2">
                <span>Body</span>
                <span className="text-white/35 normal-case tracking-normal text-[11px] italic">
                  Markdown-friendly · usa una riga vuota tra paragrafi
                </span>
              </span>
              <textarea
                data-testid="email-template-body"
                rows={12}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                disabled={activeTemplate.protected}
                className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors disabled:opacity-50 font-mono leading-relaxed"
              />
            </label>

            {/* Vars panel */}
            <div className="mb-6 p-4 bg-white/[0.03] border border-white/10 rounded">
              <p className="text-[11px] uppercase tracking-[0.22em] text-bronze-400 mb-2 flex items-center gap-2">
                <Hash size={12} strokeWidth={1.6} /> Variabili disponibili
              </p>
              <div className="flex flex-wrap gap-2">
                {VARS_DOC.map((v) => (
                  <code key={v} className="text-[12px] px-2 py-1 bg-black/40 text-bronze-300 rounded">{v}</code>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                data-testid="email-template-save"
                type="button"
                onClick={handleSave}
                disabled={saving || activeTemplate.protected}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-bronze-500 hover:bg-bronze-400 text-black rounded text-xs uppercase tracking-[0.18em] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} strokeWidth={1.6} />
                {saving ? 'Salvataggio…' : 'Salva override'}
              </button>
              {activeLocaleData?.source === 'tenant' && (
                <span className="text-[12px] text-white/45 italic">
                  Salvato l'override tenant per {activeLocale.toUpperCase()}.
                </span>
              )}
            </div>
          </section>

          {/* Live preview */}
          <section className="overflow-y-auto p-8 bg-white/[0.02]" data-testid="email-templates-preview">
            <header className="mb-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-bronze-400 mb-2 flex items-center gap-2">
                <Eye size={12} strokeWidth={1.6} /> Anteprima · variabili compilate
              </p>
              <p className="text-[12px] text-white/40 italic">
                Cliente Esempio · Progetto Residenziale · Referente Studio · MOOD for DESIGN · link demo non cliccabile
              </p>
            </header>

            <article className="bg-white text-black rounded shadow-md overflow-hidden">
              <div className="px-5 py-3 border-b border-black/10 bg-gray-50">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                  <Mail size={11} strokeWidth={1.5} /> Subject
                </p>
                <p className="text-[15px] font-medium" data-testid="email-template-preview-subject">{preview.subject}</p>
              </div>
              <div className="px-5 py-5 text-[14px] leading-relaxed whitespace-pre-wrap" data-testid="email-template-preview-body">
                {preview.body}
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesPage;
