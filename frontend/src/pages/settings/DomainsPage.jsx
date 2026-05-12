/**
 * DomainsPage — manage tenant domains (subdomains + custom).
 */
import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Globe, Plus, Trash2, Check, CircleSlash } from 'lucide-react';

const DomainsPage = () => {
  const { t } = useBlueprint();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/settings/domains');
      setDomains(data.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!adding.trim()) return;
    setBusy(true); setError('');
    try {
      await api.post('/api/settings/domains', { domain: adding.trim(), is_primary: isPrimary });
      setAdding(''); setIsPrimary(false);
      load();
    } catch (e) { setError(formatError(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this domain?')) return;
    await api.delete(`/api/settings/domains/${id}`);
    load();
  };

  return (
    <div className="p-10 max-w-3xl mx-auto" data-testid="domains-page">
      <div className="mb-10">
        <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">
          {t('nav.section.system')}
        </p>
        <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]">
          {t('domains.title', null, 'Domains')}
        </h1>
        <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2">
          {t('domains.subtitle', null, 'Connect a custom domain or use a Blueprint subdomain for your workspace.')}
        </p>
      </div>

      <form onSubmit={submit} className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-5 mb-6">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--bp-text-muted)] font-body mb-1.5">
          {t('domains.add', null, 'Add domain')}
        </label>
        <div className="flex gap-2">
          <input
            data-testid="domain-input"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="studio.example.com"
            className="input-luxury flex-1 px-3 py-2.5 text-sm font-body rounded-[var(--bp-radius-sm)]"
          />
          <button data-testid="add-domain-btn" type="submit" disabled={busy || !adding.trim()}
            className="px-5 py-2.5 bg-[var(--bp-primary)] hover:opacity-90 text-[var(--bp-bg)] font-semibold text-xs font-body rounded-[var(--bp-radius-sm)] disabled:opacity-40 flex items-center gap-1.5">
            <Plus size={13} /> {t('common.new')}
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--bp-text-secondary)] font-body cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="accent-[var(--bp-primary)]" />
          {t('domains.makePrimary', null, 'Set as primary')}
        </label>
        {error && <p className="text-red-400 text-xs font-body mt-2">{error}</p>}
      </form>

      <div className="space-y-2">
        {loading ? (
          [1, 2].map((i) => <div key={i} className="h-14 skeleton rounded-[var(--bp-radius-md)]" />)
        ) : domains.length === 0 ? (
          <div className="text-center py-12">
            <Globe size={32} className="text-[var(--bp-text-subtle)] mx-auto mb-3" strokeWidth={1} />
            <p className="text-[var(--bp-text-muted)] text-sm font-body">{t('domains.empty', null, 'No domains yet.')}</p>
          </div>
        ) : (
          domains.map((d, i) => (
            <div key={d.id} data-testid={`domain-row-${i}`}
              className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] px-5 py-4 flex items-center gap-4">
              <Globe size={16} className="text-[var(--bp-text-muted)]" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="text-[var(--bp-text-primary)] text-sm font-body font-medium truncate">{d.domain}</p>
                <p className="text-[10px] text-[var(--bp-text-subtle)] font-body uppercase tracking-wide">
                  {d.type} · {d.is_primary ? 'PRIMARY · ' : ''}{d.verification_status}
                </p>
              </div>
              <span className={`text-[11px] font-body px-2 py-1 rounded-[3px] ${
                d.verification_status === 'verified' ? 'bg-emerald-500/10 text-emerald-400' :
                d.verification_status === 'failed' ? 'bg-red-500/10 text-red-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                {d.verification_status === 'verified' ? <Check size={11} className="inline mr-1" /> : <CircleSlash size={11} className="inline mr-1" />}
                {d.verification_status}
              </span>
              <button data-testid={`domain-delete-${i}`} onClick={() => remove(d.id)} className="text-[var(--bp-text-muted)] hover:text-red-400">
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DomainsPage;
