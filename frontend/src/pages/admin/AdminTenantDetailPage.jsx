/**
 * Admin Tenant Detail — full management: status, plan, modules, feature flags, members, audit, impersonate.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ArrowLeft, Building2, UserCog, Settings, ToggleLeft, ToggleRight, ShieldAlert } from 'lucide-react';

const Toggle = ({ checked, onChange, testid }) => (
  <button data-testid={testid} onClick={onChange}
    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${checked ? 'bg-amber-400' : 'bg-[var(--bp-border-strong)]'}`}>
    <span className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

const AdminTenantDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, startImpersonation } = useBlueprint();
  const [detail, setDetail] = useState(null);
  const [moduleCatalog, setModuleCatalog] = useState([]);
  const [flagCatalog, setFlagCatalog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, mc, fc] = await Promise.all([
        api.get(`/api/super/tenants/${id}`),
        api.get('/api/super/catalog/modules'),
        api.get('/api/super/catalog/flags'),
      ]);
      setDetail(d.data);
      setModuleCatalog(mc.data.modules || []);
      setFlagCatalog(fc.data.flags || []);
    } catch (e) { console.error(e); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 1800); };

  const toggleModule = async (moduleId) => {
    if (saving) return;
    setSaving(true);
    const cur = new Set(detail.enabled_modules);
    cur.has(moduleId) ? cur.delete(moduleId) : cur.add(moduleId);
    try {
      await api.put(`/api/super/tenants/${id}/modules`, { enabled: Array.from(cur) });
      flash(t('admin.saved', null, 'Saved'));
      load();
    } catch (e) { flash(formatError(e)); }
    finally { setSaving(false); }
  };

  const toggleFlag = async (flagId) => {
    if (saving) return;
    setSaving(true);
    const current = detail.feature_flags[flagId];
    try {
      await api.put(`/api/super/tenants/${id}/feature-flags`, { overrides: { [flagId]: !current } });
      flash(t('admin.saved', null, 'Saved'));
      load();
    } catch (e) { flash(formatError(e)); }
    finally { setSaving(false); }
  };

  const updateStatus = async (status) => {
    setSaving(true);
    try {
      await api.put(`/api/super/tenants/${id}`, { status });
      flash(t('admin.saved'));
      load();
    } catch (e) { flash(formatError(e)); }
    finally { setSaving(false); }
  };

  const updatePlan = async (plan) => {
    setSaving(true);
    try {
      await api.put(`/api/super/tenants/${id}`, { plan });
      flash(t('admin.saved'));
      load();
    } catch (e) { flash(formatError(e)); }
    finally { setSaving(false); }
  };

  const impersonate = async () => {
    await api.post(`/api/super/tenants/${id}/impersonate`);
    startImpersonation(id);
    navigate('/dashboard');
  };

  if (!detail) {
    return <div className="p-10 flex items-center justify-center"><div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const tenant = detail.tenant;
  const usage = detail.usage;
  const planName = detail.plan?.name || 'trial';

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="admin-tenant-detail">
      <button onClick={() => navigate('/admin/tenants')} className="text-[var(--bp-text-subtle)] hover:text-[var(--bp-text-secondary)] text-xs font-body flex items-center gap-1.5 mb-6">
        <ArrowLeft size={12} /> {t('admin.nav.tenants')}
      </button>

      <div className="flex items-start justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md flex items-center justify-center border border-[var(--bp-border)]"
            style={{ backgroundColor: tenant.primary_color || 'var(--bp-surface-2)' }}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" className="w-full h-full object-cover rounded-md" /> : <Building2 size={22} className="text-white/80" />}
          </div>
          <div>
            <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]">{tenant.name}</h1>
            <p className="text-[var(--bp-text-muted)] text-sm font-body">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span data-testid="save-msg" className="text-xs text-emerald-400 font-body">{msg}</span>}
          <button data-testid="impersonate-btn" onClick={impersonate}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20 text-amber-300 text-xs font-body rounded-[3px]">
            <ShieldAlert size={13} /> {t('admin.impersonate', null, 'Impersonate')}
          </button>
        </div>
      </div>

      {/* Usage stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {Object.entries(usage).map(([k, v]) => (
          <div key={k} className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-4">
            <p className="text-[var(--bp-text-subtle)] text-[10px] font-body uppercase tracking-[0.15em] mb-1">{k}</p>
            <p className="font-heading text-2xl text-[var(--bp-text-primary)] font-light">{v}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status + Plan */}
        <section className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={13} className="text-amber-400" />
            <h2 className="text-[var(--bp-text-primary)] text-sm font-body font-semibold">{t('admin.detail.statusPlan', null, 'Status & Plan')}</h2>
          </div>

          <p className="text-[10px] uppercase tracking-wider text-[var(--bp-text-muted)] font-body mb-1.5">Status</p>
          <div className="grid grid-cols-3 gap-1 mb-4">
            {['active', 'suspended', 'archived'].map((s) => (
              <button key={s} data-testid={`status-${s}`} onClick={() => updateStatus(s)}
                className={`px-2 py-1.5 text-[11px] font-body rounded-[3px] capitalize ${tenant.status === s ? 'bg-[var(--bp-border)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:bg-[var(--bp-surface-2)]'}`}>
                {s}
              </button>
            ))}
          </div>

          <p className="text-[10px] uppercase tracking-wider text-[var(--bp-text-muted)] font-body mb-1.5">Plan</p>
          <div className="grid grid-cols-2 gap-1">
            {['trial', 'starter', 'pro', 'enterprise'].map((p) => (
              <button key={p} data-testid={`plan-${p}`} onClick={() => updatePlan(p)}
                className={`px-2 py-1.5 text-[11px] font-body rounded-[3px] capitalize ${planName === p ? 'bg-amber-400/20 text-amber-300' : 'text-[var(--bp-text-muted)] hover:bg-[var(--bp-surface-2)]'}`}>
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <ToggleRight size={13} className="text-amber-400" />
            <h2 className="text-[var(--bp-text-primary)] text-sm font-body font-semibold">{t('admin.detail.modules', null, 'Modules')}</h2>
          </div>
          <div className="space-y-2.5">
            {moduleCatalog.map((m) => {
              const enabled = detail.enabled_modules.includes(m.id);
              return (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[var(--bp-text-primary)] text-sm font-body capitalize">{m.id}</p>
                    <p className="text-[10px] text-[var(--bp-text-subtle)] font-body truncate">{m.description}</p>
                  </div>
                  <Toggle checked={enabled} onChange={() => toggleModule(m.id)} testid={`module-toggle-${m.id}`} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature flags */}
        <section className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <ToggleLeft size={13} className="text-amber-400" />
            <h2 className="text-[var(--bp-text-primary)] text-sm font-body font-semibold">{t('admin.detail.flags', null, 'Feature Flags')}</h2>
          </div>
          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {flagCatalog.map((f) => {
              const enabled = detail.feature_flags[f.id];
              return (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[var(--bp-text-primary)] text-sm font-body">{f.id}</p>
                    <p className="text-[10px] text-[var(--bp-text-subtle)] font-body">
                      {f.scope}{f.beta && ' · BETA'}{f.enterprise_only && ' · ENTERPRISE'}
                    </p>
                  </div>
                  <Toggle checked={enabled} onChange={() => toggleFlag(f.id)} testid={`flag-toggle-${f.id}`} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Members */}
      <section className="mt-6 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCog size={13} className="text-amber-400" />
          <h2 className="text-[var(--bp-text-primary)] text-sm font-body font-semibold">{t('admin.detail.members', null, 'Members')}</h2>
        </div>
        {detail.members.length === 0 ? (
          <p className="text-[var(--bp-text-subtle)] text-sm font-body">{t('common.noResults')}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--bp-border)]">
                {['Email', 'Name', 'Role', 'Status'].map((h) => (
                  <th key={h} className="text-left py-2 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[var(--bp-text-subtle)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.members.map((m) => (
                <tr key={m.id} className="border-b border-[var(--bp-surface-2)]" data-testid={`member-row-${m.id}`}>
                  <td className="py-2.5 text-[var(--bp-text-primary)] text-sm font-body">{m.email}</td>
                  <td className="py-2.5 text-[var(--bp-text-secondary)] text-xs font-body">{`${m.first_name || ''} ${m.last_name || ''}`.trim()}</td>
                  <td className="py-2.5 text-[var(--bp-text-secondary)] text-xs font-body capitalize">{m.role?.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 text-[var(--bp-text-muted)] text-xs font-body">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default AdminTenantDetailPage;
