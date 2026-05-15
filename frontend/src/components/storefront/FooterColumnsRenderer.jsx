/**
 * FooterColumnsRenderer — Cinematic inline editor for `footer_columns`.
 *
 * Live preview of the public site footer with:
 *   • Multi-column management (drag-reorder + add/remove)
 *   • Inline editable column titles
 *   • Inline editable links (label + href, drag-reorder within column, add/remove)
 *   • Showroom address (multiline editable)
 *   • Book CTA (label per locale + href)
 *   • Social rail (Instagram / Pinterest / LinkedIn / TikTok) with toggleable visibility
 *   • Copyright line (per-locale)
 *
 * Architecture: columns/socials/showroom_address_lines live in `settings`
 * (structural shape), while per-locale text (column titles, link labels,
 * showroom title, book CTA label, copyright) lives in `locale_content`.
 */
import React, { useRef, useState } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ExternalLink, Instagram, Linkedin } from 'lucide-react';
import InlineText from './InlineText';
import { pickLocale } from './storefrontApi';

const FALLBACK_CHAIN = ['it', 'en-US', 'en-GB', 'fr', 'de', 'es'];
const newId = () => `col-${Math.random().toString(36).slice(2, 8)}`;

const SocialIcon = ({ id }) => {
  if (id === 'instagram') return <Instagram size={14} strokeWidth={1.6} />;
  if (id === 'linkedin')  return <Linkedin size={14} strokeWidth={1.6} />;
  return <span style={{ fontSize: 10, letterSpacing: '0.15em' }}>{(id || '').slice(0, 2).toUpperCase()}</span>;
};

const fieldFromLocaleContent = (section, locale, field) => {
  const bag = section.locale_content || {};
  if (bag[locale]?.[field] != null) return bag[locale][field];
  for (const code of FALLBACK_CHAIN) {
    if (bag[code]?.[field] != null) return bag[code][field];
  }
  if (bag._default?.[field] != null) return bag._default[field];
  return '';
};

