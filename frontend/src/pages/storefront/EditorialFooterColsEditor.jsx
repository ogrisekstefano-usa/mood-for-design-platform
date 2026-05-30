/**
 * EditorialFooterColsEditor — visual structured editor for footer columns.
 *
 * NO JSON, no code. Pure click-and-type UI:
 *   - "+ Aggiungi colonna"  → adds a new column
 *   - per column: rename · move up/down · delete
 *   - per column: list of links → add link, edit href/label, delete link
 *
 * Storage shape (per-locale, lives in section.locale_content[locale].cols):
 *   [
 *     {
 *       title: "Azienda",
 *       links: [
 *         { href: "/about", label: "Chi siamo" },
 *         { href: "/contact", label: "Contatti" },
 *       ],
 *     },
 *     ...
 *   ]
 *
 * NB: Each locale stores its OWN translated cols. The admin switches
 * locale via the existing IT / EN-US / EN-UK / FR / DE / ES tabs.
 */
import React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

const NEW_COL  = () => ({ title: 'Nuova colonna', links: [] });
const NEW_LINK = () => ({ href: '/', label: 'Nuovo link' });

const EditorialFooterColsEditor = ({ section, activeLocale, onSaveLocaleContent }) => {
  // Resolve the per-locale `cols` array from locale_content.
  const lc = section?.locale_content || {};
  // Locale resolution: prefer exact match, then short form, then _default.
  const localeKey = (() => {
    if (lc[activeLocale]) return activeLocale;
    const short = (activeLocale || '').slice(0, 2);
    if (short && lc[short]) return short;
    if (lc._default) return '_default';
    return activeLocale; // create new key if needed
  })();

  const cols = Array.isArray(lc[localeKey]?.cols) ? lc[localeKey].cols : [];

  // Persist by overwriting cols for the active locale.
  const persist = (nextCols) => {
    const nextLc = { ...lc };
    nextLc[localeKey] = { ...(nextLc[localeKey] || {}), cols: nextCols };
    onSaveLocaleContent(nextLc);
  };

  const addCol = () => persist([...cols, NEW_COL()]);
  const renameCol = (i, title) => {
    const next = [...cols]; next[i] = { ...next[i], title }; persist(next);
  };
  const deleteCol = (i) => {
    if (!window.confirm('Eliminare questa colonna?')) return;
    persist(cols.filter((_, j) => j !== i));
  };
  const moveCol = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    const next = [...cols]; [next[i], next[j]] = [next[j], next[i]]; persist(next);
  };

  const addLink = (ci) => {
    const next = [...cols];
    next[ci] = { ...next[ci], links: [...(next[ci].links || []), NEW_LINK()] };
    persist(next);
  };
  const updateLink = (ci, li, field, value) => {
    const next = [...cols];
    const links = [...(next[ci].links || [])];
    links[li] = { ...links[li], [field]: value };
    next[ci] = { ...next[ci], links };
    persist(next);
  };
  const deleteLink = (ci, li) => {
    const next = [...cols];
    next[ci] = { ...next[ci], links: (next[ci].links || []).filter((_, k) => k !== li) };
    persist(next);
  };
  const moveLink = (ci, li, dir) => {
    const lj = li + dir;
    const links = [...(cols[ci].links || [])];
    if (lj < 0 || lj >= links.length) return;
    [links[li], links[lj]] = [links[lj], links[li]];
    const next = [...cols]; next[ci] = { ...next[ci], links }; persist(next);
  };

  return (
    <div className="pa-cols-editor" data-testid="editorial-footer-cols-editor">
      <div className="pa-cols-editor__head">
        <span className="pa-cols-editor__eyebrow">COLONNE FOOTER · {activeLocale.toUpperCase()}</span>
        <span className="pa-cols-editor__hint">
          {cols.length === 0
            ? 'Nessuna colonna. Aggiungi la prima.'
            : `${cols.length} colonn${cols.length === 1 ? 'a' : 'e'} · le modifiche si salvano automaticamente.`}
        </span>
        <button
          type="button"
          className="pa-cols-editor__add-col"
          onClick={addCol}
          data-testid="cols-editor-add-col">
          <Plus size={13} /> Aggiungi colonna
        </button>
      </div>

      {cols.map((col, ci) => (
        <article key={ci} className="pa-cols-editor__col" data-testid={`cols-editor-col-${ci}`}>
          <header className="pa-cols-editor__col-head">
            <span className="pa-grip" aria-hidden><GripVertical size={12} /></span>
            <input
              type="text"
              className="pa-cols-editor__col-title"
              value={col.title || ''}
              onChange={(e) => renameCol(ci, e.target.value)}
              placeholder="Titolo colonna (es. Azienda)"
              data-testid={`cols-editor-col-title-${ci}`}
            />
            <button type="button" className="pa-cols-editor__icon-btn"
              title="Sposta su" onClick={() => moveCol(ci, -1)} disabled={ci === 0}>
              <ChevronUp size={14} />
            </button>
            <button type="button" className="pa-cols-editor__icon-btn"
              title="Sposta giù" onClick={() => moveCol(ci, +1)} disabled={ci === cols.length - 1}>
              <ChevronDown size={14} />
            </button>
            <button type="button" className="pa-cols-editor__icon-btn pa-cols-editor__icon-btn--danger"
              title="Elimina colonna" onClick={() => deleteCol(ci)}
              data-testid={`cols-editor-delete-col-${ci}`}>
              <Trash2 size={13} />
            </button>
          </header>

          <ul className="pa-cols-editor__links">
            {(col.links || []).map((link, li) => (
              <li key={li} className="pa-cols-editor__link">
                <input
                  type="text"
                  className="pa-cols-editor__link-label"
                  value={link.label || ''}
                  onChange={(e) => updateLink(ci, li, 'label', e.target.value)}
                  placeholder="Etichetta (es. Chi siamo)"
                  data-testid={`cols-editor-link-label-${ci}-${li}`}
                />
                <input
                  type="text"
                  className="pa-cols-editor__link-href"
                  value={link.href || ''}
                  onChange={(e) => updateLink(ci, li, 'href', e.target.value)}
                  placeholder="URL o /percorso"
                  data-testid={`cols-editor-link-href-${ci}-${li}`}
                />
                <button type="button" className="pa-cols-editor__icon-btn"
                  title="Sposta su" onClick={() => moveLink(ci, li, -1)} disabled={li === 0}>
                  <ChevronUp size={12} />
                </button>
                <button type="button" className="pa-cols-editor__icon-btn"
                  title="Sposta giù" onClick={() => moveLink(ci, li, +1)} disabled={li === (col.links || []).length - 1}>
                  <ChevronDown size={12} />
                </button>
                <button type="button" className="pa-cols-editor__icon-btn pa-cols-editor__icon-btn--danger"
                  title="Elimina link" onClick={() => deleteLink(ci, li)}>
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="pa-cols-editor__add-link"
            onClick={() => addLink(ci)}
            data-testid={`cols-editor-add-link-${ci}`}>
            <Plus size={11} /> Aggiungi link
          </button>
        </article>
      ))}
    </div>
  );
};

export default EditorialFooterColsEditor;
