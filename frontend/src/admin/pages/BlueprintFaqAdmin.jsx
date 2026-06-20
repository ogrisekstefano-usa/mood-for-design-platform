/**
 * BlueprintFaqAdmin — manage FAQ categories & items, no code edits needed.
 *
 * - Create / edit / delete / reorder categories
 * - Create / edit / delete / reorder items inside a category
 * - Edit `title`, `description`, `question`, `answer` per locale tab
 * - Hero + final CTA + SEO of the public /faq page live in a cms_section
 *   (section_type='faq_page') and are edited from the Pages editor:
 *   we provide a deep-link button to that section.
 *
 * NO hardcoded list of categories, NO hardcoded translations.
 * Locales come from the LocaleProvider (database-managed).
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2, Save, EyeOff, Eye, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
  'X-Tenant-Slug': localStorage.getItem('mood_tenant_slug') || 'studio',
});

const api = axios.create({ baseURL: `${BACKEND}/api/admin/site/faq` });

// ── Small editor for one localized object: { "it-IT": {...}, "en-US": {...} }
const LocalizedField = ({ value, onChange, locales, fields, testIdRoot }) => {
  const [active, setActive] = useState(locales[0]?.code || 'it-IT');
  const v = (value && value[active]) || {};
  const set = (k, val) => {
    onChange({ ...(value || {}), [active]: { ...v, [k]: val } });
  };
  return (
    <div className="border border-stone-200 rounded">
      <div className="flex flex-wrap gap-px bg-stone-200 border-b border-stone-200">
        {locales.map((l) => (
          <button key={l.code} onClick={() => setActive(l.code)}
                  data-testid={`${testIdRoot}-loc-${l.code}`}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${
                    active === l.code
                      ? 'bg-white text-stone-900'
                      : 'bg-stone-50 text-stone-500 hover:text-stone-700'
                  }`}>
            {l.code}
          </button>
        ))}
      </div>
      <div className="p-3 space-y-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">
              {f.label}
            </label>
            {f.multiline ? (
              <textarea rows={f.rows || 4}
                        value={v[f.key] || ''}
                        onChange={(e) => set(f.key, e.target.value)}
                        data-testid={`${testIdRoot}-${f.key}`}
                        className="w-full border border-stone-200 px-2 py-1.5 text-[13px]" />
            ) : (
              <input value={v[f.key] || ''}
                     onChange={(e) => set(f.key, e.target.value)}
                     data-testid={`${testIdRoot}-${f.key}`}
                     className="w-full border border-stone-200 px-2 py-1.5 text-[13px]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const FieldGroup = ({ title, children }) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-2">{title}</p>
    {children}
  </div>
);

const ConfirmButton = ({ onConfirm, children, testid }) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button onClick={() => armed ? onConfirm() : setArmed(true)}
            data-testid={testid}
            className={`text-[11px] uppercase tracking-wider px-2 py-1 border transition-colors ${
              armed ? 'border-red-400 text-red-600 bg-red-50' : 'border-stone-300 text-stone-500 hover:text-stone-900'
            }`}>
      {armed ? 'Conferma' : children}
    </button>
  );
};

const CategoryRow = ({
  cat, items, locales, isOpen, onToggle, onMove, onSave, onDelete, onCreateItem, refreshItems,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat);

  useEffect(() => { setDraft(cat); }, [cat.id]);

  const save = async () => {
    await api.patch(`/categories/${cat.id}`, {
      slug:           draft.slug,
      sort_order:     draft.sort_order,
      visible:        draft.visible,
      locale_content: draft.locale_content || {},
    }, { headers: headers() });
    setEditing(false);
    onSave();
  };

  return (
    <div className="border border-stone-200 rounded mb-3 bg-white" data-testid={`faq-cat-${cat.id}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100">
        <button onClick={onToggle} className="text-stone-400 hover:text-stone-900"
                data-testid={`faq-cat-toggle-${cat.id}`}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex-1 flex items-baseline gap-2 min-w-0">
          <code className="text-[11px] text-stone-500 tabular-nums">{cat.slug}</code>
          <span className="text-[13px] text-stone-900 truncate">
            {(cat.locale_content?.[locales[0].code]?.title) || (cat.locale_content?.['it-IT']?.title) || '—'}
          </span>
          <span className="text-[10px] text-stone-400">· #{cat.sort_order}</span>
          {!cat.visible && (
            <span className="text-[9px] uppercase tracking-wider text-stone-400 inline-flex items-center gap-1">
              <EyeOff size={10} /> hidden
            </span>
          )}
          <span className="text-[10px] text-stone-400 tabular-nums">· {items.length} items</span>
        </div>
        <button onClick={() => onMove(-1)} className="text-stone-400 hover:text-stone-900"
                data-testid={`faq-cat-up-${cat.id}`}><ChevronUp size={14} /></button>
        <button onClick={() => onMove(1)}  className="text-stone-400 hover:text-stone-900"
                data-testid={`faq-cat-down-${cat.id}`}><ChevronDown size={14} /></button>
        <button onClick={() => setEditing((v) => !v)}
                data-testid={`faq-cat-edit-${cat.id}`}
                className="text-[11px] uppercase tracking-wider px-2 py-1 border border-stone-300 hover:bg-stone-50">
          <Edit2 size={11} className="inline" />
        </button>
        <ConfirmButton onConfirm={onDelete} testid={`faq-cat-delete-${cat.id}`}>
          <Trash2 size={11} className="inline" />
        </ConfirmButton>
      </div>

      {editing && (
        <div className="px-3 py-3 bg-stone-50 border-b border-stone-100 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[11px] uppercase tracking-wider text-stone-500">Slug</label>
            <input value={draft.slug}
                   onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                   data-testid={`faq-cat-slug-${cat.id}`}
                   className="border border-stone-200 px-2 py-1 text-[13px] tabular-nums w-40" />
            <label className="text-[11px] uppercase tracking-wider text-stone-500 ml-3">Sort</label>
            <input type="number" value={draft.sort_order}
                   onChange={(e) => setDraft({ ...draft, sort_order: parseInt(e.target.value) || 0 })}
                   className="border border-stone-200 px-2 py-1 text-[13px] w-20" />
            <label className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-stone-500 ml-3">
              <input type="checkbox" checked={draft.visible}
                     onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
              Visible
            </label>
            <button onClick={save} data-testid={`faq-cat-save-${cat.id}`}
                    className="ml-auto px-3 py-1.5 bg-black text-white text-[11px] uppercase tracking-wider">
              <Save size={11} className="inline mr-1" /> Salva
            </button>
          </div>
          <LocalizedField
            value={draft.locale_content}
            onChange={(lc) => setDraft({ ...draft, locale_content: lc })}
            locales={locales}
            fields={[
              { key: 'title',       label: 'Title' },
              { key: 'description', label: 'Description', multiline: true, rows: 2 },
            ]}
            testIdRoot={`faq-cat-${cat.id}`}
          />
        </div>
      )}

      {isOpen && (
        <div className="px-3 py-3 space-y-2">
          {items.length === 0 && (
            <p className="text-[12px] text-stone-400">Nessuna domanda. Aggiungine una.</p>
          )}
          {items.map((it, idx) => (
            <ItemRow
              key={it.id}
              item={it}
              locales={locales}
              onMove={(delta) => onMoveItem(items, idx, delta, refreshItems)}
              onSave={refreshItems}
              onDelete={async () => {
                await api.delete(`/items/${it.id}`, { headers: headers() });
                refreshItems();
              }}
            />
          ))}
          <button onClick={onCreateItem}
                  data-testid={`faq-cat-add-item-${cat.id}`}
                  className="text-[11px] uppercase tracking-wider text-[#00C9B3] hover:underline">
            <Plus size={11} className="inline mr-1" />Nuova domanda
          </button>
        </div>
      )}
    </div>
  );
};

const onMoveItem = async (items, idx, delta, refresh) => {
  const target = idx + delta;
  if (target < 0 || target >= items.length) return;
  const a = items[idx], b = items[target];
  await api.post('/items/reorder', {
    entries: [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ],
  }, { headers: headers() });
  refresh();
};

const ItemRow = ({ item, locales, onMove, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  useEffect(() => { setDraft(item); }, [item.id]);

  const save = async () => {
    await api.patch(`/items/${item.id}`, {
      category_id:    draft.category_id,
      sort_order:     draft.sort_order,
      visible:        draft.visible,
      locale_content: draft.locale_content || {},
    }, { headers: headers() });
    setEditing(false);
    onSave();
  };

  const peek = item.locale_content?.[locales[0].code]?.question
           || item.locale_content?.['it-IT']?.question
           || '—';

  return (
    <div className="border border-stone-200 rounded bg-white" data-testid={`faq-item-${item.id}`}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="text-[10px] text-stone-400 tabular-nums w-6">#{item.sort_order}</span>
        <span className="flex-1 text-[13px] truncate">{peek}</span>
        {!item.visible && (
          <span className="text-[9px] uppercase tracking-wider text-stone-400 inline-flex items-center gap-1">
            <EyeOff size={10} /> hidden
          </span>
        )}
        <button onClick={() => onMove(-1)} className="text-stone-400 hover:text-stone-900"><ChevronUp size={13} /></button>
        <button onClick={() => onMove(1)}  className="text-stone-400 hover:text-stone-900"><ChevronDown size={13} /></button>
        <button onClick={() => setEditing((v) => !v)} className="text-stone-400 hover:text-stone-900"
                data-testid={`faq-item-edit-${item.id}`}><Edit2 size={12} /></button>
        <ConfirmButton onConfirm={onDelete} testid={`faq-item-delete-${item.id}`}>
          <Trash2 size={11} className="inline" />
        </ConfirmButton>
      </div>
      {editing && (
        <div className="px-2.5 pb-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[11px] uppercase tracking-wider text-stone-500">Sort</label>
            <input type="number" value={draft.sort_order}
                   onChange={(e) => setDraft({ ...draft, sort_order: parseInt(e.target.value) || 0 })}
                   className="border border-stone-200 px-2 py-1 text-[13px] w-20" />
            <label className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-stone-500 ml-3">
              <input type="checkbox" checked={draft.visible}
                     onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
              Visible
            </label>
            <button onClick={save} data-testid={`faq-item-save-${item.id}`}
                    className="ml-auto px-3 py-1.5 bg-black text-white text-[11px] uppercase tracking-wider">
              <Save size={11} className="inline mr-1" /> Salva
            </button>
          </div>
          <LocalizedField
            value={draft.locale_content}
            onChange={(lc) => setDraft({ ...draft, locale_content: lc })}
            locales={locales}
            fields={[
              { key: 'question', label: 'Question' },
              { key: 'answer',   label: 'Answer', multiline: true, rows: 6 },
            ]}
            testIdRoot={`faq-item-${item.id}`}
          />
        </div>
      )}
    </div>
  );
};

const BlueprintFaqAdmin = () => {
  const { locales: availableLocales } = useLocale();
  const locales = useMemo(
    () => (availableLocales && availableLocales.length
      ? availableLocales.map((l) => ({ code: l.code || l.locale || l }))
      : [{ code: 'it-IT' }, { code: 'en-US' }]),
    [availableLocales],
  );

  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [openIds, setOpenIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [pageOpen, setPageOpen] = useState(false);
  const [pageLc, setPageLc] = useState({});
  const [pageDirty, setPageDirty] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageSaved, setPageSaved] = useState(false);

  const refresh = async () => {
    const [cR, iR, pR] = await Promise.all([
      api.get('/categories', { headers: headers() }),
      api.get('/items',      { headers: headers() }),
      api.get('/page',       { headers: headers() }),
    ]);
    setCats(cR.data.categories || []);
    setItems(iR.data.items || []);
    setPageLc(pR.data.locale_content || {});
    setPageDirty(false);
  };

  useEffect(() => { refresh(); }, []);

  const savePage = async () => {
    setPageSaving(true); setPageSaved(false);
    try {
      await api.put('/page', { locale_content: pageLc }, { headers: headers() });
      setPageDirty(false);
      setPageSaved(true);
      setTimeout(() => setPageSaved(false), 2500);
    } catch (e) {
      window.alert('Errore salvataggio pagina FAQ: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setPageSaving(false);
    }
  };

  const itemsByCat = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      if (!m.has(it.category_id)) m.set(it.category_id, []);
      m.get(it.category_id).push(it);
    }
    for (const list of m.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [items]);

  const createCategory = async () => {
    if (!newSlug.trim()) return;
    await api.post('/categories', {
      slug:           newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      sort_order:     (cats[cats.length - 1]?.sort_order || 0) + 10,
      visible:        true,
      locale_content: {},
    }, { headers: headers() });
    setNewSlug('');
    setCreating(false);
    await refresh();
  };

  const moveCategory = async (cat, delta) => {
    const idx = cats.findIndex((c) => c.id === cat.id);
    const target = idx + delta;
    if (target < 0 || target >= cats.length) return;
    const a = cats[idx], b = cats[target];
    await api.post('/categories/reorder', {
      entries: [
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ],
    }, { headers: headers() });
    refresh();
  };

  const createItem = async (catId) => {
    const last = (itemsByCat.get(catId) || []).slice(-1)[0];
    await api.post('/items', {
      category_id:    catId,
      sort_order:     (last?.sort_order || 0) + 10,
      visible:        true,
      locale_content: {},
    }, { headers: headers() });
    setOpenIds((s) => new Set([...s, catId]));
    refresh();
  };

  return (
    <div data-testid="blueprint-faq-admin" className="p-8 max-w-[1100px] mx-auto">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl tracking-tight" style={{ fontWeight: 500 }}>FAQ</h1>
          <p className="text-[12px] text-stone-500 mt-1">
            Gestisci categorie, domande e tutti i contenuti della pagina <code>/faq</code>.
          </p>
        </div>
        <div className="text-[11px] text-stone-400 max-w-md text-right">
          Per aggiungere il link <code>/faq</code> al menu o al footer, usa
          rispettivamente <code>Pagine → navigation</code> e <code>Footer</code>.
          Nessun link è cablato nel codice.
        </div>
      </header>

      {/* PAGE SETTINGS — Hero · Final CTA · SEO, all from cms_sections.faq_page */}
      <section data-testid="faq-page-settings"
               className="mb-6 border border-stone-200 bg-white rounded">
        <button onClick={() => setPageOpen((v) => !v)}
                data-testid="faq-page-settings-toggle"
                className="w-full px-4 py-3 flex items-center gap-3 text-left">
          <span className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Impostazioni Pagina
          </span>
          <span className="text-[13px] text-stone-900">Hero · CTA finale · SEO</span>
          {pageDirty && <span className="text-[10px] text-amber-600">● non salvato</span>}
          {pageSaved && <span className="text-[10px] text-emerald-600">✓ salvato</span>}
          <span className="ml-auto text-stone-400">
            {pageOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {pageOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-stone-100">
            <p className="text-[11px] text-stone-500 leading-relaxed pt-3">
              Tutti i campi sono per lingua. Le lingue disponibili sono lette dal sistema
              i18n della piattaforma. Lascia vuoto un campo per nasconderne il rendering
              pubblico.
            </p>

            <FieldGroup title="Hero">
              <LocalizedField
                value={pageLc}
                onChange={(lc) => { setPageLc(lc); setPageDirty(true); }}
                locales={locales}
                fields={[
                  { key: 'hero_eyebrow',           label: 'Hero · Eyebrow' },
                  { key: 'hero_title',             label: 'Hero · Title' },
                  { key: 'hero_body',              label: 'Hero · Body', multiline: true, rows: 3 },
                  { key: 'hero_primary_cta_label', label: 'Hero · CTA Label' },
                  { key: 'hero_primary_cta_url',   label: 'Hero · CTA URL' },
                  { key: 'search_placeholder',     label: 'Search · Placeholder' },
                ]}
                testIdRoot="faq-page-hero"
              />
            </FieldGroup>

            <FieldGroup title="Final CTA">
              <LocalizedField
                value={pageLc}
                onChange={(lc) => { setPageLc(lc); setPageDirty(true); }}
                locales={locales}
                fields={[
                  { key: 'final_cta_eyebrow',         label: 'Eyebrow' },
                  { key: 'final_cta_title',           label: 'Title' },
                  { key: 'final_cta_body',            label: 'Body', multiline: true, rows: 3 },
                  { key: 'final_cta_primary_label',   label: 'Primary · Label' },
                  { key: 'final_cta_primary_url',     label: 'Primary · URL' },
                  { key: 'final_cta_secondary_label', label: 'Secondary · Label' },
                  { key: 'final_cta_secondary_url',   label: 'Secondary · URL' },
                ]}
                testIdRoot="faq-page-finalcta"
              />
            </FieldGroup>

            <FieldGroup title="SEO">
              <LocalizedField
                value={pageLc}
                onChange={(lc) => { setPageLc(lc); setPageDirty(true); }}
                locales={locales}
                fields={[
                  { key: 'seo_title',       label: 'SEO · Title' },
                  { key: 'seo_description', label: 'SEO · Description', multiline: true, rows: 2 },
                ]}
                testIdRoot="faq-page-seo"
              />
            </FieldGroup>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={savePage}
                      disabled={!pageDirty || pageSaving}
                      data-testid="faq-page-save"
                      className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${
                        (!pageDirty || pageSaving)
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                          : 'bg-black text-white hover:bg-stone-800'
                      }`}>
                {pageSaving ? 'Salvataggio…' : 'Salva pagina'}
              </button>
              {pageDirty && (
                <span className="text-[11px] text-amber-600">Modifiche non salvate</span>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="mb-4">
        {creating ? (
          <div className="flex items-center gap-2 bg-white border border-stone-300 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-stone-500">Slug</span>
            <input autoFocus value={newSlug}
                   onChange={(e) => setNewSlug(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                   data-testid="faq-new-cat-slug"
                   placeholder="es. blueprint"
                   className="flex-1 border-0 text-[13px] outline-none tabular-nums" />
            <button onClick={createCategory}
                    data-testid="faq-new-cat-confirm"
                    className="text-[11px] uppercase tracking-wider px-3 py-1 bg-black text-white">Crea</button>
            <button onClick={() => setCreating(false)} className="text-stone-400 hover:text-stone-900">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
                  data-testid="faq-new-cat-btn"
                  className="text-[11px] uppercase tracking-wider px-3 py-1.5 border border-stone-300 hover:bg-stone-50">
            <Plus size={11} className="inline mr-1" />Nuova categoria
          </button>
        )}
      </div>

      {cats.length === 0 && (
        <div data-testid="faq-admin-empty" className="text-center py-16 text-stone-400 text-[13px]">
          Nessuna categoria. Crea la prima.
        </div>
      )}

      {cats.map((cat) => (
        <CategoryRow
          key={cat.id}
          cat={cat}
          items={itemsByCat.get(cat.id) || []}
          locales={locales}
          isOpen={openIds.has(cat.id)}
          onToggle={() => setOpenIds((s) => {
            const n = new Set(s);
            if (n.has(cat.id)) n.delete(cat.id); else n.add(cat.id);
            return n;
          })}
          onMove={(d) => moveCategory(cat, d)}
          onSave={refresh}
          onDelete={async () => {
            await api.delete(`/categories/${cat.id}`, { headers: headers() });
            refresh();
          }}
          onCreateItem={() => createItem(cat.id)}
          refreshItems={refresh}
        />
      ))}
    </div>
  );
};

export default BlueprintFaqAdmin;
