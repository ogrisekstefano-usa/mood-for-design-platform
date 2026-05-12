import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Globe, Palette, Users, Shield } from 'lucide-react';

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.05]">
      <Icon size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
      <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const SettingsPage = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [team, setTeam] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', logo_url: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/settings/tenant'),
      api.get('/api/settings/team'),
    ]).then(([t, tm]) => {
      setTenant(t.data);
      setTeam(tm.data?.data || []);
      setForm({ name: t.data.name || '', logo_url: t.data.logo_url || '' });
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings/tenant', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const ROLE_CONFIG = {
    super_admin: { label: 'Super Admin', color: 'text-red-400 bg-red-500/10' },
    tenant_admin: { label: 'Admin', color: 'text-[#D4AF37] bg-[#D4AF37]/10' },
    project_manager: { label: 'PM', color: 'text-purple-400 bg-purple-500/10' },
    designer: { label: 'Designer', color: 'text-blue-400 bg-blue-500/10' },
    editor: { label: 'Editor', color: 'text-emerald-400 bg-emerald-500/10' },
    client: { label: 'Client', color: 'text-[#6B6863] bg-white/5' },
  };

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="settings-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint OS™</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Tenant Settings */}
        <SectionCard title="Studio / Tenant" icon={Settings}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Nome Studio</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Studio Name"
                  className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Logo URL</label>
                <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            </div>

            {tenant && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Slug</p>
                  <p className="text-[#6B6863] text-sm font-mono">{tenant.slug}</p>
                </div>
                <div>
                  <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Piano</p>
                  <span className="text-xs font-semibold font-body px-2 py-0.5 rounded-[3px] bg-[#D4AF37]/10 text-[#D4AF37] capitalize">{tenant.subscription_plan}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button data-testid="save-tenant-btn" type="submit" disabled={saving}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
              {saved && <span className="text-emerald-400 text-sm font-body">✓ Salvato</span>}
            </div>
          </form>
        </SectionCard>

        {/* Team */}
        <SectionCard title="Team Members" icon={Users}>
          {team.length === 0 ? (
            <p className="text-[#4A4845] text-sm font-body">Nessun membro del team trovato.</p>
          ) : (
            <div className="space-y-2">
              {team.map((member, i) => {
                const rc = ROLE_CONFIG[member.role] || ROLE_CONFIG.designer;
                return (
                  <div key={member.id || i} data-testid={`team-member-${i}`}
                    className="flex items-center gap-3 p-3 rounded-[4px] hover:bg-white/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#1C1C1F] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#6B6863] text-xs font-body">{(member.full_name || member.email)?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#A19D98] text-sm font-body font-medium truncate">{member.full_name || '—'}</p>
                      <p className="text-[#4A4845] text-xs font-body truncate">{member.email}</p>
                    </div>
                    <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] ${rc.color}`}>{rc.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Current User */}
        <SectionCard title="Account" icon={Shield}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Nome</p>
              <p className="text-[#EFEBE4] text-sm font-body">{user?.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Email</p>
              <p className="text-[#EFEBE4] text-sm font-body">{user?.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Ruolo</p>
              <p className="text-[#D4AF37] text-sm font-body capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-[10px] font-body uppercase tracking-[0.1em] text-[#4A4845] mb-1">Tenant ID</p>
              <p className="text-[#4A4845] text-xs font-mono truncate">{user?.tenant_id}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default SettingsPage;
