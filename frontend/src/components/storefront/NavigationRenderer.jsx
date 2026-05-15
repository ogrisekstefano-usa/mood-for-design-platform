/**
 * NavigationRenderer — Cinematic inline editor for the `nav_top` section.
 *
 * Live preview of the actual public site header (logo, links, locale switcher,
 * CTA), with click-to-edit on every label/href, drag-to-reorder, add/remove,
 * per-link toggles (visibility, open-in-new-tab, mobile/desktop visibility,
 * is_cta flag).
 *
 * The editor stores the link array in `settings.links` (non-locale shape) and
 * the per-locale labels live inside each link's `label` JSONB bag, mirroring
 * the storefront content model so the public site can directly read it.
 */
import React, { useRef, useState } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ExternalLink, Smartphone, Monitor, Sparkles, ChevronDown, Globe } from 'lucide-react';
import InlineText from './InlineText';
import { pickLocale } from './storefrontApi';

const FALLBACK_CHAIN = ['it', 'en-US', 'en-GB', 'fr', 'de', 'es'];
const newId = () => `lnk-${Math.random().toString(36).slice(2, 8)}`;

const NavigationRenderer = ({ section, locale, updateContent, updateSettings, openAssetPicker }) => {
  const settings = section.settings || {};
  const links = Array.isArray(settings.links) ? settings.links : [];
  const logoSrc = settings.logo_src || '/brand/mood-for-design-mark.png';
  const logoSize = settings.logo_size || 104;

  // Access label is locale-keyed and lives in locale_content
  const accessLabel = pickLocale(
    Object.fromEntries(Object.entries(section.locale_content || {})
      .filter(([, v]) => v && typeof v === 'object' && 'access_label' in v)
      .map(([k, v]) => [k, v.access_label])),
    locale, FALLBACK_CHAIN,
  );
  const accessHref = settings.access_href || '/auth/login';

  // ── Mutators ────────────────────────────────────────────────────────────
  const updateLinks = (next) => updateSettings('links', next);
  const patchLink = (idx, patch) => updateLinks(links.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const patchLinkLabel = (idx, value) => {
    const next = links.map((l, i) => i === idx ? {
      ...l,
      label: { ...(l.label || {}), [locale]: value },
    } : l);
    updateLinks(next);
  };

  const addLink = () => {
    const id = newId();
    const next = [...links, {
      id, href: '#new', label: { _default: 'New link', [locale]: 'New link' },
      visible: true, open_in_new_tab: false,
      show_on_desktop: true, show_on_mobile: true, is_cta: false,
    }];
    updateLinks(next);
  };
  const removeLink = (idx) => updateLinks(links.filter((_, i) => i !== idx));

  // Drag-and-drop reorder (HTML5)
  const dragFromRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const onDragStart = (idx) => (e) => { dragFromRef.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (idx) => (e) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop      = (idx) => (e) => {
    e.preventDefault();
    const from = dragFromRef.current;
    setDragOverIdx(null);
    dragFromRef.current = null;
    if (from == null || from === idx) return;
    const next = [...links];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    updateLinks(next);
  };

  // ── Render: live header preview + edit affordances ─────────────────────
  return (
    <div className="mfd-nav-editor" data-testid={`nav-editor-${section.id}`}>
      <style>{`
        .mfd-nav-editor { background: linear-gradient(180deg, #0e0e0e 0%, #161616 100%); border-bottom: 1px solid rgba(201,163,110,0.18); }
        .mfd-nav-editor__bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.6rem 2.4rem; gap: 2rem; min-height: 120px;
        }
        .mfd-nav-editor__brand img { display: block; }
        .mfd-nav-editor__links {
          display: flex; align-items: center; gap: 1.4rem; flex-wrap: wrap;
          justify-content: center; flex: 1;
        }
        .mfd-nav-editor__link {
          position: relative; display: flex; align-items: center; gap: 0.5rem;
          padding: 0.55rem 0.85rem; border: 1px solid transparent;
          color: #EFEBE4; font-family: Inter, system-ui, sans-serif;
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          cursor: grab; transition: border-color 0.2s, background 0.2s, opacity 0.2s;
        }
        .mfd-nav-editor__link[data-cta="true"] {
          background: #C9A36E; color: #0A0A0A; padding: 0.65rem 1.1rem;
        }
        .mfd-nav-editor__link[data-hidden="true"] { opacity: 0.3; }
        .mfd-nav-editor__link:hover { border-color: rgba(201,163,110,0.55); }
        .mfd-nav-editor__link[data-drag-over="true"] { border-color: #C9A36E; background: rgba(201,163,110,0.08); }
        .mfd-nav-editor__link-tools {
          position: absolute; top: -28px; left: 50%; transform: translateX(-50%);
          display: none; gap: 2px; background: #000; padding: 4px;
          border: 1px solid rgba(201,163,110,0.3); white-space: nowrap;
        }
        .mfd-nav-editor__link:hover .mfd-nav-editor__link-tools { display: flex; }
        .mfd-nav-editor__link-tools button {
          width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: none; color: #EFEBE4; cursor: pointer; transition: background 0.15s;
        }
        .mfd-nav-editor__link-tools button:hover { background: rgba(201,163,110,0.2); }
        .mfd-nav-editor__link-tools button[data-active="true"] { color: #C9A36E; }
        .mfd-nav-editor__href-row {
          display: flex; align-items: center; gap: 0.4rem;
          padding-top: 0.35rem; margin-top: 0.35rem;
          border-top: 1px dashed rgba(201,163,110,0.18);
        }
        .mfd-nav-editor__href-row input {
          background: transparent; border: none; color: rgba(255,255,255,0.55);
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          outline: none; min-width: 80px; max-width: 160px;
        }
        .mfd-nav-editor__right { display: flex; align-items: center; gap: 0.8rem; }
        .mfd-nav-editor__locale {
          padding: 0.45rem 0.7rem; border: 1px solid rgba(255,255,255,0.18);
          color: #EFEBE4; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          font-family: Inter, system-ui, sans-serif;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .mfd-nav-editor__access {
          padding: 0.65rem 1.2rem; border: 1px solid #EFEBE4;
          color: #EFEBE4; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          font-family: Inter, system-ui, sans-serif;
        }
        .mfd-nav-editor__add {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.45rem 0.85rem; border: 1px dashed rgba(201,163,110,0.6);
          color: #C9A36E; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          background: transparent; cursor: pointer; transition: all 0.2s;
        }
        .mfd-nav-editor__add:hover { background: rgba(201,163,110,0.12); }
        .mfd-nav-editor__logo-edit {
          position: relative; display: inline-block; cursor: pointer;
          background-image:
            linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%);
          background-size: 12px 12px;
          background-position: 0 0, 0 6px, 6px -6px, -6px 0;
        }
        .mfd-nav-editor__logo-edit::after {
          content: 'Replace'; position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.6); color: #C9A36E;
          font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase;
          opacity: 0; transition: opacity 0.2s; font-family: Inter, system-ui, sans-serif;
        }
        .mfd-nav-editor__logo-edit:hover::after { opacity: 1; }
        .mfd-nav-editor__size {
          display: inline-flex; align-items: center; gap: 0.4rem; margin-left: 0.6rem;
          color: rgba(255,255,255,0.4); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
          font-family: Inter, system-ui, sans-serif;
        }
        .mfd-nav-editor__size input {
          width: 50px; padding: 0.2rem 0.3rem; background: transparent;
          border: 1px solid rgba(255,255,255,0.18); color: #EFEBE4;
          font-size: 10px; outline: none; text-align: center;
        }
      `}</style>

      <div className="mfd-nav-editor__bar">
        {/* Brand: logo + size knob (inline editable) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            className="mfd-nav-editor__logo-edit"
            onClick={() => openAssetPicker((asset) => updateSettings('logo_src', asset.public_url))}
            data-testid={`nav-logo-${section.id}`}
            style={{ width: logoSize, height: 'auto', lineHeight: 0 }}
          >
            <img src={logoSrc} alt="logo" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
          <label className="mfd-nav-editor__size">
            <span>Size</span>
            <input
              type="number" min="40" max="200" value={logoSize}
              onChange={(e) => updateSettings('logo_size', Math.max(40, Math.min(200, parseInt(e.target.value || '64', 10))))}
              data-testid={`nav-logo-size-${section.id}`}
            />
            <span>px</span>
          </label>
        </div>

        {/* Links list — editable, draggable, with per-link tools */}
        <div className="mfd-nav-editor__links" data-testid="nav-links-list">
          {links.map((lk, idx) => (
            <div
              key={lk.id || idx}
              className="mfd-nav-editor__link"
              data-cta={!!lk.is_cta}
              data-hidden={!lk.visible}
              data-drag-over={dragOverIdx === idx}
              draggable
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver(idx)}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={onDrop(idx)}
              data-testid={`nav-link-${idx}`}
            >
              {/* Hover toolbar */}
              <div className="mfd-nav-editor__link-tools">
                <button title="Drag to reorder" data-testid={`nav-link-${idx}-drag`}>
                  <GripVertical size={11} strokeWidth={1.6} />
                </button>
                <button
                  title={lk.visible ? 'Hide' : 'Show'}
                  data-active={!lk.visible}
                  onClick={() => patchLink(idx, { visible: !lk.visible })}
                  data-testid={`nav-link-${idx}-vis`}
                >
                  {lk.visible ? <Eye size={11} strokeWidth={1.6} /> : <EyeOff size={11} strokeWidth={1.6} />}
                </button>
                <button
                  title="Open in new tab"
                  data-active={lk.open_in_new_tab}
                  onClick={() => patchLink(idx, { open_in_new_tab: !lk.open_in_new_tab })}
                  data-testid={`nav-link-${idx}-newtab`}
                >
                  <ExternalLink size={11} strokeWidth={1.6} />
                </button>
                <button
                  title="Show on desktop"
                  data-active={lk.show_on_desktop !== false}
                  onClick={() => patchLink(idx, { show_on_desktop: lk.show_on_desktop === false ? true : false })}
                  data-testid={`nav-link-${idx}-desktop`}
                >
                  <Monitor size={11} strokeWidth={1.6} />
                </button>
                <button
                  title="Show on mobile"
                  data-active={lk.show_on_mobile !== false}
                  onClick={() => patchLink(idx, { show_on_mobile: lk.show_on_mobile === false ? true : false })}
                  data-testid={`nav-link-${idx}-mobile`}
                >
                  <Smartphone size={11} strokeWidth={1.6} />
                </button>
                <button
                  title="Promote to CTA"
                  data-active={lk.is_cta}
                  onClick={() => patchLink(idx, { is_cta: !lk.is_cta })}
                  data-testid={`nav-link-${idx}-cta`}
                >
                  <Sparkles size={11} strokeWidth={1.6} />
                </button>
                <button
                  title="Remove"
                  onClick={() => removeLink(idx)}
                  data-testid={`nav-link-${idx}-del`}
                >
                  <Trash2 size={11} strokeWidth={1.6} />
                </button>
              </div>

              {/* Label */}
              <InlineText
                value={pickLocale(lk.label, locale, FALLBACK_CHAIN) || ''}
                onChange={(v) => patchLinkLabel(idx, v)}
                placeholder="LABEL"
                as="span"
              />

              {/* Href (mini editor under label, only on hover) */}
              <span className="mfd-nav-editor__href-row" onClick={(e) => e.stopPropagation()}>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>→</span>
                <input
                  type="text"
                  value={lk.href || ''}
                  onChange={(e) => patchLink(idx, { href: e.target.value })}
                  placeholder="/path or #anchor"
                  data-testid={`nav-link-${idx}-href`}
                />
              </span>
            </div>
          ))}

          {/* Add new */}
          <button type="button" className="mfd-nav-editor__add" onClick={addLink} data-testid="nav-add-link">
            <Plus size={11} strokeWidth={1.8} /> Add link
          </button>
        </div>

        {/* Right group: locale switcher mock + Access CTA */}
        <div className="mfd-nav-editor__right">
          <span className="mfd-nav-editor__locale">
            <Globe size={11} strokeWidth={1.6} /> {locale.toUpperCase()} <ChevronDown size={10} strokeWidth={1.6} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="mfd-nav-editor__access" style={{ display: 'inline-block' }}>
              <InlineText
                value={accessLabel || ''}
                onChange={(v) => updateContent(locale, 'access_label', v)}
                placeholder="ACCESS"
                as="span"
              />
            </span>
            <input
              type="text"
              value={accessHref}
              onChange={(e) => updateSettings('access_href', e.target.value)}
              placeholder="/auth/login"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace', outline: 'none', textAlign: 'right' }}
              data-testid={`nav-access-href-${section.id}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationRenderer;
