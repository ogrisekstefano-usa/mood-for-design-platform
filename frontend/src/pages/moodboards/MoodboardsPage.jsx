import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { Plus, Layers, Grid3X3 } from 'lucide-react';

const THUMB_IMGS = [
  'https://images.unsplash.com/photo-1749766878223-6ceae855b28b?w=400&q=70',
  'https://images.unsplash.com/photo-1765767056681-9583b29007cf?w=400&q=70',
  'https://images.unsplash.com/photo-1777604602765-1d5114114891?w=400&q=70',
];

const NewMoodboardModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/api/moodboards', form); onSave(); }
    catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-md animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">Nuovo Moodboard</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Titolo</label>
            <input required value={form.title} onChange={set('title')} placeholder="es. Moodboard Villa Como"
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Descrizione</label>
            <textarea rows={2} value={form.description} onChange={set('description')}
              className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Annulla</button>
            <button type="submit" disabled={loading} data-testid="save-moodboard-btn"
              className="flex-1 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? 'Creazione...' : 'Crea Moodboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MoodboardsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/moodboards'); setItems(data.data || []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="moodboards-page">
      {showModal && <NewMoodboardModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Content</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Moodboards</h1>
        </div>
        <button data-testid="new-moodboard-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuovo Moodboard
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-56 bg-[#141416] border border-white/[0.06] rounded-md skeleton" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Layers size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body mb-2">Nessun moodboard</p>
          <p className="text-[#4A4845] text-xs font-body mb-4 max-w-xs mx-auto">
            Crea moodboard visivi per le tue proposte di progetto
          </p>
          <button onClick={() => setShowModal(true)} className="text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">+ Crea il primo moodboard</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((mb, i) => (
            <div key={mb.id} data-testid={`moodboard-card-${i}`}
              className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden cursor-pointer card-hover group">
              <div className="h-44 overflow-hidden">
                <img src={THUMB_IMGS[i % THUMB_IMGS.length]} alt={mb.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading text-lg text-[#EFEBE4] mb-0.5">{mb.title}</h3>
                    {mb.description && <p className="text-[#6B6863] text-xs font-body line-clamp-1">{mb.description}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] mt-0.5 ${
                    mb.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-[#6B6863]'
                  }`}>{mb.status}</span>
                </div>
                <p className="text-[#3A3835] text-[10px] font-body mt-3">
                  {mb.created_at ? new Date(mb.created_at).toLocaleDateString('it-IT') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoodboardsPage;
