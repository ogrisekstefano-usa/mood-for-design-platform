/**
 * ImpersonationBanner — sticky banner shown when super_admin is operating on
 * behalf of another tenant. Provides one-click stop.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ShieldAlert, X } from 'lucide-react';

const ImpersonationBanner = () => {
  const { impersonating, stopImpersonation, t } = useBlueprint();
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    if (!impersonating) return;
    api.get(`/api/super/tenants/${impersonating}`)
      .then((r) => setTenantName(r.data.tenant?.name || impersonating))
      .catch(() => setTenantName(impersonating));
  }, [impersonating]);

  if (!impersonating) return null;

  return (
    <div
      data-testid="impersonation-banner"
      className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldAlert size={14} className="text-amber-400 flex-shrink-0" />
        <p className="text-amber-300 text-xs font-body truncate">
          <span className="uppercase tracking-wider text-[10px] font-semibold mr-2">
            {t('impersonation.active', null, 'Impersonating')}
          </span>
          <span className="text-amber-100">{tenantName}</span>
        </p>
      </div>
      <button
        data-testid="stop-impersonation-btn"
        onClick={() => { stopImpersonation(); window.location.reload(); }}
        className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-100 transition-colors font-body"
      >
        <X size={12} /> {t('impersonation.stop', null, 'Exit')}
      </button>
    </div>
  );
};

export default ImpersonationBanner;
