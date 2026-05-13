/**
 * LeadsPage — list, filter, create. Blueprint-driven labels via t().
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, Search, Mail, ArrowRight } from 'lucide-react';

const STATUS_TONES = {
  new: 'bg-blue-500/10 text-blue-400',
  qualified: 'bg-emerald-500/10 text-emerald-400',
  not_qualified: 'bg-red-500/10 text-red-400',
  contacted: 'bg-purple-500/10 text-purple-400',
  project_opened: 'bg-[var(--bp-primary,#D4AF37)]/10 text-[var(--bp-primary,#D4AF37)]',
  archived: 'bg-white/5 text-[#6B6863]',
};

const NewLeadModal = ({ onClose, onSaved }) => {
  const { t } = useBlueprint();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    lead_type: 'private_client', project_type: '', budget_range: '', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/leads', form);
      onSaved();
    } catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  const F = ({ k, lk, type = 'text', span = '' }) => (
    <div className={span}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t(lk)}</label>
      <input type={type} value={form[k]} onChange={set(k)} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-lead-modal">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">{t('leads.newLead')}</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F k="first_name" lk="leads.field.firstName" />
            <F k="last_name" lk="leads.field.lastName" />
            <F k="email" lk="leads.field.email" type="email" span="col-span-2" />
            <F k="phone" lk="leads.field.phone" type="tel" />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t('leads.field.leadType')}</label>
              <select value={form.lead_type} onChange={set('lead_type')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                <option value="private_client">{t('leads.type.private_client')}</option>
                <option value="ad_partner">{t('leads.type.ad_partner')}</option>
              </select>
            </div>
            <F k="project_type" lk="leads.field.projectType" />
            <F k="budget_range" lk="leads.field.budget" />
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t('leads.field.notes')}</label>
              <textarea rows={3} value={form.notes} onChange={set('notes')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03]">{t('common.cancel')}</button>
            <button data-testid="save-lead-btn" type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LeadsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [convertingId, setConvertingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/api/leads${params}`);
      setLeads(data.data || []);
    } catch { setLeads([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const convertLead = async (leadId, e) => {
    e.preventDefault(); e.stopPropagation();
    setConvertingId(leadId);
    try {
      const r = await api.post(`/api/workspace/leads/${leadId}/convert`);
      navigate(`/workspace/projects/${r.data.id}`);
    } catch (err) { alert(formatError(err)); }
    finally { setConvertingId(null); }
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const blob = `${l.first_name || ''} ${l.last_name || ''} ${l.email || ''}`.toLowerCase();
    return blob.includes(search.toLowerCase());
  });

  const tabs = ['', 'new', 'qualified', 'contacted', 'project_opened', 'archived'];

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="leads-page">
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.workspace')}</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('leads.title')}</h1>
        </div>
        <button data-testid="new-lead-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px]">
          <Plus size={14} /> {t('leads.newLead')}
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-[#141416] border border-white/[0.06] rounded-[4px] p-1">
          {tabs.map((tk) => (
            <button key={tk || 'all'} data-testid={`tab-${tk || 'all'}`} onClick={() => setStatusFilter(tk)}
              className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] ${statusFilter === tk ? 'bg-[#1C1C1F] text-[#EFEBE4]' : 'text-[#6B6863] hover:text-[#A19D98]'}`}>
              {tk ? t(`leads.status.${tk}`) : t('common.all')}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A4845]" />
          <input data-testid="leads-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')} className="input-luxury w-full pl-9 pr-4 py-2 text-sm font-body rounded-[3px]" />
        </div>
      </div>

      <div className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['leads.field.firstName', 'leads.field.email', 'leads.field.leadType', 'leads.field.budget', 'leads.field.status', 'leads.field.createdAt', 'common.actions'].map((k) => (
                <th key={k} className="text-left px-5 py-3.5 text-[10px] font-body font-bold uppercase tracking-[0.12em] text-[#4A4845]">{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-16 text-[#4A4845] text-sm font-body">{t('common.loading')}…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <p className="text-[#6B6863] text-sm font-body">{t('leads.empty')}</p>
                  <button onClick={() => setShowModal(true)} className="mt-3 text-[var(--bp-primary,#D4AF37)] text-sm font-body hover:opacity-80">
                    + {t('leads.emptyCta')}
                  </button>
                </td>
              </tr>
            ) : filtered.map((lead, i) => (
              <tr key={lead.id} data-testid={`lead-row-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#1C1C1F] border border-white/[0.06] flex items-center justify-center">
                      <span className="text-[#6B6863] text-[11px] font-body">{(lead.first_name?.[0] || lead.email?.[0] || '?').toUpperCase()}</span>
                    </div>
                    <span className="text-[#EFEBE4] text-sm font-body font-medium">{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-[#6B6863]"><Mail size={12} strokeWidth={1.5} /><span className="text-xs font-body">{lead.email || '—'}</span></div>
                </td>
                <td className="px-5 py-3.5"><span className="text-[#6B6863] text-xs font-body">{t(`leads.type.${lead.lead_type}`)}</span></td>
                <td className="px-5 py-3.5"><span className="text-[#A19D98] text-xs font-body">{lead.budget_range || '—'}</span></td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-semibold font-body ${STATUS_TONES[lead.status] || STATUS_TONES.new}`}>
                    {t(`leads.status.${lead.status}`)}
                  </span>
                </td>
                <td className="px-5 py-3.5"><span className="text-[#4A4845] text-xs font-body">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}</span></td>
                <td className="px-5 py-3.5 text-right">
                  {lead.status !== 'project_opened' && lead.status !== 'archived' && (
                    <button onClick={(e) => convertLead(lead.id, e)}
                            disabled={convertingId === lead.id}
                            data-testid={`convert-lead-${lead.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-body text-[var(--bp-primary,#D4AF37)] border border-[var(--bp-primary,#D4AF37)]/30 hover:bg-[var(--bp-primary,#D4AF37)]/10 rounded-[3px] disabled:opacity-50">
                      {convertingId === lead.id ? '…' : <>{t('workspace.lead.convert')} <ArrowRight size={11} strokeWidth={1.5} /></>}
                    </button>
                  )}
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
