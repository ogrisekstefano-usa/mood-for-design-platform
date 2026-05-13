/**
 * Admin Audit — recent platform actions across tenants.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

const AdminAuditPage = () => {
  const { t } = useBlueprint();
  const [logs, setLogs] = useState(null);
  useEffect(() => { api.get('/api/super/audit-logs?limit=100').then((r) => setLogs(r.data.data || [])); }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="admin-audit-page">
      <div className="mb-10">
        <p className="text-amber-400/80 text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2">{t('admin.nav.audit')}</p>
        <h1 className="font-heading text-5xl font-light text-[var(--bp-text-primary)]">{t('admin.audit.title', null, 'Audit Log')}</h1>
      </div>
      {logs == null ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 skeleton rounded-[3px]" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-[var(--bp-text-muted)] font-body">{t('common.noResults')}</p>
      ) : (
        <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--bp-border)]">
                {['When', 'Action', 'Resource', 'Tenant'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[var(--bp-text-subtle)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--bp-surface-2)]" data-testid={`audit-row-${l.id}`}>
                  <td className="px-5 py-3 text-[var(--bp-text-muted)] text-xs font-body">{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3 text-[var(--bp-text-primary)] text-sm font-body">{l.action}</td>
                  <td className="px-5 py-3 text-[var(--bp-text-secondary)] text-xs font-body">{l.resource_type}{l.resource_id ? ` · ${l.resource_id.slice(0, 8)}` : ''}</td>
                  <td className="px-5 py-3 text-[var(--bp-text-subtle)] text-xs font-body font-mono">{l.tenant_id?.slice(0, 8) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAuditPage;
