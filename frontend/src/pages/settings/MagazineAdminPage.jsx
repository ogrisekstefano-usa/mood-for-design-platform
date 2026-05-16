// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Magazine admin list (Phase Y.2)
// Tenant journal authoring · OS surface · cinematic editorial tooling
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, FileText, ExternalLink, Trash2, Eye, Globe } from 'lucide-react';
import api from '../../lib/api';

const slugify = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);

const StatusPill = ({ status }) => {
  const cls = status === 'published'
    ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10'
    : status === 'archived'
      ? 'border-zinc-500/40 text-zinc-400 bg-zinc-500/10'
      : 'border-amber-400/40 text-amber-300 bg-amber-400/10';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border text-[9px] uppercase tracking-[0.22em] ${cls}`} data-testid={`status-${status}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
};

const MagazineAdminPage = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, articles: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', category: 'residential' });
  const [busy, setBusy] = useState(false);

  const fetchAll = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await api.get('/api/magazine/admin/articles');
      setState({ loading: false, articles: r.data?.articles || [] });
    } catch (_) {
      setState({ loading: false, articles: [] });
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    const slug = form.slug || slugify(form.title);
    setBusy(true);
    try {
      const r = await api.post('/api/magazine/admin/articles', {
        slug,
        locale_content: {
          it: { title: form.title, kicker: 'Editoriale', summary: '', category_label: form.category },
        },
        body_blocks: [
          { id: 'blk_hero', type: 'hero', image_url: '', alt: '',
            locale_content: { it: { caption: '' } } },
          { id: 'blk_intro', type: 'paragraph',
            locale_content: { it: { text: 'Scrivi qui l\'introduzione editoriale del progetto.' } } },
        ],
        category_slug: form.category,
        tags: [], default_locale: 'it', scope: 'tenant',
      });
      setShowCreate(false);
      setForm({ title: '', slug: '', category: 'residential' });
      navigate(`/settings/magazine/${r.data.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare definitivamente questo articolo?')) return;
    await api.delete(`/api/magazine/admin/articles/${id}`);
    fetchAll();
  };

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto" data-testid="magazine-admin-page">
      <header className="flex items-end justify-between mb-10 pb-6 border-b border-[var(--bp-border)]">
        <div>
          <p className="text-[10px] font-body uppercase tracking-[0.3em] text-[var(--bp-primary)] mb-2">EDITORIAL JOURNAL</p>
          <h1 className="font-heading text-3xl text-[var(--bp-text-primary)] font-light leading-tight">Magazine & Design References™</h1>
          <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2 max-w-xl">
            Cura articoli editoriali con Design References™ che trasformano ispirazione in conversazioni progettuali.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          data-testid="magazine-create-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--bp-primary)] text-white text-[10px] font-body uppercase tracking-[0.22em] hover:bg-[var(--bp-primary-hover)] transition-colors"
        >
          <Plus size={13} strokeWidth={1.6} /> New article
        </button>
      </header>

      {state.loading && <p className="text-[var(--bp-text-muted)] text-sm italic">Caricamento…</p>}

      {!state.loading && state.articles.length === 0 && (
        <div className="text-center py-20 max-w-md mx-auto" data-testid="magazine-empty">
          <BookOpen size={42} strokeWidth={1} className="mx-auto text-[var(--bp-text-muted)] mb-4 opacity-50" />
          <p className="font-heading text-2xl font-light text-[var(--bp-text-primary)] mb-3">Nessun articolo ancora.</p>
          <p className="text-[var(--bp-text-muted)] text-sm font-body leading-relaxed">
            Cura il primo articolo editoriale e trasformalo in una conversazione progettuale con i tuoi clienti.
          </p>
        </div>
      )}

      {state.articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="magazine-list">
          {state.articles.map((a) => {
            const lc = a.locale_content?.it || a.locale_content?.['en-US'] || Object.values(a.locale_content || {})[0] || {};
            return (
              <article key={a.id} className="group bg-[var(--bp-surface)] border border-[var(--bp-border)] hover:border-[var(--bp-primary)]/40 transition-colors" data-testid={`magazine-card-${a.id}`}>
                <Link to={`/settings/magazine/${a.id}`} className="block">
                  <div className="aspect-[16/10] bg-[var(--bp-surface-2)] overflow-hidden">
                    {(a.cover_url || a.hero_url) ? (
                      <img src={a.cover_url || a.hero_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={32} strokeWidth={1} className="text-[var(--bp-text-muted)] opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill status={a.status} />
                      {a.category_slug && (
                        <span className="text-[9px] text-[var(--bp-text-muted)] uppercase tracking-[0.22em]">· {a.category_slug}</span>
                      )}
                    </div>
                    <h3 className="font-heading text-lg text-[var(--bp-text-primary)] leading-snug mb-1">{lc.title || '(untitled)'}</h3>
                    <p className="text-[var(--bp-text-muted)] text-xs font-body line-clamp-2">{lc.summary || lc.kicker}</p>
                  </div>
                </Link>
                <footer className="flex items-center justify-between px-4 pb-4 pt-1 border-t border-[var(--bp-border)]/40 mt-2">
                  <p className="text-[9px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)]">
                    {a.view_count || 0} views · {a.save_count || 0} saves
                  </p>
                  <div className="flex items-center gap-1.5">
                    {a.status === 'published' && (
                      <a href={`/magazine/${a.slug}`} target="_blank" rel="noreferrer"
                         className="p-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]"
                         title="Open public page" data-testid={`magazine-view-${a.id}`}>
                        <ExternalLink size={12} strokeWidth={1.6} />
                      </a>
                    )}
                    <button type="button" onClick={() => handleDelete(a.id)}
                            className="p-1.5 text-[var(--bp-text-muted)] hover:text-rose-400"
                            title="Delete" data-testid={`magazine-delete-${a.id}`}>
                      <Trash2 size={12} strokeWidth={1.6} />
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6" data-testid="magazine-create-modal">
          <form onSubmit={handleCreate} className="bg-[var(--bp-surface)] border border-[var(--bp-border)] w-full max-w-md p-7 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--bp-primary)] mb-2">NEW EDITORIAL</p>
            <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] font-light mb-5">Inizia un nuovo articolo</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] block mb-1.5">Titolo</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })}
                       required autoFocus data-testid="magazine-create-title"
                       className="w-full px-3 py-2 bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] block mb-1.5">Slug URL</label>
                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                       placeholder="es. casa-vista-mare-ligure" data-testid="magazine-create-slug"
                       className="w-full px-3 py-2 bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)] text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] block mb-1.5">Categoria</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                        data-testid="magazine-create-category"
                        className="w-full px-3 py-2 bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)] text-sm">
                  <option value="residential">Residenza</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="commercial">Commerciale</option>
                  <option value="other">Altro</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowCreate(false)}
                      className="px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
                      data-testid="magazine-create-cancel">
                Annulla
              </button>
              <button type="submit" disabled={busy || !form.title}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--bp-primary)] text-white text-[10px] uppercase tracking-[0.22em] hover:bg-[var(--bp-primary-hover)] disabled:opacity-50"
                      data-testid="magazine-create-confirm">
                <Plus size={12} strokeWidth={1.6} /> {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MagazineAdminPage;
