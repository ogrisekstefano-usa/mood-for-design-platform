import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { Plus, FileText, Send, Check, X, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  draft: { label: 'Bozza', bg: 'bg-white/5', text: 'text-[#6B6863]', icon: FileText },
  sent: { label: 'Inviata', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Send },
  viewed: { label: 'Visualizzata', bg: 'bg-purple-500/10', text: 'text-purple-400', icon: Clock },
  approved: { label: 'Approvata', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: Check },
  revision_requested: { label: 'Revisione', bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]', icon: Clock },
  rejected: { label: 'Rifiutata', bg: 'bg-red-500/10', text: 'text-red-400', icon: X },
  expired: { label: 'Scaduta', bg: 'bg-white/5', text: 'text-[#4A4845]', icon: Clock },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] font-semibold font-body ${c.bg} ${c.text}`}>
      <Icon size={11} strokeWidth={2} />
      {c.label}
    </span>
  );
};

const NewProposalModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ title: '', description: '', client_email: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/api/proposals', form); onSave(); }
    catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-md animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">Nuova Proposta</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Titolo</label>
            <input required value={form.title} onChange={set('title')} placeholder="es. Proposta Villa Como #1"
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Email Cliente</label>
            <input type="email" value={form.client_email} onChange={set('client_email')} placeholder="cliente@email.com"
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Descrizione</label>
            <textarea rows={3} value={form.description} onChange={set('description')}
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Annulla</button>
            <button type="submit" disabled={loading} data-testid="save-proposal-btn"
              className="flex-1 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? 'Salvataggio...' : 'Crea Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const STATUS_TABS = [{ key: '', label: 'Tutte' }, { key: 'draft', label: 'Bozze' }, { key: 'sent', label: 'Inviate' }, { key: 'approved', label: 'Approvate' }, { key: 'revision_requested', label: 'Revisione' }];

const ProposalsPage = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = tab ? `?status=${tab}` : '';
      const { data } = await api.get(`/api/proposals${params}`);
      setProposals(data.data || []);
    } catch { setProposals([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="proposals-page">
      {showModal && <NewProposalModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Workspace</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Proposals</h1>
        </div>
        <button data-testid="new-proposal-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuova Proposta
        </button>
      </div>

      <div className="flex gap-1 bg-[#141416] border border-white/[0.06] rounded-[4px] p-1 mb-6 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] transition-colors ${tab === t.key ? 'bg-[#1C1C1F] text-[#EFEBE4]' : 'text-[#6B6863] hover:text-[#A19D98]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-[#141416] border border-white/[0.06] rounded-md skeleton" />)}
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body mb-2">Nessuna proposta</p>
          <button onClick={() => setShowModal(true)} className="text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">+ Crea la prima proposta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposals.map((p, i) => (
            <div key={p.id} data-testid={`proposal-card-${i}`}
              className="bg-[#141416] border border-white/[0.06] rounded-md p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={p.status} />
                <span className="text-[#3A3835] text-[10px] font-body">v{p.version || 1}</span>
              </div>
              <h3 className="font-heading text-lg text-[#EFEBE4] mb-1">{p.title}</h3>
              {p.client_email && <p className="text-[#6B6863] text-xs font-body">{p.client_email}</p>}
              {p.description && <p className="text-[#4A4845] text-xs font-body mt-2 line-clamp-2">{p.description}</p>}
              <div className="mt-4 pt-4 border-t border-white/[0.04] flex justify-between items-center">
                <span className="text-[#3A3835] text-[10px] font-body">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('it-IT') : ''}
                </span>
                {p.status === 'draft' && (
                  <button onClick={() => api.post(`/api/proposals/${p.id}/send`).then(load)}
                    className="flex items-center gap-1.5 text-[#D4AF37] text-xs font-body hover:text-[#E2C365] transition-colors">
                    <Send size={11} strokeWidth={1.5} /> Invia
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProposalsPage;
