/**
 * StorefrontStudio — Cinematic Inline CMS for the tenant's public storefront.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Topbar: page picker · locale tabs · viewport · save · publish │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │                                                                │
 *   │              [responsive preview canvas]                       │
 *   │                                                                │
 *   │              <section> with hover overlay:                     │
 *   │                  reorder · visibility · duplicate · delete     │
 *   │                                                                │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  Footer: autosave dot · last saved · publish state             │
 *   └───────────────────────────────────────────────────────────────┘
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Tablet, Smartphone, Eye, EyeOff, Copy, Trash2, GripVertical, Plus, Globe, Send, ChevronDown, ExternalLink, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { storefrontApi } from '../../components/storefront/storefrontApi';
import AssetPicker from '../../components/storefront/AssetPicker';
import PublishDiffDrawer from '../../components/storefront/PublishDiffDrawer';
import { renderSection } from '../../components/storefront/SectionRenderers';
import { publicLanguages } from '../../site/content/languages';

const VIEWPORTS = {
  desktop: { label: 'Desktop', icon: Monitor, width: '100%', max: '1280px' },
  tablet:  { label: 'Tablet',  icon: Tablet,  width: '820px',  max: '820px' },
  mobile:  { label: 'Mobile',  icon: Smartphone, width: '420px', max: '420px' },
};

const SAVE_DEBOUNCE = 700;

const StorefrontStudio = () => {
  const navigate = useNavigate();
  const { t, tenant } = useBlueprint();
  const [pages, setPages] = useState([]);
  const [activeKey, setActiveKey] = useState('home');
  const [locale, setLocale] = useState('it');
  const [viewport, setViewport] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [assetPicker, setAssetPicker] = useState(null);  // {onPick}
  const dirtyRef = useRef({});            // { [sectionId]: { locale_content, settings } }
  const saveTimerRef = useRef(null);
  const supportedLocales = publicLanguages().map((l) => l.code);
  const [diffDrawer, setDiffDrawer] = useState(false);
  const [diffSummary, setDiffSummary] = useState(null);   // { has_changes, ... }

  const activePage = pages.find((p) => p.page_key === activeKey);

  // ── Refresh dirty badge for the active page ──────────────────────────
  const refreshDiffSummary = useCallback(async (key = activeKey) => {
    if (!key) return;
    try {
      const d = await storefrontApi.pageDiff(key, 'published');
      setDiffSummary(d?.summary || null);
    } catch { /* silent */ }
  }, [activeKey]);

  useEffect(() => { refreshDiffSummary(activeKey); }, [activeKey, refreshDiffSummary]);

  // ── Load all pages on mount ───────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await storefrontApi.listPages();
      setPages(r.pages || []);
    } catch (e) {
      console.error('Failed to load storefront pages', e);
      toast.error('Failed to load storefront pages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Autosave queue ────────────────────────────────────────────────────────
  const flushSave = useCallback(async () => {
    const pending = Object.entries(dirtyRef.current);
    if (pending.length === 0) return;
    setSaveStatus('saving');
    try {
      for (const [sid, patch] of pending) {
        await storefrontApi.updateSection(sid, patch);
        delete dirtyRef.current[sid];
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      // After a successful autosave, refresh the dirty-badge counter so the
      // Publish button reflects pending changes in real time.
      refreshDiffSummary(activeKey);
    } catch (e) {
      console.error('Autosave failed', e);
      setSaveStatus('error');
      toast.error('Save failed. Retry?');
    }
  }, [activeKey, refreshDiffSummary]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE);
  }, [flushSave]);

  // ── Mutators ──────────────────────────────────────────────────────────────
  const updateContent = (sectionId, localeKey, field, value) => {
    setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : {
      ...p,
      sections: p.sections.map((s) => s.id !== sectionId ? s : {
        ...s,
        locale_content: {
          ...s.locale_content,
          [localeKey]: { ...(s.locale_content?.[localeKey] || {}), [field]: value },
        },
      }),
    }));
    // Mark dirty (full locale_content snapshot for this section)
    setTimeout(() => {
      const section = pages.find((p) => p.page_key === activeKey)
        ?.sections.find((s) => s.id === sectionId);
      // Use a synchronous getter via state — schedule then patch from latest
      dirtyRef.current[sectionId] = {
        ...(dirtyRef.current[sectionId] || {}),
        locale_content: null, // will be filled at flush time
      };
      // To avoid stale data, push the merged content
      setPages((cur) => {
        const page = cur.find((p) => p.page_key === activeKey);
        const sec  = page?.sections.find((s) => s.id === sectionId);
        if (sec) dirtyRef.current[sectionId].locale_content = sec.locale_content;
        return cur;
      });
      scheduleSave();
    }, 0);
  };

  const updateSettings = (sectionId, key, value) => {
    setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : {
      ...p,
      sections: p.sections.map((s) => s.id !== sectionId ? s : {
        ...s, settings: { ...(s.settings || {}), [key]: value },
      }),
    }));
    setTimeout(() => {
      setPages((cur) => {
        const page = cur.find((p) => p.page_key === activeKey);
        const sec  = page?.sections.find((s) => s.id === sectionId);
        if (sec) {
          dirtyRef.current[sectionId] = {
            ...(dirtyRef.current[sectionId] || {}),
            settings: sec.settings,
          };
        }
        return cur;
      });
      scheduleSave();
    }, 0);
  };

  const toggleVisibility = async (section) => {
    const next = !section.visible;
    setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : {
      ...p, sections: p.sections.map((s) => s.id === section.id ? { ...s, visible: next } : s),
    }));
    try { await storefrontApi.updateSection(section.id, { visible: next }); } catch (e) {
      toast.error('Could not toggle visibility');
    }
  };

  const duplicateSection = async (section) => {
    try {
      const created = await storefrontApi.duplicateSection(section.id);
      setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : {
        ...p, sections: [...p.sections, created].sort((a, b) => a.sort_order - b.sort_order),
      }));
      toast.success('Section duplicated');
    } catch (e) { toast.error('Could not duplicate'); }
  };

  const deleteSection = async (section) => {
    if (!confirm(`Delete "${section.section_type}" section?`)) return;
    try {
      await storefrontApi.deleteSection(section.id);
      setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : {
        ...p, sections: p.sections.filter((s) => s.id !== section.id),
      }));
      toast.success('Section deleted');
    } catch (e) { toast.error('Could not delete'); }
  };

  const moveSection = async (section, dir) => {
    if (!activePage) return;
    const ordered = [...activePage.sections];
    const idx = ordered.findIndex((s) => s.id === section.id);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= ordered.length) return;
    [ordered[idx], ordered[targetIdx]] = [ordered[targetIdx], ordered[idx]];
    setPages((prev) => prev.map((p) => p.page_key !== activeKey ? p : { ...p, sections: ordered }));
    try {
      await storefrontApi.reorderSections(activeKey, ordered.map((s) => s.id));
    } catch (e) { toast.error('Reorder failed'); loadAll(); }
  };

  const publishPage = async () => {
    if (!activePage) return;
    // Flush pending edits so the diff drawer shows the latest state, then
    // hand off to the Publish Diff drawer for review-then-publish.
    await flushSave();
    await refreshDiffSummary(activeKey);
    setDiffDrawer(true);
  };

  const openAssetPicker = (onPick) => {
    setAssetPicker({
      onPick: (asset) => { onPick?.(asset); setAssetPicker(null); },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bp-bg)]" data-testid="storefront-studio-loading">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.3em]">Opening Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bp-bg)] flex flex-col" data-testid="storefront-studio">
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)] sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          {/* Left: back + studio brand + page picker */}
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate('/settings')} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="studio-back">
              <ArrowLeft size={16} strokeWidth={1.5} />
            </button>
            <div className="border-l border-[var(--bp-border)] pl-4">
              <p className="text-[#C9A36E] text-[9px] font-body uppercase tracking-[0.25em] font-semibold">Storefront Studio</p>
              <p className="text-[var(--bp-text-primary)] text-[11px] font-body uppercase tracking-[0.15em] mt-0.5">{tenant?.name || 'Tenant'}</p>
            </div>
          </div>

          {/* Center: page picker */}
          <div className="flex items-center gap-1 bg-[var(--bp-surface-2)] p-1" data-testid="studio-page-picker">
            {pages.map((p) => (
              <button
                key={p.page_key}
                onClick={() => setActiveKey(p.page_key)}
                data-testid={`studio-page-${p.page_key}`}
                className={`px-3 py-1.5 text-[10px] font-body uppercase tracking-[0.18em] transition-colors ${p.page_key === activeKey ? 'bg-[var(--bp-bg)] text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}
              >
                {p.page_key.replace('_', ' ')}
                {p.status === 'published' && <span className="ml-1.5 w-1 h-1 inline-block bg-[var(--bp-primary)] rounded-full align-middle" />}
              </button>
            ))}
          </div>

          {/* Right: viewport switcher + locale + save + publish */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[var(--bp-surface-2)] p-1">
              {Object.entries(VIEWPORTS).map(([key, vp]) => {
                const Icon = vp.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setViewport(key)}
                    data-testid={`studio-viewport-${key}`}
                    title={vp.label}
                    className={`p-1.5 transition-colors ${key === viewport ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}
                  >
                    <Icon size={13} strokeWidth={1.6} />
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                data-testid="studio-locale-picker"
                className="appearance-none bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.18em] px-3 py-1.5 pr-7 cursor-pointer"
              >
                {supportedLocales.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--bp-text-muted)] pointer-events-none" />
            </div>

            {/* Save status soft pulse */}
            <div className="flex items-center gap-2 px-2" data-testid={`studio-save-${saveStatus}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === 'saving' ? 'bg-[var(--bp-primary)] animate-pulse' :
                  saveStatus === 'saved'  ? 'bg-[var(--bp-primary)]' :
                  saveStatus === 'error'  ? 'bg-[#E74C3C]' :
                  'bg-[var(--bp-text-subtle)]'
                }`}
              />
              <p className="text-[9px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">
                {saveStatus === 'saving' ? 'Saving' :
                 saveStatus === 'saved'  ? 'Saved'  :
                 saveStatus === 'error'  ? 'Retry'  : 'Auto'}
              </p>
            </div>

            {/* Publish */}
            <button
              onClick={publishPage}
              data-testid="studio-publish-btn"
              className="relative flex items-center gap-2 px-4 py-2 bg-[var(--bp-primary)] text-black text-[10px] font-body uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
            >
              <Send size={11} strokeWidth={1.8} />
              {activePage?.status === 'published' ? 'Review & republish' : 'Review & publish'}
              {diffSummary?.has_changes && (
                <span data-testid="studio-dirty-badge"
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 text-black text-[9px] font-mono font-semibold flex items-center justify-center">
                  {((diffSummary.sections_added || 0) + (diffSummary.sections_removed || 0) + (diffSummary.sections_modified || 0)) || '•'}
                </span>
              )}
            </button>

            {/* Revisions / diff quick button */}
            <button
              onClick={async () => { await flushSave(); setDiffDrawer(true); }}
              data-testid="studio-revisions-btn"
              title="Diff & revisions"
              className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
            >
              <GitCompare size={13} strokeWidth={1.5} />
            </button>

            {/* View live */}
            {tenant?.slug && (
              <a
                href={`/${tenant.slug}` /* future direct public preview */}
                target="_blank" rel="noopener noreferrer"
                className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
                title="View live storefront"
                data-testid="studio-view-live"
              >
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8" data-testid="studio-canvas">
        <div
          className="mx-auto bg-[var(--bp-bg)] shadow-2xl transition-all duration-500 ease-out"
          style={{ width: VIEWPORTS[viewport].width, maxWidth: VIEWPORTS[viewport].max }}
        >
          {activePage?.sections?.length === 0 && (
            <div className="py-32 text-center">
              <p className="text-[var(--bp-text-muted)] text-sm font-body italic">No sections on this page yet.</p>
            </div>
          )}
          {activePage?.sections?.map((section, idx) => (
            <div
              key={section.id}
              className="relative group"
              data-testid={`studio-section-wrap-${section.id}`}
              style={{ opacity: section.visible ? 1 : 0.35 }}
            >
              {/* Section toolbar (hover) */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/80 backdrop-blur-md text-white px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                   data-testid={`studio-section-toolbar-${section.id}`}>
                <button onClick={() => moveSection(section, 'up')} disabled={idx === 0}
                        className="p-1 hover:bg-white/10 disabled:opacity-30" title="Move up">
                  <GripVertical size={11} strokeWidth={1.6} />
                </button>
                <button onClick={() => toggleVisibility(section)} className="p-1 hover:bg-white/10" title="Toggle visibility"
                        data-testid={`studio-toggle-vis-${section.id}`}>
                  {section.visible ? <Eye size={11} strokeWidth={1.6} /> : <EyeOff size={11} strokeWidth={1.6} />}
                </button>
                <button onClick={() => duplicateSection(section)} className="p-1 hover:bg-white/10" title="Duplicate"
                        data-testid={`studio-dup-${section.id}`}>
                  <Copy size={11} strokeWidth={1.6} />
                </button>
                <button onClick={() => deleteSection(section)} className="p-1 hover:bg-red-500/30 hover:text-red-300" title="Delete"
                        data-testid={`studio-del-${section.id}`}>
                  <Trash2 size={11} strokeWidth={1.6} />
                </button>
              </div>

              {/* Section type ribbon (hover) */}
              <div className="absolute top-3 left-3 z-10 bg-black/80 text-[#C9A36E] text-[9px] font-body uppercase tracking-[0.2em] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {section.section_type}
              </div>

              {/* Renderer */}
              {renderSection(section, {
                locale, draft: section.locale_content,
                updateContent: (loc, f, v) => updateContent(section.id, loc, f, v),
                updateSettings: (k, v) => updateSettings(section.id, k, v),
                openAssetPicker,
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer status ───────────────────────────────────────────────── */}
      <div className="border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] px-6 py-2.5 flex items-center justify-between text-[9px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">
        <span data-testid="studio-status-state">
          {activePage?.status === 'published' ? 'Live' : 'Draft'}
          {activePage?.published_at && ` · published ${new Date(activePage.published_at).toLocaleString()}`}
        </span>
        <span>Storefront Studio · Session B</span>
      </div>

      <AssetPicker
        open={!!assetPicker}
        onClose={() => setAssetPicker(null)}
        onPick={assetPicker?.onPick}
      />

      <PublishDiffDrawer
        open={diffDrawer}
        pageKey={activeKey}
        onClose={() => setDiffDrawer(false)}
        onPublished={async () => {
          await loadAll();
          await refreshDiffSummary(activeKey);
        }}
        onReverted={async () => {
          await loadAll();
          await refreshDiffSummary(activeKey);
        }}
      />
    </div>
  );
};

export default StorefrontStudio;
