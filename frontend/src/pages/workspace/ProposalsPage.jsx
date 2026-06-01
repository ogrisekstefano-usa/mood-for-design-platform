import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { FileText } from 'lucide-react';
import ArchiveBanner from '../../components/journey/ArchiveBanner';
import '../journey/step-workspace.css';
const ProposalsPage = () => {
  const {
    t
  } = useBlueprint();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/api/proposals').then(r => setItems(r.data.data || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  return <div className="p-8 max-w-7xl mx-auto" data-testid="proposals-page">
      <ArchiveBanner testid="proposals-archive-banner" eyebrow="Archivio · Sprint G.6" title={t("workspace.proposals.le_presentazioni_vivono_dentro_i_loro_journey")} lede="Le presentazioni di concept, technical package e momenti finali si organizzano nel Design Journey che le ha generate. Qui le ritrovi tutte." ctaLabel="Apri Blueprint Dashboard" ctaTo="/dashboard" />
      <div className="mb-8">
        <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.workspace')}</p>
        <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]">{t('proposals.title')}</h1>
      </div>
      {loading ? <div className="h-44 skeleton rounded-md" /> : items.length === 0 ? <div className="text-center py-20">
          <FileText size={36} className="text-[var(--bp-text-subtle)] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[var(--bp-text-muted)] font-body">{t('proposals.empty')}</p>
        </div> : <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--bp-border)]">
              {['common.actions', 'projects.field.status', 'projects.field.budget', 'leads.field.createdAt'].map(k => <th key={k} className="text-left px-5 py-3.5 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[var(--bp-text-subtle)]">{t(k)}</th>)}
            </tr></thead>
            <tbody>
              {items.map((p, i) => <tr key={p.id} data-testid={`proposal-row-${i}`} className="border-b border-[var(--bp-surface-2)] hover:bg-[var(--bp-surface-2)]/30">
                  <td className="px-5 py-3.5 text-[var(--bp-text-primary)] text-sm font-body">{p.title}</td>
                  <td className="px-5 py-3.5 text-[var(--bp-text-secondary)] text-xs font-body">{p.status}</td>
                  <td className="px-5 py-3.5 text-[var(--bp-text-secondary)] text-xs font-body">{p.total_value ? `${p.currency} ${p.total_value}` : '—'}</td>
                  <td className="px-5 py-3.5 text-[var(--bp-text-subtle)] text-xs font-body">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                </tr>)}
            </tbody>
          </table>
        </div>}
    </div>;
};
export default ProposalsPage;