/**
 * DomainsPage — Tenant Domains (`/settings/domains`).
 *
 * Lists registered custom domains/subdomains, lets users add new ones, and
 * exposes DNS setup instructions like Vercel/Shopify/Framer admin.
 * Verification is currently manual (TXT lookup worker lands later).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Globe, Trash2, ShieldCheck, AlertCircle, Lock,
  Copy, RefreshCcw, Star, Loader2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';

const STATUS_PILL = {
  pending:  { label: 'Pending',  cls: 'text-amber-300 bg-amber-300/10 border-amber-300/25' },
  verified: { label: 'Verified', cls: 'text-[var(--bp-primary)] bg-[var(--bp-primary)]/12 border-[var(--bp-primary)]/30' },
  failed:   { label: 'Failed',   cls: 'text-rose-300 bg-rose-300/10 border-rose-300/25' },
  issued:   { label: 'Issued',   cls: 'text-[var(--bp-primary)] bg-[var(--bp-primary)]/12 border-[var(--bp-primary)]/30' },
};

const StatusPill = ({ status, testid }) => {
  const s = STATUS_PILL[status] || STATUS_PILL.pending;
  return (
    <span data-testid={testid}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-body uppercase tracking-[0.16em] ${s.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {s.label}
    </span>
  );
};

const Code = ({ value, testid }) => (
  <code data-testid={testid}
        className="px-2 py-1 rounded-[3px] bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] text-[11px] font-mono break-all">
    {value}
  </code>
);

const CopyBtn = ({ value, testid }) => (
  <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied'); }}
          data-testid={testid}
          title="Copy"
          className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
    <Copy size={11} strokeWidth={1.5} />
  </button>
);

// ── DNS Instructions drawer ───────────────────────────────────────
const InstructionsDrawer = ({ open, domain, onClose, onVerify }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !domain) { setData(null); return; }
    api.get(`/api/domains/${domain.id}/instructions`).then((r) => setData(r.data));
  }, [open, domain]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="dns-drawer">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)] flex flex-col overflow-y-auto">
        <header className="flex items-start justify-between p-6 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">DNS configuration</p>
            <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] mt-0.5">{domain?.hostname}</h2>
            <p className="text-[var(--bp-text-muted)] text-[12px] font-body mt-1">
              Add the records below at your DNS provider, then click Verify.
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="dns-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 p-6">
          {!data && <p className="text-[var(--bp-text-muted)] text-[12px]"><Loader2 className="inline animate-spin mr-1" size={12} /> Loading…</p>}
          {data && (
            <>
              <div className="mb-5 flex items-center gap-2">
                <StatusPill status={data.verification_status} testid="dns-verify-status" />
                <StatusPill status={data.ssl_status} testid="dns-ssl-status" />
              </div>
              {data.records.map((rec, i) => (
                <div key={i} className="mb-4 p-4 rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-2)] border border-[var(--bp-border)]"
                     data-testid={`dns-record-${rec.type}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em]">{rec.type}</span>
                    <span className="text-[var(--bp-text-muted)] text-[10px] font-body italic">{rec.purpose}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center mb-1.5">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-body">Name</span>
                    <Code value={rec.name} testid={`dns-${rec.type}-name`} />
                    <CopyBtn value={rec.name} testid={`dns-${rec.type}-name-copy`} />
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-body">Value</span>
                    <Code value={rec.value} testid={`dns-${rec.type}-value`} />
                    <CopyBtn value={rec.value} testid={`dns-${rec.type}-value-copy`} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <footer className="p-6 border-t border-[var(--bp-border)] flex items-center justify-between">
          <p className="text-[var(--bp-text-muted)] text-[10px] font-body">
            DNS can take 5 min – 24h to propagate.
          </p>
          <button disabled={busy}
                  onClick={async () => { setBusy(true); try { await onVerify(domain); } finally { setBusy(false); } }}
                  data-testid="dns-verify-btn"
                  className="px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[10px] font-body uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} strokeWidth={1.5} />}
            Verify now
          </button>
        </footer>
      </div>
    </div>
  );
};

// ── Add domain inline form ────────────────────────────────────────
const AddDomainForm = ({ onAdd, atCap, onUpgrade }) => {
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    if (!host.trim()) return;
    setBusy(true);
    try {
      await onAdd(host.trim().toLowerCase());
      setHost('');
    } finally { setBusy(false); }
  };
  if (atCap) {
    return (
      <button onClick={onUpgrade}
              data-testid="domain-upgrade-cta"
              className="w-full p-4 rounded-[var(--bp-radius-md)] border border-dashed border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)] text-[11px] font-body uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-colors">
        <Lock size={11} strokeWidth={1.5} />
        Domain limit reached — upgrade to add more
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 mb-6" data-testid="domain-add-form">
      <input type="text"
             value={host}
             onChange={(e) => setHost(e.target.value)}
             placeholder="studio.example.com"
             data-testid="domain-input"
             className="flex-1 px-3 py-2.5 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[13px] font-mono outline-none focus:border-[var(--bp-primary)] transition-colors" />
      <button type="submit" disabled={busy || !host.trim()}
              data-testid="domain-add-btn"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[10px] font-body uppercase tracking-[0.22em] hover:brightness-110 disabled:opacity-50 transition-all">
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} strokeWidth={1.8} />}
        Add domain
      </button>
    </form>
  );
};

// ── Main ──────────────────────────────────────────────────────────
const DomainsPage = () => {
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const { user } = useAuth();
  const { license, capacityFor, refresh: refreshLic } = useLicense();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);

  const canManage = user?.role === 'super_admin' || user?.role === 'tenant_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/domains');
      setDomains(d.data || []);
    } catch (e) {
      toast.error('Could not load domains');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (host) => {
    try {
      await api.post('/api/domains', { hostname: host });
      toast.success('Domain added — configure DNS to verify');
      refreshLicense();
      await load();
      refreshLic();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Domain limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan || ''} plan.`);
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Could not add domain');
      }
    }
  };
  const verify = async (domain) => {
    try {
      await api.post(`/api/domains/${domain.id}/verify`);
      toast.message('Verification triggered — DNS may take time to propagate');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Verification failed');
    }
  };
  const remove = async (domain) => {
    if (!confirm(`Remove ${domain.hostname}? This is reversible from the audit log.`)) return;
    try {
      await api.delete(`/api/domains/${domain.id}`);
      toast.success('Domain removed');
      refreshLicense();
      await load();
      refreshLic();
    } catch (e) { toast.error('Could not remove'); }
  };
  const setPrimary = async (domain) => {
    try {
      await api.patch(`/api/domains/${domain.id}`, { is_primary: true });
      toast.success('Primary domain updated');
      await load();
    } catch (e) { toast.error('Could not update'); }
  };

  // Only CUSTOM domains count toward the plan limit — subdomains under
  // *.moodfordesign.com are free for the tenant.
  const cap = capacityFor('domains');
  const atCap = cap.atCap;

  return (
    <div className="p-10 max-w-5xl mx-auto" data-testid="domains-page">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/settings')}
                  data-testid="domains-back"
                  className="flex items-center gap-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] mb-3">
            <ArrowLeft size={11} strokeWidth={1.5} /> {t('common.back', null, 'Back')}
          </button>
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
            Workspace · Domains
          </p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] leading-none">
            Custom domains
          </h1>
          <p className="text-[var(--bp-text-muted)] text-[13px] font-body mt-2 max-w-xl">
            Connect your own domain or subdomain. Verification uses DNS records.
          </p>
        </div>
        {license && (
          <UsageChip label="Custom domains" current={cap.current} limit={cap.limit}
                     unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                     testid="domains-usage-chip" />
        )}
      </div>

      {canManage && (
        <AddDomainForm onAdd={add} atCap={atCap} onUpgrade={() => navigate('/settings/plan')} />
      )}

      {/* List */}
      <div className="border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-3 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">
          <p>Domain</p>
          <p>Verification</p>
          <p>SSL</p>
          <p className="text-right">—</p>
        </div>
        {loading && (
          <div className="p-12 flex items-center justify-center text-[var(--bp-text-muted)]">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading…
          </div>
        )}
        {!loading && domains.length === 0 && (
          <div className="p-12 text-center text-[var(--bp-text-muted)] text-[12px] font-body italic" data-testid="domains-empty">
            No domains yet. Add one above to begin.
          </div>
        )}
        {!loading && domains.map((d) => (
          <div key={d.id}
               data-testid={`domain-row-${d.id}`}
               className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-3.5 items-center border-b border-[var(--bp-border)] last:border-b-0 hover:bg-[var(--bp-surface-1)]/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Globe size={14} strokeWidth={1.5} className="text-[var(--bp-text-muted)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[var(--bp-text-primary)] text-[13px] font-mono truncate flex items-center gap-2">
                  {d.hostname}
                  {d.is_primary && <Star size={11} strokeWidth={1.8} className="text-[var(--bp-primary)]" />}
                </p>
                <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.18em]">{d.kind}</p>
              </div>
            </div>
            <StatusPill status={d.verification_status} testid={`domain-verify-status-${d.id}`} />
            <StatusPill status={d.ssl_status} testid={`domain-ssl-status-${d.id}`} />
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setDrawer(d)} data-testid={`domain-dns-${d.id}`}
                      title="DNS"
                      className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60">
                <ShieldCheck size={13} strokeWidth={1.5} />
              </button>
              {canManage && !d.is_primary && (
                <button onClick={() => setPrimary(d)} data-testid={`domain-primary-${d.id}`}
                        title="Set primary"
                        className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] hover:bg-[var(--bp-surface-2)]/60">
                  <Star size={13} strokeWidth={1.5} />
                </button>
              )}
              {canManage && (
                <button onClick={() => remove(d)} data-testid={`domain-remove-${d.id}`}
                        title="Remove"
                        className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-rose-300 hover:bg-[var(--bp-surface-2)]/60">
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <InstructionsDrawer
        open={!!drawer}
        domain={drawer}
        onClose={() => setDrawer(null)}
        onVerify={async (d) => { await verify(d); setDrawer({ ...d }); }}
      />
    </div>
  );
};

export default DomainsPage;
