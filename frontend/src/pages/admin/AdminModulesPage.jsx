/**
 * Admin Modules Catalog — read-only view of the platform module registry.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import * as Icons from 'lucide-react';

const AdminModulesPage = () => {
  const { t } = useBlueprint();
  const [modules, setModules] = useState([]);
  useEffect(() => { api.get('/api/super/catalog/modules').then((r) => setModules(r.data.modules || [])); }, []);

  return (
    <div className="p-10 max-w-5xl mx-auto" data-testid="admin-modules-page">
      <div className="mb-10">
        <p className="text-amber-400/80 text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2">{t('admin.nav.modules')}</p>
        <h1 className="font-heading text-5xl font-light text-[var(--bp-text-primary)]">{t('admin.modules.title', null, 'Module Registry')}</h1>
        <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2">{t('admin.modules.sub', null, 'The platform-wide Blueprint module catalog. Activate per tenant from the tenant detail.')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((m) => {
          const Icon = Icons[m.icon] || Icons.Box;
          return (
            <div key={m.id} className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-[4px] bg-amber-500/10 flex items-center justify-center">
                  <Icon size={18} className="text-amber-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl text-[var(--bp-text-primary)] mb-1 capitalize">{m.id}</h3>
                  <p className="text-[var(--bp-text-muted)] text-xs font-body">{m.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[var(--bp-text-subtle)] font-body uppercase tracking-wider">
                <span>{m.default_enabled ? 'Default ON' : 'Default OFF'}</span>
                {m.enterprise_only && <span className="text-amber-400">Enterprise</span>}
                <span>{m.routes?.length || 0} routes</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminModulesPage;
