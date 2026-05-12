import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { Plus, Search, Filter, Mail, Phone, Calendar } from 'lucide-react';

const STATUS_CONFIG = {
  new: { label: 'Nuovo', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  contacted: { label: 'Contattato', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
  qualified: { label: 'Qualificato', bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]', dot: 'bg-[#D4AF37]' },
  converted: { label: 'Convertito', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  lost: { label: 'Perso', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-semibold font-body ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const TYPE_LABELS = { client: 'Cliente', partner: 'Partner A&D' };

const NewLeadModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', type: 'client', project_type: '', budget_range: '', message: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/leads', form);
      onSave();
    } catch (err) {
      alert(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">Nuovo Lead</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] transition-colors text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[['full_name', 'Nome Completo', 'text'], ['email', 'Email', 'email'], ['phone', 'Telefono', 'tel']].map(([k, l, t]) => (
              <div key={k} className={k === 'full_name' ? 'col-span-2' : ''}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{l}</label>
                <input type={t} value={form[k]} onChange={set(k)} required={k !== 'phone'}
                  className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Tipo</label>
              <select value={form.type} onChange={set('type')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                <option value="client">Cliente Privato</option>
                <option value="partner">Partner A&D</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Budget</label>
              <input type="text" placeholder="es. €50k - €100k" value={form.budget_range} onChange={set('budget_range')}
                className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Messaggio</label>
              <textarea rows={3} value={form.message} onChange={set('message')}
                className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Annulla</button>
            <button type="submit" disabled={loading} data-testid="save-lead-btn"
              className="flex-1 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? 'Salvataggio...' : 'Salva Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TABS = [
  { key: '', label: 'Tutti' },
  { key: 'new', label: 'Nuovi' },
  { key: 'contacted', label: 'Contattati' },
  { key: 'qualified', label: 'Qualificati' },
  { key: 'converted', label: 'Convertiti' },
];

const LeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = tab ? `?status=${tab}` : '';
      const { data } = await api.get(`/api/leads${params}`);
      setLeads(data.data || []);
    } catch (_) { setLeads([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const filtered = leads.filter(l =>
    !search || l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="leads-page">
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Workspace</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Leads</h1>
        </div>
        <button data-testid="new-lead-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuovo Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-[#141416] border border-white/[0.06] rounded-[4px] p-1">
          {TABS.map(t => (
            <button key={t.key} data-testid={`tab-${t.key || 'all'}`} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] transition-colors ${tab === t.key ? 'bg-[#1C1C1F] text-[#EFEBE4]' : 'text-[#6B6863] hover:text-[#A19D98]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A4845]" />
          <input data-testid="leads-search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca lead..."
            className="input-luxury w-full pl-9 pr-4 py-2 text-sm font-body rounded-[3px]" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Nome', 'Email', 'Tipo', 'Budget', 'Status', 'Data'].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[#4A4845]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16 text-[#4A4845] text-sm font-body">Caricamento...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <p className="text-[#6B6863] text-sm font-body">Nessun lead trovato.</p>
                  <button onClick={() => setShowModal(true)} className="mt-3 text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">
                    + Aggiungi il primo lead
                  </button>
                </td>
              </tr>
            ) : filtered.map((lead, i) => (
              <tr key={lead.id} data-testid={`lead-row-${i}`}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#1C1C1F] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#6B6863] text-[11px] font-body">{lead.full_name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-[#EFEBE4] text-sm font-body font-medium">{lead.full_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-[#6B6863]">
                    <Mail size={12} strokeWidth={1.5} />
                    <span className="text-xs font-body">{lead.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[#6B6863] text-xs font-body">{TYPE_LABELS[lead.type] || lead.type}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[#A19D98] text-xs font-body">{lead.budget_range || '—'}</span>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={lead.status} /></td>
                <td className="px-5 py-3.5">
                  <span className="text-[#4A4845] text-xs font-body">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString('it-IT') : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadsPage;
