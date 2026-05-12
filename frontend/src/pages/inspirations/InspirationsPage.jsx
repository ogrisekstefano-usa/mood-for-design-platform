import React, { useState, useEffect } from 'react';
import api, { formatError } from '../../lib/api';
import { Plus, BookOpen, Globe } from 'lucide-react';

const STATUS_CONFIG = {
  draft: { label: 'Bozza', bg: 'bg-white/5', text: 'text-[#6B6863]' },
  published: { label: 'Pubblicato', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  archived: { label: 'Archiviato', bg: 'bg-white/5', text: 'text-[#4A4845]' },
};

const NewArticleModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ title: '', slug: '', excerpt: '', language: 'it', category: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => {
    const value = e.target.value;
    setForm(p => ({
      ...p,
      [k]: value,
      ...(k === 'title' ? { slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/api/inspirations', form); onSave(); }
    catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-md animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">Nuovo Articolo</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Titolo</label>
            <input required value={form.title} onChange={set('title')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Slug URL</label>
            <input required value={form.slug} onChange={set('slug')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] font-mono text-[#D4AF37]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Lingua</label>
              <select value={form.language} onChange={set('language')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                <option value="it">Italiano</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Categoria</label>
              <input value={form.category} onChange={set('category')} placeholder="es. Design" className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Excerpt</label>
            <textarea rows={2} value={form.excerpt} onChange={set('excerpt')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Annulla</button>
            <button type="submit" disabled={loading} data-testid="save-article-btn"
              className="flex-1 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? 'Creazione...' : 'Crea Articolo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ARTICLE_IMG = 'https://images.unsplash.com/photo-1760385737098-0b555a75b2ba?w=600&q=70';

const InspirationsPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/inspirations'); setArticles(data.data || []); }
    catch { setArticles([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="inspirations-page">
      {showModal && <NewArticleModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Content</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Inspirations</h1>
          <p className="text-[#4A4845] text-sm font-body mt-1">Magazine editoriale — CMS integrato</p>
        </div>
        <button data-testid="new-article-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuovo Articolo
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-[#141416] border border-white/[0.06] rounded-md skeleton" />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body mb-2">Nessun articolo</p>
          <p className="text-[#4A4845] text-xs font-body mb-4">Pubblica contenuti editoriali per il tuo magazine</p>
          <button onClick={() => setShowModal(true)} className="text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">+ Crea il primo articolo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a, i) => {
            const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.draft;
            return (
              <div key={a.id} data-testid={`article-card-${i}`}
                className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden card-hover group cursor-pointer">
                <div className="h-44 overflow-hidden relative">
                  <img src={a.main_photo_url || ARTICLE_IMG} alt={a.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141416]/80 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] ${sc.bg} ${sc.text}`}>{sc.label}</span>
                    <span className="text-[10px] font-body px-2 py-0.5 rounded-[3px] bg-white/5 text-[#6B6863] flex items-center gap-1">
                      <Globe size={9} />{a.language?.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {a.category && <p className="text-[10px] font-bold font-body uppercase tracking-[0.15em] text-[#D4AF37] mb-1">{a.category}</p>}
                  <h3 className="font-heading text-lg text-[#EFEBE4] leading-tight mb-1">{a.title}</h3>
                  {a.excerpt && <p className="text-[#6B6863] text-xs font-body line-clamp-2 leading-relaxed">{a.excerpt}</p>}
                  <p className="text-[#3A3835] text-[10px] font-body mt-3">/{a.slug}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InspirationsPage;
