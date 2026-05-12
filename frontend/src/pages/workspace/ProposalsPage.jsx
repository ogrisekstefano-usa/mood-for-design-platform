import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { FileText } from 'lucide-react';

const ProposalsPage = () => {
  const { t } = useBlueprint();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/proposals').then((r) => setItems(r.data.data || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="proposals-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.workspace')}</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('proposals.title')}</h1>
      </div>
      {loading ? (
        <div className="h-44 skeleton rounded-md" />
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body">{t('proposals.empty')}</p>
        </div>
      ) : (
        <div className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-white/[0.05]">
              {['common.actions', 'projects.field.status', 'projects.field.budget', 'leads.field.createdAt'].map((k) => (
                <th key={k} className="text-left px-5 py-3.5 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[#4A4845]">{t(k)}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map((p, i) => (
                <tr key={p.id} data-testid={`proposal-row-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 text-[#EFEBE4] text-sm font-body">{p.title}</td>
                  <td className="px-5 py-3.5 text-[#A19D98] text-xs font-body">{p.status}</td>
                  <td className="px-5 py-3.5 text-[#A19D98] text-xs font-body">{p.total_value ? `${p.currency} ${p.total_value}` : '—'}</td>
                  <td className="px-5 py-3.5 text-[#4A4845] text-xs font-body">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProposalsPage;
