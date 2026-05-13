/**
 * NavigationEditorPage — tenant-facing editor for public navigation & footer.
 *
 * Tabs:
 *   - Navigation: items (link/mega), CTA, logo, sticky/transparent toggles
 *   - Footer: columns with links, bottom row (copyright, social, legal links)
 *
 * All labels are i18n maps {_default, en-US, it, ...} — switching the preview
 * locale lets the editor work on translations live.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  ChevronUp, ChevronDown, Trash2, Plus, Save, RotateCcw, Check, X, ExternalLink,
} from 'lucide-react';

const I18nInput = ({ value, onChange, placeholder, locale, testid }) => (
  <input data-testid={testid}
    value={(typeof value === 'object' && value ? value[locale] : value) || ''}
    onChange={(e) => {
      if (typeof value === 'object' && value !== null) {
        onChange({ ...value, [locale]: e.target.value, _default: value._default || e.target.value });
      } else {
        onChange({ _default: e.target.value, [locale]: e.target.value });
      }
    }}
    placeholder={placeholder}
    className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)]" />
);

const Tab = ({ active, onClick, children, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className={`px-4 py-2 text-xs font-body rounded-[var(--bp-radius-sm)] transition-colors ${
      active ? 'bg-white/[0.05] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
    }`}>{children}</button>
);

const Row = ({ children, onMoveUp, onMoveDown, onDelete, canUp, canDown, idx }) => (
  <div className="border border-[var(--bp-border)] bg-[var(--bp-surface-1)] rounded-[var(--bp-radius-sm)] p-3 mb-3">
    <div className="flex items-center justify-between mb-3">
      <span className="bp-eyebrow !text-[var(--bp-text-muted)]">Item {String(idx + 1).padStart(2, '0')}</span>
      <div className="flex items-center gap-1">
        <button disabled={!canUp} onClick={onMoveUp} className="p-1.5 hover:bg-[var(--bp-surface-2)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] disabled:opacity-30">
          <ChevronUp size={13} strokeWidth={1.5} />
        </button>
        <button disabled={!canDown} onClick={onMoveDown} className="p-1.5 hover:bg-[var(--bp-surface-2)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] disabled:opacity-30">
          <ChevronDown size={13} strokeWidth={1.5} />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)]">
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
    {children}
  </div>
);

const NavigationEditorPage = () => {
  const navigate = useNavigate();
  const { tenant, availableLocales } = useBlueprint();
  const [tab, setTab] = useState('navigation');
  const [nav, setNav] = useState(null);
  const [foot, setFoot] = useState(null);
  const [locale, setLocale] = useState('_default');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [nRes, fRes] = await Promise.all([
        api.get('/api/settings/navigation'),
        api.get('/api/settings/footer'),
      ]);
      setNav(nRes.data.navigation);
      setFoot(fRes.data.footer);
      setDirty(false);
    } catch (e) { setError(formatError(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (setter, mut) => { setter(mut); setDirty(true); };

  // ── Navigation ops ───────────────────────────────────────────────────────
  const moveNavItem = (idx, dir) => {
    update(setNav, (n) => {
      const arr = [...(n.items || [])];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return n;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...n, items: arr };
    });
  };
  const updateNavItem = (idx, key, val) => update(setNav, (n) => ({
    ...n, items: (n.items || []).map((it, i) => i === idx ? { ...it, [key]: val } : it),
  }));
  const deleteNavItem = (idx) => update(setNav, (n) => ({
    ...n, items: (n.items || []).filter((_, i) => i !== idx),
  }));
  const addNavItem = () => update(setNav, (n) => ({
    ...n, items: [...(n.items || []), { id: `item-${Date.now()}`, type: 'link', label: {_default: 'New link'}, href: '#' }],
  }));

  // ── Footer ops ──────────────────────────────────────────────────────────
  const updateFooterColumn = (idx, key, val) => update(setFoot, (f) => ({
    ...f, columns: f.columns.map((c, i) => i === idx ? { ...c, [key]: val } : c),
  }));
  const moveFooterColumn = (idx, dir) => update(setFoot, (f) => {
    const arr = [...f.columns]; const j = idx + dir;
    if (j < 0 || j >= arr.length) return f;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return { ...f, columns: arr };
  });
  const deleteFooterColumn = (idx) => update(setFoot, (f) => ({
    ...f, columns: f.columns.filter((_, i) => i !== idx),
  }));
  const addFooterColumn = () => update(setFoot, (f) => ({
    ...f, columns: [...f.columns, { id: `col-${Date.now()}`, heading: {_default: 'Column'}, links: [] }],
  }));
  const updateFooterLink = (colIdx, linkIdx, key, val) => update(setFoot, (f) => ({
    ...f, columns: f.columns.map((c, i) => i !== colIdx ? c : {
      ...c, links: c.links.map((l, j) => j === linkIdx ? { ...l, [key]: val } : l),
    }),
  }));
  const addFooterLink = (colIdx) => update(setFoot, (f) => ({
    ...f, columns: f.columns.map((c, i) => i !== colIdx ? c : { ...c, links: [...(c.links || []), { label: {_default: 'Link'}, href: '#' }] }),
  }));
  const deleteFooterLink = (colIdx, linkIdx) => update(setFoot, (f) => ({
    ...f, columns: f.columns.map((c, i) => i !== colIdx ? c : { ...c, links: c.links.filter((_, j) => j !== linkIdx) }),
  }));

  // ── Save / reset ────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true); setError('');
    try {
      if (tab === 'navigation') {
        const r = await api.put('/api/settings/navigation', nav);
        setNav(r.data.navigation);
      } else {
        const r = await api.put('/api/settings/footer', foot);
        setFoot(r.data.footer);
      }
      setDirty(false); setSavedAt(Date.now());
    } catch (e) { setError(formatError(e)); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Reset to default?')) return;
    try {
      if (tab === 'navigation') {
        const r = await api.post('/api/settings/navigation/reset'); setNav(r.data.navigation);
      } else {
        const r = await api.post('/api/settings/footer/reset'); setFoot(r.data.footer);
      }
      setDirty(false);
    } catch (e) { setError(formatError(e)); }
  };

  const publicUrl = useMemo(() => {
    const slug = tenant?.slug;
    return slug ? `/${slug}` : '#';
  }, [tenant]);

  if (!nav || !foot) {
    return <div className="p-10 text-[var(--bp-text-muted)]">Loading…</div>;
  }

  return (
    <div className="p-10 max-w-4xl mx-auto" data-testid="navigation-editor-page">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <button onClick={() => navigate('/settings')} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-3" data-testid="back-settings">
            ← Settings
          </button>
          <p className="bp-eyebrow">Public website</p>
          <h1 className="bp-h1 mt-2">Navigation & Footer</h1>
          <p className="bp-body text-[var(--bp-text-muted)] mt-3 max-w-md">
            Compose the global top bar and footer used on your public tenant pages.
            All labels support multilingual content.
          </p>
        </div>
        {publicUrl !== '#' && (
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="bp-btn bp-btn-ghost text-xs" data-testid="visit-public-site">
            <ExternalLink size={12} strokeWidth={1.5} /> Visit
          </a>
        )}
      </div>

      {error && <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-300 bp-caption">{error}</div>}

      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--bp-border)]">
        <div className="flex gap-1">
          <Tab active={tab === 'navigation'} onClick={() => setTab('navigation')} testid="tab-navigation">Navigation</Tab>
          <Tab active={tab === 'footer'}     onClick={() => setTab('footer')}     testid="tab-footer">Footer</Tab>
        </div>
        <div className="flex items-center gap-3">
          <select value={locale} onChange={(e) => setLocale(e.target.value)} data-testid="locale-select"
            className="input-luxury px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-sm)]">
            <option value="_default">_default</option>
            {availableLocales.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
          </select>
          <button onClick={reset} className="bp-btn bp-btn-ghost text-xs" data-testid="reset-btn">
            <RotateCcw size={12} strokeWidth={1.5} /> Reset
          </button>
          <button onClick={save} disabled={!dirty || saving} data-testid="save-btn"
            className={`bp-btn ${dirty ? 'bp-btn-primary' : 'bp-btn-ghost opacity-50 cursor-not-allowed'} text-xs`}>
            {saving ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> :
              savedAt && !dirty ? <Check size={12} strokeWidth={1.5} /> : <Save size={12} strokeWidth={1.5} />}
            {saving ? 'Saving' : savedAt && !dirty ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {tab === 'navigation' ? (
        <div>
          {/* Options */}
          <div className="mb-8 grid md:grid-cols-2 gap-4 p-5 bg-[var(--bp-surface-1)]/50 border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)]">
            <label className="flex items-center justify-between">
              <span className="bp-caption text-[var(--bp-text-secondary)]">Sticky on scroll</span>
              <input type="checkbox" checked={!!nav.sticky} onChange={(e) => update(setNav, (n) => ({ ...n, sticky: e.target.checked }))} className="accent-[var(--bp-primary)]" data-testid="toggle-sticky" />
            </label>
            <label className="flex items-center justify-between">
              <span className="bp-caption text-[var(--bp-text-secondary)]">Transparent over hero</span>
              <input type="checkbox" checked={!!nav.transparent_on_hero} onChange={(e) => update(setNav, (n) => ({ ...n, transparent_on_hero: e.target.checked }))} className="accent-[var(--bp-primary)]" data-testid="toggle-transparent" />
            </label>
            <label className="flex items-center justify-between">
              <span className="bp-caption text-[var(--bp-text-secondary)]">Locale switcher</span>
              <input type="checkbox" checked={!!nav.show_locale_switcher} onChange={(e) => update(setNav, (n) => ({ ...n, show_locale_switcher: e.target.checked }))} className="accent-[var(--bp-primary)]" data-testid="toggle-locale-switcher" />
            </label>
          </div>

          {/* Items */}
          <h3 className="bp-h3 mb-4">Menu items</h3>
          {(nav.items || []).map((item, idx) => (
            <Row key={item.id || idx} idx={idx}
              canUp={idx > 0} canDown={idx < (nav.items || []).length - 1}
              onMoveUp={() => moveNavItem(idx, -1)} onMoveDown={() => moveNavItem(idx, 1)}
              onDelete={() => deleteNavItem(idx)}>
              <div className="grid grid-cols-2 gap-2">
                <I18nInput value={item.label} locale={locale} placeholder="Label" onChange={(v) => updateNavItem(idx, 'label', v)} testid={`item-label-${idx}`} />
                <input value={item.href || ''} onChange={(e) => updateNavItem(idx, 'href', e.target.value)} placeholder="URL"
                  className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)]" data-testid={`item-href-${idx}`} />
              </div>
            </Row>
          ))}
          <button onClick={addNavItem} className="bp-btn bp-btn-ghost w-full justify-center text-xs" data-testid="add-nav-item">
            <Plus size={12} strokeWidth={1.5} /> Add menu item
          </button>

          {/* CTA */}
          <h3 className="bp-h3 mt-10 mb-4">Primary CTA</h3>
          <div className="p-4 border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] grid grid-cols-2 gap-2">
            <I18nInput value={nav.cta?.label} locale={locale} placeholder="CTA Label"
              onChange={(v) => update(setNav, (n) => ({ ...n, cta: { ...(n.cta || {}), label: v } }))} testid="cta-label" />
            <input value={nav.cta?.href || ''} onChange={(e) => update(setNav, (n) => ({ ...n, cta: { ...(n.cta || {}), href: e.target.value } }))}
              placeholder="CTA URL" className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)]" data-testid="cta-href" />
          </div>
        </div>
      ) : (
        <div>
          <h3 className="bp-h3 mb-4">Columns</h3>
          {(foot.columns || []).map((col, ci) => (
            <Row key={col.id || ci} idx={ci}
              canUp={ci > 0} canDown={ci < foot.columns.length - 1}
              onMoveUp={() => moveFooterColumn(ci, -1)} onMoveDown={() => moveFooterColumn(ci, 1)}
              onDelete={() => deleteFooterColumn(ci)}>
              <I18nInput value={col.heading} locale={locale} placeholder="Heading"
                onChange={(v) => updateFooterColumn(ci, 'heading', v)} testid={`col-heading-${ci}`} />
              <div className="mt-3 ml-2 space-y-2 border-l border-[var(--bp-border)] pl-3">
                {(col.links || []).map((l, li) => (
                  <div key={li} className="grid grid-cols-2 gap-2 items-center">
                    <I18nInput value={l.label} locale={locale} placeholder="Link label"
                      onChange={(v) => updateFooterLink(ci, li, 'label', v)} />
                    <div className="flex gap-1">
                      <input value={l.href || ''} onChange={(e) => updateFooterLink(ci, li, 'href', e.target.value)} placeholder="URL"
                        className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)]" />
                      <button onClick={() => deleteFooterLink(ci, li)} className="p-1.5 text-[var(--bp-text-muted)] hover:text-red-400">
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => addFooterLink(ci)} className="bp-btn bp-btn-ghost text-xs">
                  <Plus size={11} strokeWidth={1.5} /> Add link
                </button>
              </div>
            </Row>
          ))}
          <button onClick={addFooterColumn} className="bp-btn bp-btn-ghost w-full justify-center text-xs" data-testid="add-footer-column">
            <Plus size={12} strokeWidth={1.5} /> Add column
          </button>

          {/* Bottom row */}
          <h3 className="bp-h3 mt-10 mb-4">Bottom row</h3>
          <div className="p-4 border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] space-y-3">
            <div>
              <span className="bp-eyebrow !text-[var(--bp-text-muted)]">Copyright (use {'{year}'} and {'{brand}'} placeholders)</span>
              <I18nInput value={foot.bottom?.copyright} locale={locale}
                placeholder="© {year} {brand}. All rights reserved."
                onChange={(v) => update(setFoot, (f) => ({ ...f, bottom: { ...(f.bottom || {}), copyright: v } }))} testid="copyright" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationEditorPage;
