/**
 * Admin Tenants — list, search, create, navigate to detail.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, Building2, Search, Circle } from 'lucide-react';

const STATUS_TONES = {
  active: 'text-emerald-400 bg-emerald-500/10',
  draft: 'text-amber-400 bg-amber-500/10',
  suspended: 'text-red-400 bg-red-500/10',
  archived: 'text-[var(--bp-text-muted)] bg-white/5',
};

const NewTenantModal = ({ onClose, onSaved }) => {
  const { t } = useBlueprint();
  const [form, setForm] = useState({ name: '', default_language: 'en-US', plan: 'trial' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await api.post('/api/super/tenants', form);
      onSaved();
    } catch (e) { setErr(formatError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border-strong)] rounded-md w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[var(--bp-border)]">
          <h3 className="font-heading text-2xl text-[var(--bp-text-primary)]">{t('admin.tenants.new', null, 'Create tenant')}</h3>
          <button onClick={onClose} className="text-[var(--bp-text-subtle)] hover:text-[var(--bp-text-secondary)] text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">Name</label>
            <input data-testid="new-tenant-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Studio Verdi Milano"
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">Default locale</label>
              <select value={form.default_language} onChange={(e) => setForm({ ...form, default_language: e.target.value })}
                className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                {['en-US', 'en-GB', 'it', 'fr', 'de', 'es'].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                {['trial', 'starter', 'pro', 'enterprise'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-red-400 text-xs font-body">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] text-sm font-body rounded-[3px]">{t('common.cancel')}</button>
            <button data-testid="save-tenant-btn" type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[var(--bp-bg)] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminTenantsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/super/tenants');
      setTenants(data.data || []);
    } catch { setTenants([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const blob = `${t.name || ''} ${t.slug || ''}`.toLowerCase();
    return blob.includes(search.toLowerCase());
  });

  return (
    <div className="p-10 max-w-7xl mx-auto" data-testid="admin-tenants-page">
      {showModal && <NewTenantModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-amber-400/80 text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2">{t('admin.nav.tenants')}</p>
          <h1 className="font-heading text-5xl font-light text-[var(--bp-text-primary)]">{t('admin.tenants.title', null, 'Tenants')}</h1>
          <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2">{tenants.length} {t('admin.tenants.totalSub', null, 'across the platform')}</p>
        </div>
        <button data-testid="new-tenant-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[var(--bp-bg)] font-semibold text-xs font-body rounded-[3px]">
          <Plus size={14} /> {t('admin.tenants.new', null, 'New tenant')}
        </button>
      </div>

      <div className="mb-6 relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bp-text-subtle)]" />
        <input data-testid="tenants-search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')} className="input-luxury w-full pl-9 pr-4 py-2 text-sm font-body rounded-[3px]" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={36} className="text-[var(--bp-text-subtle)] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[var(--bp-text-muted)] font-body">{t('admin.tenants.empty', null, 'No tenants yet')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tenant, i) => (
            <div
              key={tenant.id}
              data-testid={`tenant-card-${i}`}
              onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
              className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5 cursor-pointer hover:border-amber-500/20 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-[4px] flex items-center justify-center"
                  style={{ backgroundColor: tenant.primary_color || 'var(--bp-surface-2)' }}>
                  <Building2 size={16} className="text-white/80" strokeWidth={1.5} />
                </div>
                <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] uppercase tracking-wide ${STATUS_TONES[tenant.status] || ''}`}>
                  {tenant.status}
                </span>
              </div>
              <h3 className="font-heading text-xl text-[var(--bp-text-primary)] leading-tight mb-1">{tenant.name}</h3>
              <p className="text-[var(--bp-text-muted)] text-xs font-body mb-3">/{tenant.slug}</p>
              <div className="flex items-center gap-4 text-[10px] text-[var(--bp-text-subtle)] font-body">
                <span>{tenant.member_count || 0} members</span>
                <span className="capitalize flex items-center gap-1"><Circle size={6} className="fill-current" /> {tenant.plan || 'trial'}</span>
                <span className="uppercase tracking-wide">{tenant.default_language}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTenantsPage;
