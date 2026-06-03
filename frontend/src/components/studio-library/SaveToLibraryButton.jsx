/**
 * ITER204 · Save to Studio Library™ — generic reusable button.
 *
 * Drop this into any entity card (brand, collection, product, material,
 * designer) to expose a single-tap "save to library" toggle. Idempotent,
 * theme-token only, fully i18n.
 *
 * Props:
 *   entityType   'brand' | 'collection' | 'product' | 'material' | 'designer'
 *   entityId     UUID of the entity
 *   initialSaved boolean — pre-known state if available (optional)
 *   sourceType   string  — provenance tag (default 'manual')
 *   compact      boolean — icon-only mode
 *   onChange     (saved:boolean) => void — bubbles up the new state
 */
import React, { useCallback, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import SL from '../../lib/studioLibraryApi';
import { useBlueprint } from '../../contexts/BlueprintContext';

export default function SaveToLibraryButton({
  entityType,
  entityId,
  initialSaved = false,
  sourceType   = 'manual',
  compact      = false,
  onChange,
  testId,
}) {
  const { t } = useBlueprint();
  const [saved, setSaved] = useState(!!initialSaved);
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await SL.toggleLibrary({
        entity_type: entityType,
        entity_id:   entityId,
        source_type: sourceType,
      });
      const isSaved = !!res.data?.saved;
      setSaved(isSaved);
      onChange?.(isSaved);
      toast.success(
        isSaved
          ? t('studio_library.save.toast_saved', null, 'Salvato in Studio Library™')
          : t('studio_library.save.toast_removed', null, 'Rimosso da Studio Library™')
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail
        || t('studio_library.save.toast_error', null, 'Operazione fallita'));
    } finally {
      setBusy(false);
    }
  }, [busy, entityType, entityId, sourceType, t, onChange]);

  const Icon = saved ? Icons.BookmarkCheck : Icons.Bookmark;
  const label = saved
    ? t('studio_library.save.saved', null, 'In Library')
    : t('studio_library.save.add', null, 'Salva in Library');

  const tid = testId || `save-to-library-${entityType}-${entityId}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={label}
        aria-label={label}
        aria-pressed={saved}
        data-testid={tid}
        style={{
          width: 30, height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: saved
            ? 'color-mix(in srgb, var(--accent-primary, #5dd9c4) 18%, transparent)'
            : 'var(--bp-surface-1, rgba(255,255,255,.04))',
          border: `1px solid ${saved
            ? 'var(--accent-primary, #5dd9c4)'
            : 'var(--bp-border, rgba(255,255,255,.1))'}`,
          color: saved
            ? 'var(--accent-primary, #5dd9c4)'
            : 'var(--bp-text-muted, rgba(255,255,255,.62))',
          borderRadius: 999,
          cursor: busy ? 'wait' : 'pointer',
          transition: 'background .15s, color .15s, border-color .15s',
        }}
      >
        <Icon size={14} strokeWidth={1.6} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      data-testid={tid}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        background: saved
          ? 'color-mix(in srgb, var(--accent-primary, #5dd9c4) 18%, transparent)'
          : 'var(--bp-surface-1, rgba(255,255,255,.04))',
        border: `1px solid ${saved
          ? 'var(--accent-primary, #5dd9c4)'
          : 'var(--bp-border, rgba(255,255,255,.1))'}`,
        color: saved
          ? 'var(--accent-primary, #5dd9c4)'
          : 'var(--bp-text, rgba(255,255,255,.85))',
        borderRadius: 999,
        cursor: busy ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '.01em',
        transition: 'background .15s, color .15s, border-color .15s',
      }}
    >
      <Icon size={13} strokeWidth={1.6} />
      <span>{label}</span>
    </button>
  );
}