const FooterColumnsRenderer = ({ section, locale, updateContent, updateSettings }) => {
  const settings = section.settings || {};
  const columns = Array.isArray(settings.columns) ? settings.columns : [];
  const socials = Array.isArray(settings.socials) ? settings.socials : [];
  const addrLines = Array.isArray(settings.showroom_address_lines) ? settings.showroom_address_lines : [];
  const bookHref = settings.book_cta_href || '#book';
  const bookLabel = fieldFromLocaleContent(section, locale, 'book_cta_label') || '';
  const showroomTitle = fieldFromLocaleContent(section, locale, 'showroom_title') || 'SHOWROOM';
  const tagline = fieldFromLocaleContent(section, locale, 'tagline') || '';
  const copyrightTpl = fieldFromLocaleContent(section, locale, 'copyright') || '';
  const copyright = (copyrightTpl || '').replace('{year}', new Date().getFullYear());

  // ── Column mutators ─────────────────────────────────────────────────────
  const setColumns = (next) => updateSettings('columns', next);
  const patchColumn = (idx, patch) => setColumns(columns.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const patchColumnTitle = (idx, value) => {
    const c = columns[idx];
    setColumns(columns.map((cc, i) => i === idx ? {
      ...cc, title: { ...(c.title || {}), [locale]: value },
    } : cc));
  };
  const addColumn = () => setColumns([...columns, {
    id: newId(), title: { _default: 'New section', [locale]: 'New section' },
    links: [], visible: true,
  }]);
  const removeColumn = (idx) => setColumns(columns.filter((_, i) => i !== idx));

  // Drag-reorder columns
  const dragColFromRef = useRef(null);
  const [dragColOver, setDragColOver] = useState(null);
  const reorderColumns = (from, to) => {
    if (from == null || from === to) return;
    const next = [...columns];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setColumns(next);
  };

  // ── Link mutators (per column) ──────────────────────────────────────────
  const patchLink = (colIdx, linkIdx, patch) => {
    const c = columns[colIdx];
    const links = [...(c.links || [])];
    links[linkIdx] = { ...links[linkIdx], ...patch };
    patchColumn(colIdx, { links });
  };
  const patchLinkLabel = (colIdx, linkIdx, value) => {
    const lk = columns[colIdx].links[linkIdx];
    patchLink(colIdx, linkIdx, { label: { ...(lk.label || {}), [locale]: value } });
  };
  const addLink = (colIdx) => {
    const links = [...(columns[colIdx].links || []), {
      href: '#new', label: { _default: 'New link', [locale]: 'New link' }, visible: true,
    }];
    patchColumn(colIdx, { links });
  };
  const removeLink = (colIdx, linkIdx) => {
    const links = (columns[colIdx].links || []).filter((_, i) => i !== linkIdx);
    patchColumn(colIdx, { links });
  };

  // ── Address lines (multiline textarea) ─────────────────────────────────
  const updateAddress = (value) => updateSettings('showroom_address_lines', value.split('\n'));

  // ── Socials ────────────────────────────────────────────────────────────
  const toggleSocial = (idx) => updateSettings('socials',
    socials.map((s, i) => i === idx ? { ...s, visible: !(s.visible !== false) } : s));
  const updateSocialHref = (idx, href) => updateSettings('socials',
    socials.map((s, i) => i === idx ? { ...s, href } : s));

  return (
    <div data-testid={`footer-editor-${section.id}`} style={{
      background: '#0A0A0A', color: '#EFEBE4',
      padding: '3.5rem 2.4rem 2rem', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <style>{`
        .mfd-foot-editor__col { position: relative; }
        .mfd-foot-editor__col:hover .mfd-foot-editor__col-tools { display: flex; }
        .mfd-foot-editor__col-tools {
          position: absolute; top: -22px; left: 0; display: none; gap: 2px;
          background: #000; padding: 3px; border: 1px solid rgba(201,163,110,0.3);
        }
        .mfd-foot-editor__col-tools button {
          width: 20px; height: 20px; background: transparent; border: none;
          color: #EFEBE4; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .mfd-foot-editor__col-tools button:hover { background: rgba(201,163,110,0.18); }
        .mfd-foot-editor__link-row {
          position: relative; display: flex; align-items: center; gap: 0.4rem; padding: 4px 0;
        }
        .mfd-foot-editor__link-row .tools {
          display: none; gap: 2px;
        }
        .mfd-foot-editor__link-row:hover .tools { display: inline-flex; }
        .mfd-foot-editor__link-row .tools button {
          background: transparent; border: none; cursor: pointer;
          color: rgba(255,255,255,0.5); padding: 2px;
        }
        .mfd-foot-editor__link-row .tools button:hover { color: #C9A36E; }
        .mfd-foot-editor__href-input {
          background: transparent; border: none; outline: none;
          color: rgba(255,255,255,0.4); font-size: 9px; font-family: monospace;
          min-width: 60px; max-width: 100px;
        }
        .mfd-foot-editor__add {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: transparent; color: #C9A36E; border: 1px dashed rgba(201,163,110,0.45);
          padding: 0.35rem 0.65rem; cursor: pointer;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
        }
      `}</style>

      {/* Top brand band */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '2rem', marginBottom: '2.5rem' }}>
        <InlineText
          value={tagline}
          onChange={(v) => updateContent(locale, 'tagline', v)}
          placeholder="Editorial tagline (per locale)"
          multiline
          as="p"
          className=""
          style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', fontWeight: 300, lineHeight: 1.3, maxWidth: '32rem', whiteSpace: 'pre-line' }}
        />
      </div>

      {/* Columns grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '2rem', marginBottom: '3rem' }}>
        {columns.map((col, ci) => (
          <div
            key={col.id || ci}
            className="mfd-foot-editor__col"
            draggable
            onDragStart={(e) => { dragColFromRef.current = ci; e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setDragColOver(ci); }}
            onDragLeave={() => setDragColOver(null)}
            onDrop={(e) => { e.preventDefault(); reorderColumns(dragColFromRef.current, ci); dragColFromRef.current = null; setDragColOver(null); }}
            style={{ opacity: col.visible === false ? 0.35 : 1, padding: '0.4rem', borderRadius: 0, border: dragColOver === ci ? '1px dashed #C9A36E' : '1px dashed transparent' }}
            data-testid={`footer-col-${ci}`}
          >
            <div className="mfd-foot-editor__col-tools">
              <button title="Drag"><GripVertical size={11} strokeWidth={1.6} /></button>
              <button
                title={col.visible === false ? 'Show' : 'Hide'}
                onClick={() => patchColumn(ci, { visible: col.visible === false })}
                data-testid={`footer-col-${ci}-vis`}
              >
                {col.visible === false ? <EyeOff size={11} strokeWidth={1.6} /> : <Eye size={11} strokeWidth={1.6} />}
              </button>
              <button title="Remove" onClick={() => removeColumn(ci)} data-testid={`footer-col-${ci}-del`}>
                <Trash2 size={11} strokeWidth={1.6} />
              </button>
            </div>

            <InlineText
              value={pickLocale(col.title, locale, FALLBACK_CHAIN) || ''}
              onChange={(v) => patchColumnTitle(ci, v)}
              placeholder="COLUMN TITLE"
              as="p"
              style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9A36E', marginBottom: '0.9rem' }}
            />

            {(col.links || []).map((lk, li) => (
              <div className="mfd-foot-editor__link-row" key={li} style={{ opacity: lk.visible === false ? 0.4 : 1 }} data-testid={`footer-link-${ci}-${li}`}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <InlineText
                      value={pickLocale(lk.label, locale, FALLBACK_CHAIN) || ''}
                      onChange={(v) => patchLinkLabel(ci, li, v)}
                      placeholder="Link label"
                      as="span"
                      style={{ fontSize: 13, color: '#EFEBE4', fontFamily: 'Georgia, serif' }}
                    />
                    {lk.open_in_new_tab && (
                      <span
                        title="Opens in new tab"
                        style={{ display: 'inline-flex', color: '#C9A36E', opacity: 0.85 }}
                        data-testid={`footer-link-${ci}-${li}-newtab-indicator`}
                      >
                        <ExternalLink size={9} strokeWidth={2} />
                      </span>
                    )}
                  </span>
                  <input
                    type="text"
                    className="mfd-foot-editor__href-input"
                    value={lk.href || ''}
                    onChange={(e) => patchLink(ci, li, { href: e.target.value })}
                    placeholder="#anchor"
                    data-testid={`footer-link-${ci}-${li}-href`}
                  />
                </span>
                <span className="tools">
                  <button
                    title="Open in new tab"
                    onClick={() => patchLink(ci, li, { open_in_new_tab: !lk.open_in_new_tab })}
                    style={{ color: lk.open_in_new_tab ? '#C9A36E' : undefined }}
                    data-testid={`footer-link-${ci}-${li}-newtab`}
                  >
                    <ExternalLink size={10} strokeWidth={1.6} />
                  </button>
                  <button
                    title={lk.visible === false ? 'Show' : 'Hide'}
                    onClick={() => patchLink(ci, li, { visible: lk.visible === false })}
                    data-testid={`footer-link-${ci}-${li}-vis`}
                  >
                    {lk.visible === false ? <EyeOff size={10} strokeWidth={1.6} /> : <Eye size={10} strokeWidth={1.6} />}
                  </button>
                  <button onClick={() => removeLink(ci, li)} data-testid={`footer-link-${ci}-${li}-del`}>
                    <Trash2 size={10} strokeWidth={1.6} />
                  </button>
                </span>
              </div>
            ))}

            <button className="mfd-foot-editor__add" onClick={() => addLink(ci)} style={{ marginTop: '0.6rem' }} data-testid={`footer-col-${ci}-add-link`}>
              <Plus size={9} strokeWidth={1.8} /> Add link
            </button>
          </div>
        ))}

        <button className="mfd-foot-editor__add" onClick={addColumn}
                style={{ alignSelf: 'flex-start', padding: '0.7rem 1rem' }}
                data-testid="footer-add-column">
          <Plus size={11} strokeWidth={1.8} /> Add column
        </button>
      </div>

      {/* Showroom + Socials grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '2rem' }}>
        {/* Showroom address */}
        <div>
          <InlineText
            value={showroomTitle}
            onChange={(v) => updateContent(locale, 'showroom_title', v)}
            placeholder="SHOWROOM"
            as="p"
            style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C9A36E', marginBottom: '0.8rem' }}
          />
          <textarea
            value={addrLines.join('\n')}
            onChange={(e) => updateAddress(e.target.value)}
            rows={5}
            placeholder="Address line 1&#10;Address line 2&#10;Phone&#10;Email"
            style={{
              width: '100%', background: 'transparent', color: '#EFEBE4',
              border: 'none', outline: 'none', resize: 'vertical',
              fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7,
            }}
            data-testid={`footer-address-${section.id}`}
          />
          {/* Book CTA */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginTop: '0.5rem' }}>
            <span style={{ padding: '0.6rem 1rem', border: '1px solid #C9A36E', color: '#C9A36E' }}>
              <InlineText
                value={bookLabel}
                onChange={(v) => updateContent(locale, 'book_cta_label', v)}
                placeholder="BOOK A VISIT"
                as="span"
                style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase' }}
              />
            </span>
            <input
              type="text"
              value={bookHref}
              onChange={(e) => updateSettings('book_cta_href', e.target.value)}
              placeholder="#book"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'monospace', outline: 'none' }}
              data-testid={`footer-book-href-${section.id}`}
            />
          </div>
        </div>

        {/* Socials */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '0.8rem' }}>Social</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {socials.map((s, idx) => (
              <div key={s.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', opacity: s.visible === false ? 0.35 : 1 }} data-testid={`footer-social-${s.id}`}>
                <button
                  onClick={() => toggleSocial(idx)}
                  style={{
                    width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(201,163,110,0.4)', background: 'transparent', color: '#EFEBE4', cursor: 'pointer',
                  }}
                  title={s.visible === false ? 'Show' : 'Hide'}
                >
                  <SocialIcon id={s.id} />
                </button>
                <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', minWidth: 80 }}>{s.label || s.id}</span>
                <input
                  type="text"
                  value={s.href || ''}
                  onChange={(e) => updateSocialHref(idx, e.target.value)}
                  placeholder="https://..."
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace', outline: 'none', padding: '0.3rem 0' }}
                  data-testid={`footer-social-${s.id}-href`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
          {copyright || '(set copyright per locale)'}
        </span>
        <InlineText
          value={copyrightTpl}
          onChange={(v) => updateContent(locale, 'copyright', v)}
          placeholder="© {year} MOOD for DESIGN™ — All rights reserved."
          as="span"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
        />
      </div>
    </div>
  );
};

export default FooterColumnsRenderer;
