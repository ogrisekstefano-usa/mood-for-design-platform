/**
 * PageInspector — Right-sidebar tab for per-page presentation settings.
 *
 * Lives next to Inspector (block-level) and Layers tabs. Edits the ACTIVE
 * page's: chapter_label · transition_in · transition_duration · client
 * visibility · designer-presentation visibility.
 *
 * Persistence: PUT /api/moodboards/{mid}/pages/{pid} — body fields land
 * under `settings` JSONB server-side (no schema migration).
 *
 * Blueprint-driven: transitions registry comes from
 * /api/moodboards/_meta/presentation_transitions; all labels via t().
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import BlueprintColorPicker from '../../components/common/BlueprintColorPicker';

const PageInspector = ({ moodboardId, page, onSaved, onLocalUpdate }) => {
  const { t } = useBlueprint();
  const [transitions, setTransitions] = useState([]);
  const [draft, setDraft] = useState(() => ({
    title: page?.title || '',
    chapter_label: page?.settings?.chapter_label || '',
    transition_in: page?.settings?.transition_in || 'fade',
    transition_duration: page?.settings?.transition_duration || 700,
    hidden_in_presentation: !!page?.hidden_in_presentation,
    hidden_from_client: !!page?.settings?.hidden_from_client,
    background_color: page?.settings?.background_color || '',
    background_image_url: page?.settings?.background_image_url || '',
    background_overlay: page?.settings?.background_overlay ?? 0,
  }));

  // Sync draft when the active page changes
  useEffect(() => {
    if (!page) return;
    setDraft({
      title: page.title || '',
      chapter_label: page.settings?.chapter_label || '',
      transition_in: page.settings?.transition_in || 'fade',
      transition_duration: page.settings?.transition_duration || 700,
      hidden_in_presentation: !!page.hidden_in_presentation,
      hidden_from_client: !!page.settings?.hidden_from_client,
      background_color: page.settings?.background_color || '',
      background_image_url: page.settings?.background_image_url || '',
      background_overlay: page.settings?.background_overlay ?? 0,
    });
  }, [page?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/api/moodboards/_meta/presentation_transitions')
      .then((r) => setTransitions(r.data?.data || []))
      .catch(() => setTransitions([]));
  }, []);

  // Debounced server commit so live-drag sliders don't flood the network.
  // Local state + parent-level page mutation happen IMMEDIATELY (via
  // onLocalUpdate) so the canvas previews edits in real time; the PUT
  // catches up 280ms after the user stops interacting.
  // (Refs declared BEFORE the early return so React Hook order stays stable.)
  const commitTimerRef = useRef(null);
  const pendingPatchRef = useRef({});

  if (!page) return null;

  const flushCommit = async () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const patch = { ...pendingPatchRef.current };
    pendingPatchRef.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await api.put(`/api/moodboards/${moodboardId}/pages/${page.id}`, patch);
      onSaved?.();
    } catch (_) { /* tolerated — autosave will retry on next change */ }
  };

  const commit = (patch, { live = true } = {}) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (live) onLocalUpdate?.(page.id, patch);  // instant canvas preview
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(flushCommit, 280);
  };

  return (
    <div className="p-5 overflow-y-auto flex-1" data-testid="page-inspector">
      <p className="bp-eyebrow mb-4 !text-[var(--bp-text-muted)]">
        {t('moodboards.editor.pageInspector')}
      </p>

      {/* Page title */}
      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">
          {t('moodboards.field.title')}
        </span>
        <input value={draft.title}
               onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
               onBlur={(e) => { if (e.target.value !== (page.title || '')) commit({ title: e.target.value }); }}
               data-testid="page-title-input"
               className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]" />
      </label>

      {/* Chapter label */}
      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">
          {t('moodboards.field.chapter')}
        </span>
        <input value={draft.chapter_label}
               onChange={(e) => setDraft((d) => ({ ...d, chapter_label: e.target.value }))}
               onBlur={(e) => commit({ chapter_label: e.target.value })}
               placeholder={t('moodboards.field.chapterPlaceholder')}
               data-testid="page-chapter-input"
               className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]" />
      </label>

      {/* Transition selector */}
      <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
        <p className="bp-eyebrow !text-[10px] mb-3 !text-[var(--bp-text-muted)]">
          {t('moodboards.field.transition')}
        </p>
        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">
            {t('moodboards.field.transitionIn')}
          </span>
          <select value={draft.transition_in}
                  onChange={(e) => commit({ transition_in: e.target.value })}
                  data-testid="page-transition-in"
                  className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
            {transitions.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {t(tx.label_key) && t(tx.label_key) !== tx.label_key
                  ? t(tx.label_key)
                  : tx.id.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">
              {t('moodboards.field.transitionDuration')}
            </span>
            <span className="bp-caption !text-[10px] text-[var(--bp-text-secondary)] font-mono">
              {draft.transition_duration}ms
            </span>
          </div>
          <input type="range" min={200} max={1600} step={50}
                 value={draft.transition_duration}
                 onChange={(e) => setDraft((d) => ({ ...d, transition_duration: parseInt(e.target.value, 10) }))}
                 onMouseUp={(e) => commit({ transition_duration: parseInt(e.target.value, 10) })}
                 onTouchEnd={(e) => commit({ transition_duration: parseInt(e.target.value, 10) })}
                 data-testid="page-transition-duration"
                 className="w-full accent-[var(--bp-primary)]" />
        </label>
      </div>

      {/* Visibility */}
      <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
        <p className="bp-eyebrow !text-[10px] mb-3 !text-[var(--bp-text-muted)]">
          {t('moodboards.field.visibility')}
        </p>
        <Toggle label={t('moodboards.field.hiddenFromClient')}
                hint={t('moodboards.field.hiddenFromClientHint')}
                checked={draft.hidden_from_client}
                onChange={(v) => commit({ hidden_from_client: v })}
                testid="page-hidden-from-client" />
        <Toggle label={t('moodboards.field.hiddenInPresentation')}
                hint={t('moodboards.field.hiddenInPresentationHint')}
                checked={draft.hidden_in_presentation}
                onChange={(v) => commit({ hidden_in_presentation: v })}
                testid="page-hidden-in-presentation" />
      </div>

      {/* Page background — color + image + overlay opacity. Applies to
          the editor canvas, presentation mode and review mode (renderers
          read page.settings.{background_color, background_image_url,
          background_overlay}). Light/Dark cinematic boards both supported. */}
      <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
        <div className="flex items-center justify-between mb-3">
          <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">
            {t('moodboards.field.pageBackground', null, 'Page background')}
          </p>
          {/* Apply current background to every page — minimal "Global Project
              Styles" preview. Uses the local PUT endpoint with the page-bg
              fields only, fanned out over the moodboard's other pages. */}
          <button type="button"
                  data-testid="page-bg-apply-all"
                  onClick={async () => {
                    const r = await api.get(`/api/moodboards/${moodboardId}/pages`);
                    const otherPages = (r.data?.data || r.data || []).filter((p) => p.id !== page.id);
                    const patch = {
                      background_color: draft.background_color || null,
                      background_image_url: draft.background_image_url || null,
                      background_overlay: draft.background_overlay ?? 0,
                    };
                    await Promise.all(otherPages.map((p) =>
                      api.put(`/api/moodboards/${moodboardId}/pages/${p.id}`, patch),
                    ));
                    onSaved?.();
                  }}
                  className="text-[9px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)]
                             hover:text-[var(--bp-primary)] transition-colors">
            {t('moodboards.editor.applyAllPages', null, 'Apply to all pages')}
          </button>
        </div>

        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
            {t('moodboards.field.bgColor', null, 'Background color')}
          </span>
          <BlueprintColorPicker
            value={(draft.background_color || '#0A0A0B').startsWith('#') ? draft.background_color || '#0A0A0B' : '#0A0A0B'}
            onChange={(v) => commit({ background_color: v })}
            testid="page-bg-color"
            align="right"
          />
        </label>

        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
            {t('moodboards.field.bgImage', null, 'Background image URL')}
          </span>
          <input value={draft.background_image_url || ''}
                 onChange={(e) => setDraft((d) => ({ ...d, background_image_url: e.target.value }))}
                 onBlur={(e) => commit({ background_image_url: e.target.value })}
                 placeholder="https://…"
                 data-testid="page-bg-image-url"
                 className="input-luxury w-full px-2 py-1.5 text-xs rounded-[var(--bp-radius-xs)]" />
        </label>

        <label className="block mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)]">
              {t('moodboards.field.bgOverlay', null, 'Overlay')}
            </span>
            <span className="bp-caption !text-[10px] text-[var(--bp-text-primary)] font-mono tabular-nums">
              {((draft.background_overlay ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
          <input type="range" min={0} max={1} step={0.02}
                 value={draft.background_overlay ?? 0}
                 onChange={(e) => commit({ background_overlay: parseFloat(e.target.value) })}
                 data-testid="page-bg-overlay"
                 className="bp-slider" />
        </label>
      </div>
    </div>
  );
};

const Toggle = ({ label, hint, checked, onChange, testid }) => (
  <label className="flex items-start gap-3 mb-3 cursor-pointer">
    <button type="button"
            onClick={() => onChange(!checked)}
            data-testid={testid}
            className={`mt-0.5 relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0
                        ${checked ? 'bg-[var(--bp-primary)]' : 'bg-[var(--bp-surface-2)]'}`}>
      <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform
                        ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
    </button>
    <div className="flex-1 min-w-0">
      <p className="bp-caption !text-[11px] !text-[var(--bp-text-primary)]">{label}</p>
      {hint && <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-0.5">{hint}</p>}
    </div>
  </label>
);

export default PageInspector;
