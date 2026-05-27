import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Check, AlertCircle, Image as ImageIcon, Languages, Eye, EyeOff, Sparkles, Wand2, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminApi } from '../adminApi';
import MediaPicker from '../components/MediaPicker';
import MediaUploader from '../components/MediaUploader';
import LivePreview from '../components/LivePreview';

const LOCALES = [
  { code: 'it',    label: 'IT'    },
  { code: 'en-us', label: 'EN-US' },
  { code: 'en-uk', label: 'EN-UK' },
  { code: 'fr',    label: 'FR'    },
  { code: 'de',    label: 'DE'    },
  { code: 'es',    label: 'ES'    },
];

// Typography that mirrors the public site, so the inline preview feels real.
const PREVIEW_STYLE = {
  eyebrow:   { fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mood-teal, #00C9B3)', lineHeight: 1.4 },
  headline:  { fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '2rem', lineHeight: 1.05, letterSpacing: '-0.015em', color: '#FFFFFF' },
  body:      { fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '1.2rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' },
  cta:       { fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.08em', color: '#FFFFFF', textTransform: 'uppercase', background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 999, padding: '0.7rem 1.3rem', display: 'inline-block' },
  label:     { fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' },
  seo:       { fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' },
  default:   { fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 },
};

const Header = ({ title, subtitle }) => (
  <div>
    <h1 style={{
      fontFamily: 'Playfair Display, serif', fontWeight: 400,
      fontSize: '1.7rem', letterSpacing: '-0.01em', color: '#FFFFFF', margin: 0,
    }}>{title}</h1>
    {subtitle && (
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
        color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.55, maxWidth: '60ch',
      }}>{subtitle}</p>
    )}
  </div>
);

// ── BlockEditor: inline textarea + preview, multilingual ─────────────────
const BlockEditor = ({ block, locale, onSaved, onFocus }) => {
  const initial = (block.translations && block.translations[locale]) || '';
  const italianSource = (block.translations && block.translations['it']) || '';
  const [value, setValue]   = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('idle');  // 'idle' | 'saved' | 'error'
  const [translating, setTranslating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => { setValue(initial); setStatus('idle'); }, [initial, locale]);

  const previewStyle = PREVIEW_STYLE[block.block_type] || PREVIEW_STYLE.default;
  const dirty = value !== initial;
  const minLines = (block.block_type === 'body') ? 4 : 2;
  // AI-translate button shows only on non-IT locales with a non-empty IT source
  const canTranslate = locale !== 'it' && italianSource && italianSource.trim().length > 1;

  const save = async () => {
    setSaving(true); setStatus('idle');
    try {
      const parts = block.full_key.split('.');
      const ns = parts.slice(0, 2).join('.');
      const bk = parts.slice(2).join('.');
      // Merge translation into existing list — backend upsert handles dedup
      const translations = Object.entries(block.translations || {})
        .map(([loc, val]) => ({ locale: loc, value: val }))
        .filter(t => t.locale !== locale);
      translations.push({ locale, value });
      // Pick source_value: keep existing, or use IT, or first non-empty
      const source_value = block.source_value
        || (block.translations || {})['it']
        || value;
      await adminApi.upsertBlock({
        namespace: ns,
        block_key: bk,
        block_type: block.block_type || 'body',
        source_locale: block.source_locale || 'it',
        source_value,
        translations,
      });
      setStatus('saved');
      onSaved?.(block.full_key, locale, value);
      setTimeout(() => setStatus('idle'), 1800);
    } catch (e) {
      setStatus('error');
      window.alert('Salvataggio fallito: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const translateFromIT = async () => {
    if (!italianSource || translating) return;
    setTranslating(true);
    try {
      const res = await adminApi.translate(italianSource, 'it', locale);
      const translated = res?.data?.json?.translated;
      if (translated) {
        setValue(translated);
      } else {
        window.alert('Traduzione non disponibile (risposta vuota).');
      }
    } catch (e) {
      window.alert('Traduzione fallita: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div style={blockCard} data-testid={`block-${block.full_key}`} onFocus={onFocus} tabIndex={-1}>
      <div style={blockHeader}>
        <div>
          <p style={blockSlot}>{block.slot}</p>
          <p style={blockKey}>{block.full_key}</p>
        </div>
        <div style={blockActions}>
          {canTranslate && (
            <button
              onClick={translateFromIT}
              disabled={translating}
              style={{ ...translateBtn, opacity: translating ? 0.5 : 1 }}
              title="Traduci da IT con Claude AI"
              data-testid={`block-translate-${block.full_key}`}
            >
              <Wand2 size={11} /> {translating ? 'Traducendo…' : 'Traduci da IT'}
            </button>
          )}
          {dirty && status !== 'saved' && (
            <span style={{ ...statusPill, color: 'rgba(255,210,0,0.9)' }}>
              <AlertCircle size={11} /> Non salvato
            </span>
          )}
          {status === 'saved' && (
            <span style={{ ...statusPill, color: 'var(--mood-teal, #00C9B3)' }}>
              <Check size={11} /> Salvato
            </span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{ ...saveBtn, opacity: (!dirty || saving) ? 0.4 : 1 }}
            data-testid={`block-save-${block.full_key}`}
          >
            <Save size={11} /> {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>

      <div style={blockBody}>
        {/* Editor */}
        {block.block_type === 'body' && (
          <MarkdownToolbar
            value={value} setValue={setValue}
            previewMode={previewMode} setPreviewMode={setPreviewMode}
            testid={`mdtb-${block.full_key}`}
          />
        )}
        {previewMode ? (
          <div
            style={{
              ...textarea,
              minHeight: minLines * 22,
              whiteSpace: 'pre-wrap',
              cursor: 'text',
              background: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.86)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.96rem',
              lineHeight: 1.7,
            }}
            onClick={() => setPreviewMode(false)}
            data-testid={`block-preview-md-${block.full_key}`}
          >
            {renderBlockPreview(value)}
          </div>
        ) : (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={minLines}
            style={textarea}
            placeholder={`Scrivi in ${locale.toUpperCase()}…`}
            data-testid={`block-input-${block.full_key}`}
          />
        )}
        {/* Preview */}
        <div style={previewWrap}>
          <p style={previewLabel}>Resa pubblica · {locale.toUpperCase()}</p>
          <div style={previewBox}>
            {block.block_type === 'cta' ? (
              <span style={previewStyle}>{value || '—'}</span>
            ) : block.block_type === 'body' ? (
              <div style={{ ...previewStyle, fontFamily: 'Inter, sans-serif',
                            fontSize: '0.92rem', lineHeight: 1.7,
                            color: 'rgba(255,255,255,0.78)', fontWeight: 300 }}>
                {value ? renderBlockPreview(value) : <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
              </div>
            ) : (
              <div style={previewStyle}>{value || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── renderBlockPreview: inline markdown → React (used by preview pane) ──
const renderBlockPreview = (text) => {
  if (!text) return '—';
  const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  // Split paragraphs first (\n\n)
  const paragraphs = String(text).split(/\n\n+/);
  return paragraphs.map((p, pi) => {
    const out = [];
    let last = 0, m, k = 0;
    while ((m = TOKEN.exec(p)) !== null) {
      if (m.index > last) out.push(p.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) {
        out.push(<strong key={`b${pi}-${k++}`} style={{ fontWeight: 600, color: '#FFF' }}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith('*')) {
        out.push(<em key={`i${pi}-${k++}`} style={{ fontStyle: 'italic' }}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith('[')) {
        const label = tok.slice(1, tok.indexOf(']'));
        const url   = tok.slice(tok.indexOf('(') + 1, -1);
        out.push(
          <a key={`a${pi}-${k++}`} href={url} target="_blank" rel="noreferrer"
             style={{ color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none', borderBottom: '1px solid rgba(0,201,179,0.4)' }}>
            {label}
          </a>,
        );
      }
      last = m.index + tok.length;
    }
    if (last < p.length) out.push(p.slice(last));
    return <p key={pi} style={{ margin: pi > 0 ? '0.9em 0 0' : 0 }}>{out}</p>;
  });
};

// ── MarkdownToolbar: minimal inline markdown helpers (body blocks only) ──
const MarkdownToolbar = ({ value, setValue, previewMode, setPreviewMode, testid }) => {
  const wrap = (left, right = left) => {
    const ta = document.activeElement;
    let start = 0, end = value.length;
    if (ta && ta.tagName === 'TEXTAREA') {
      start = ta.selectionStart; end = ta.selectionEnd;
    }
    const sel = value.slice(start, end) || 'testo';
    const next = value.slice(0, start) + left + sel + right + value.slice(end);
    setValue(next);
  };
  const link = () => {
    const url = window.prompt('URL del link:', 'https://');
    if (!url) return;
    wrap('[', `](${url})`);
  };
  const bullet = () => setValue((value || '') + (value && !value.endsWith('\n') ? '\n' : '') + '• ');

  const btn = {
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.1)', padding: '0.32rem 0.5rem',
    fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
    cursor: 'pointer', borderRadius: 2,
  };
  const disabled = previewMode;
  return (
    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', alignItems: 'center' }} data-testid={testid}>
      <button type="button" disabled={disabled} style={{ ...btn, fontWeight: 700, opacity: disabled ? 0.4 : 1 }} onClick={() => wrap('**')} title="Grassetto">B</button>
      <button type="button" disabled={disabled} style={{ ...btn, fontStyle: 'italic', opacity: disabled ? 0.4 : 1 }} onClick={() => wrap('*')} title="Corsivo">I</button>
      <button type="button" disabled={disabled} style={{ ...btn, opacity: disabled ? 0.4 : 1 }} onClick={link} title="Link">↗</button>
      <button type="button" disabled={disabled} style={{ ...btn, opacity: disabled ? 0.4 : 1 }} onClick={bullet} title="Riga puntata">•</button>
      <button type="button" disabled={disabled} style={{ ...btn, opacity: disabled ? 0.4 : 1 }} onClick={() => setValue(value + '\n\n')} title="Spaziatura paragrafo">¶</button>
      <span style={{ marginLeft: '0.4rem', fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', color: 'rgba(255,255,255,0.32)' }}>
        markdown: **grassetto** · *corsivo* · [link](url)
      </span>
      <div style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2 }} data-testid={`${testid}-toggle`}>
        <button
          type="button"
          onClick={() => setPreviewMode(false)}
          style={{
            ...btn,
            border: 'none', borderRadius: 0,
            background: !previewMode ? 'rgba(0,201,179,0.18)' : 'transparent',
            color: !previewMode ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.5)',
          }}
        >Markdown</button>
        <button
          type="button"
          onClick={() => setPreviewMode(true)}
          style={{
            ...btn,
            border: 'none', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRadius: 0,
            background: previewMode ? 'rgba(0,201,179,0.18)' : 'transparent',
            color: previewMode ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.5)',
          }}
        >Anteprima</button>
      </div>
    </div>
  );
};

// ── MediaSlot: thumbnail + "Change photo" + dimensions/usages ───────────
const MediaSlot = ({ section, slot, onChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null);
  const m = slot.media;
  return (
    <div style={blockCard} data-testid={`media-slot-${section.id}-${slot.slot}`}>
      <div style={blockHeader}>
        <div>
          <p style={blockSlot}><ImageIcon size={11} /> {slot.slot}</p>
          <p style={blockKey}>{m ? `${m.category} / ${m.file_name || '—'}` : 'Nessuna immagine'}</p>
        </div>
        <button onClick={() => setPickerOpen(true)} style={saveBtn} data-testid={`media-change-${section.id}-${slot.slot}`}>
          Cambia foto
        </button>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        {m ? (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
            <div
              onClick={() => setPickerOpen(true)}
              style={{
                aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                background: m.dominant_color || '#1A1A1A', position: 'relative',
              }}
            >
              <img src={m.file_url} alt={m.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.9)' }}>
                {m.alt_text || <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nessun alt text</span>}
              </p>
              <div style={{ display: 'flex', gap: 14, fontSize: '0.7rem', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.5)' }}>
                {m.width && <span>{m.width}×{m.height}</span>}
                {m.dominant_color && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: m.dominant_color, border: '1px solid rgba(255,255,255,0.15)' }} />
                    {m.dominant_color}
                  </span>
                )}
                <span>{m.category}</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            style={emptyMedia}
            data-testid={`media-empty-${section.id}-${slot.slot}`}
          >
            <ImageIcon size={22} />
            <span>Seleziona una fotografia</span>
          </button>
        )}

        {m && (
          <MediaActionEditor section={section} slotKey={slot.slot} onSaved={onChange} />
        )}
      </div>

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          currentMediaId={slot.media_id}
          onSelect={(newMedia) => {
            // After picking from library, open crop/filter editor for fine-tuning.
            setPickerOpen(false);
            setEditingMedia(newMedia);
          }}
        />
      )}

      {editingMedia && (
        <MediaUploader
          sourceMedia={editingMedia}
          uploadFn={adminApi.uploadMedia}
          onClose={() => setEditingMedia(null)}
          onUploaded={async (uploaded) => {
            try {
              // Use the (possibly transformed) uploaded media id
              await adminApi.setSectionMedia(section.id, slot.slot, uploaded.id);
              setEditingMedia(null);
              onChange?.();
            } catch (e) {
              window.alert('Errore: ' + (e?.response?.data?.detail || e.message));
            }
          }}
        />
      )}
    </div>
  );
};

// ── MediaActionEditor: per-image click action ───────────────────────────
// settings.media_actions[slotKey] = { action: 'none'|'lightbox'|'link', href, target }
const MediaActionEditor = ({ section, slotKey, onSaved }) => {
  const stored = (section.settings?.media_actions || {})[slotKey] || {};
  const [action, setAction] = useState(stored.action || 'none');
  const [href, setHref]     = useState(stored.href   || '');
  const [target, setTarget] = useState(stored.target || '_self');
  const [busy, setBusy]     = useState(false);
  const [saved, setSaved]   = useState(false);

  // Sync local state when section prop refreshes (after a save)
  useEffect(() => {
    setAction(stored.action || 'none');
    setHref(stored.href   || '');
    setTarget(stored.target || '_self');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, JSON.stringify(stored)]);

  const initial = { action: stored.action || 'none', href: stored.href || '', target: stored.target || '_self' };
  const dirty = action !== initial.action || (action === 'link' && (href !== initial.href || target !== initial.target));

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      const all = { ...(section.settings?.media_actions || {}) };
      if (action === 'none') {
        delete all[slotKey];
      } else if (action === 'link') {
        all[slotKey] = { action: 'link', href, target };
      } else if (action === 'lightbox') {
        all[slotKey] = { action: 'lightbox' };
      }
      const newSettings = { ...(section.settings || {}), media_actions: all };
      await adminApi.patchSection(section.id, { settings: newSettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      window.alert('Errore salvataggio azione: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  const radio = (val, label, hint) => (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
        padding: '0.5rem 0.7rem',
        background: action === val ? 'rgba(0,201,179,0.08)' : 'transparent',
        border: `1px solid ${action === val ? 'rgba(0,201,179,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 4, flex: 1,
      }}
      data-testid={`media-action-${section.id}-${slotKey}-${val}`}
    >
      <input
        type="radio"
        checked={action === val}
        onChange={() => setAction(val)}
        style={{ marginTop: 2, accentColor: 'var(--mood-teal, #00C9B3)' }}
      />
      <div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: '#FFF', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );

  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}
         data-testid={`media-action-editor-${section.id}-${slotKey}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 500,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          Azione al click
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ fontSize:'0.66rem', color:'rgba(0,201,179,0.9)' }}>✓ salvato</span>}
          <button onClick={save} disabled={busy || !dirty}
                  style={{
                    padding: '0.4rem 0.85rem', fontSize: '0.66rem',
                    background: dirty ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.08)',
                    color: dirty ? '#000' : 'rgba(255,255,255,0.55)',
                    border: 'none', cursor: (busy || !dirty) ? 'not-allowed' : 'pointer',
                    opacity: (busy || !dirty) ? 0.55 : 1, fontWeight: 500,
                    fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
                  }}
                  data-testid={`media-action-save-${section.id}-${slotKey}`}>
            {busy ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {radio('none',     'Nessuna azione',  'Immagine statica')}
        {radio('lightbox', 'Ingrandisci',     'Apre in fullscreen')}
        {radio('link',     'Vai al link',     'Apre una URL al click')}
      </div>
      {action === 'link' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 10, alignItems: 'center' }}>
          <input
            type="text" placeholder="/url-interno  oppure  https://..."
            value={href} onChange={(e) => setHref(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#FFF', padding: '0.5rem 0.7rem', fontSize: '0.84rem',
              outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
            data-testid={`media-action-href-${section.id}-${slotKey}`}
          />
          <label title="Apre il link in una nuova scheda"
                 style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem',
                          color: 'rgba(255,255,255,0.55)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox" checked={target === '_blank'}
              onChange={(e) => setTarget(e.target.checked ? '_blank' : '_self')}
              style={{ accentColor: 'var(--mood-teal, #00C9B3)' }}
              data-testid={`media-action-newtab-${section.id}-${slotKey}`}
            />
            nuova scheda
          </label>
        </div>
      )}
    </div>
  );
};

// ── AddSectionPalette ───────────────────────────────────────────────────
// Pill button at the bottom of a page that opens a layout picker modal.
// Each option creates a new `flexible_layout` section with the chosen layout.
const LAYOUT_OPTIONS = [
  { layout: 'single',        title: '1/1',          desc: 'Una cella full-width — titolo, testo, CTA',     visual: ['full'] },
  { layout: 'two_col',       title: '6 + 6',        desc: 'Due colonne uguali — split editorial',          visual: ['half','half'] },
  { layout: 'three_col',     title: '4 + 4 + 4',    desc: 'Tre colonne — triptych modulare',                visual: ['third','third','third'] },
  { layout: 'image_overlay', title: 'BG + overlay', desc: 'Immagine full + testo + CTA sovrapposti',       visual: ['overlay'] },
];

const AddSectionPalette = ({ pageKey, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const create = async (layout) => {
    if (!pageKey) {
      window.alert('Page key non disponibile, ricarica la pagina.');
      return;
    }
    setBusy(layout);
    try {
      await adminApi.createSection({ page_key: pageKey, section_type: 'flexible_layout', layout });
      setOpen(false);
      onCreated?.();
    } catch (e) {
      window.alert('Errore creazione sezione: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-8 w-full"
        style={{
          background: 'transparent', border: '1px dashed rgba(0,201,179,0.35)',
          color: 'var(--mood-teal, #00C9B3)',
          padding: '1.25rem', borderRadius: 6,
          fontFamily: 'Inter, sans-serif', fontSize: '0.84rem',
          letterSpacing: '0.06em', cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,201,179,0.05)';
          e.currentTarget.style.borderColor = 'rgba(0,201,179,0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(0,201,179,0.35)';
        }}
        data-testid="add-section-button"
      >
        + Aggiungi sezione
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh' }}
          data-testid="add-section-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, padding: '2rem 2.4rem', width: 'min(900px, 96vw)' }}
          >
            <div style={{ marginBottom: '1.8rem' }}>
              <p style={{ fontSize: '0.66rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                          color: 'var(--mood-teal, #00C9B3)', margin: 0 }}>
                Block Palette
              </p>
              <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#FFF', fontSize: '1.4rem',
                            marginTop: 8, marginBottom: 4 }}>
                Scegli un layout
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
                Aggiungi una nuova sezione alla pagina. Imposterai contenuti, immagini e CTA subito dopo la creazione.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.layout}
                  onClick={() => create(opt.layout)}
                  disabled={!!busy}
                  style={{
                    textAlign: 'left', background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                    padding: '1.1rem 1.2rem',
                    cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => { if (!busy) e.currentTarget.style.borderColor = 'rgba(0,201,179,0.55)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  data-testid={`layout-${opt.layout}`}
                >
                  {/* Visual mini-preview */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12, height: 56 }}>
                    {opt.visual.map((v, i) => (
                      <div
                        key={i}
                        style={{
                          flex: v === 'full' ? 1 : v === 'half' ? 0.5 : v === 'third' ? 0.33 : 1,
                          background: v === 'overlay'
                            ? 'linear-gradient(135deg, rgba(0,201,179,0.18), rgba(0,0,0,0.6))'
                            : 'rgba(0,201,179,0.12)',
                          border: '1px solid rgba(0,201,179,0.3)',
                          borderRadius: 4,
                          position: 'relative',
                        }}
                      >
                        {v === 'overlay' && (
                          <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6 }}>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.6)', borderRadius: 2, marginBottom: 3, width: '70%' }} />
                            <div style={{ height: 3, background: 'rgba(0,201,179,0.7)', borderRadius: 2, width: 36 }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFF',
                                fontSize: '0.92rem', fontWeight: 500, letterSpacing: '0.02em', marginBottom: 4 }}>
                    {opt.title}
                    {busy === opt.layout && <span style={{ marginLeft: 8, color: 'var(--mood-teal,#00C9B3)' }}>…</span>}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 18, textAlign: 'right' }}>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
                          fontSize: '0.78rem', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── SectionCard ─────────────────────────────────────────────────────────
const FlexibleCellsEditor = ({ section, onSaved }) => {
  const cells = (section.settings?.cells || []);
  const [savingSlot, setSavingSlot] = useState(null);
  if (!cells.length) return null;

  const setType = async (slot, content_type) => {
    setSavingSlot(slot);
    try {
      const newCells = cells.map((c) => c.slot === slot ? { ...c, content_type } : c);
      const settings = { ...(section.settings || {}), cells: newCells };
      await adminApi.patchSection(section.id, { settings });
      onSaved?.();
    } catch (e) {
      window.alert('Errore: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSavingSlot(null);
    }
  };

  const setVideoUrl = async (slot, url) => {
    setSavingSlot(slot);
    try {
      const videos = { ...(section.settings?.videos || {}), [slot]: url || null };
      const settings = { ...(section.settings || {}), videos };
      await adminApi.patchSection(section.id, { settings });
      onSaved?.();
    } catch (e) {
      window.alert('Errore: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSavingSlot(null);
    }
  };

  const TYPES = [
    { id: 'heading', label: 'Titolo + testo + CTA' },
    { id: 'body',    label: 'Solo testo' },
    { id: 'image',   label: 'Immagine' },
    { id: 'button',  label: 'Solo CTA' },
    { id: 'video',   label: 'Video YouTube' },
  ];

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', background: 'rgba(0,201,179,0.03)',
                  border: '1px solid rgba(0,201,179,0.18)', borderRadius: 6 }}
         data-testid={`flex-cells-${section.id}`}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 500,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', margin: '0 0 12px' }}>
        Contenuto delle celle
      </p>
      {cells.map((c) => (
        <div key={c.slot} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)',
                            minWidth: 70 }}>
              {c.slot} <span style={{ opacity: 0.5 }}>· {c.span}/12</span>
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(c.slot, t.id)}
                  disabled={savingSlot === c.slot}
                  style={{
                    padding: '0.32rem 0.7rem', fontSize: '0.66rem',
                    background: c.content_type === t.id ? 'rgba(0,201,179,0.18)' : 'transparent',
                    border: `1px solid ${c.content_type === t.id ? 'rgba(0,201,179,0.55)' : 'rgba(255,255,255,0.12)'}`,
                    color: c.content_type === t.id ? '#FFF' : 'rgba(255,255,255,0.6)',
                    borderRadius: 999,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                  }}
                  data-testid={`flex-cell-${c.slot}-type-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {c.content_type === 'video' && (
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              defaultValue={section.settings?.videos?.[c.slot] || ''}
              onBlur={(e) => setVideoUrl(c.slot, e.target.value)}
              style={{
                width: '100%', marginTop: 4, marginLeft: 80, maxWidth: 'calc(100% - 80px)',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFF', padding: '0.5rem 0.7rem', fontSize: '0.82rem',
                fontFamily: 'Inter, sans-serif',
              }}
              data-testid={`flex-cell-${c.slot}-video-url`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const SectionCard = ({ section, locale, onChanged, isSelected }) => {
  const [deleting, setDeleting] = useState(false);
  const [collapsed, setCollapsed] = useState(true);   // default: closed for cleaner list
  const [toggling, setToggling] = useState(false);

  // dnd-kit sortable hook
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  if (!section.blocks.length && !section.media.length && !hasLinks(section)) return null;

  const onDelete = async () => {
    const label = (section.section_type || '').replace(/_/g, ' ');
    if (!window.confirm(`Eliminare la sezione "${label}" da questa pagina?\nL'azione è reversibile dal database (soft-delete).`)) return;
    setDeleting(true);
    try {
      await adminApi.deleteSection(section.id);
      onChanged?.();
    } catch (e) {
      window.alert('Errore eliminazione: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setDeleting(false);
    }
  };

  const onToggleVisible = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await adminApi.patchSection(section.id, { visible: !section.visible });
      onChanged?.();
    } catch (err) {
      window.alert('Errore: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setToggling(false);
    }
  };

  // When user expands the section, scroll the iframe preview to it
  const onToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!next) {
      // Opening — notify the preview iframe to scroll to this section
      try {
        const iframe = document.querySelector('iframe[data-testid="preview-iframe"]');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: 'mood-preview:scroll-to-section', sectionId: section.id },
            '*',
          );
        }
      } catch { /* noop */ }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...sectionWrap,
        ...dragStyle,
        outline: isSelected ? '2px solid rgba(0,201,179,0.55)' : 'none',
        outlineOffset: 4,
        opacity: section.visible ? (isDragging ? 0.5 : 1) : 0.45,
      }}
      data-testid={`section-${section.id}`}
    >
      <div style={{ ...sectionHead, alignItems: 'center' }}>
        {/* Drag handle */}
        <button
          {...attributes} {...listeners}
          style={{
            cursor: 'grab', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.35)', padding: 4, marginRight: 6,
            display: 'inline-flex', alignItems: 'center',
          }}
          title="Trascina per riordinare"
          data-testid={`section-drag-${section.id}`}
          aria-label="Drag handle"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
            padding: 4, display: 'inline-flex', cursor: 'pointer',
          }}
          title={collapsed ? 'Espandi e mostra in preview' : 'Comprimi'}
          data-testid={`section-collapse-${section.id}`}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        <div style={{ flex: 1, marginLeft: 6 }}>
          <p style={sectionType}>{section.section_type.replace(/_/g, ' ')}</p>
          <p style={sectionMeta}>
            Sort {section.sort_order} · {section.visible ? 'visible' : 'hidden'}
            {section.blocks.length > 0 && ` · ${section.blocks.length} blocchi`}
            {section.media.length > 0 && ` · ${section.media.length} immagini`}
          </p>
        </div>

        {/* Visibility toggle */}
        <button
          onClick={onToggleVisible}
          disabled={toggling}
          title={section.visible ? 'Nascondi sezione' : 'Mostra sezione'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.45rem', marginRight: 6,
            background: 'transparent',
            border: `1px solid ${section.visible ? 'rgba(255,255,255,0.15)' : 'rgba(255,180,162,0.35)'}`,
            color: section.visible ? 'rgba(255,255,255,0.7)' : 'rgba(255,180,162,0.85)',
            borderRadius: 6,
            cursor: toggling ? 'wait' : 'pointer',
            opacity: toggling ? 0.5 : 1,
          }}
          data-testid={`section-visibility-${section.id}`}
        >
          {section.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Elimina sezione"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '0.45rem 0.85rem', fontSize: '0.7rem',
            background: 'transparent',
            border: '1px solid rgba(255,180,162,0.3)',
            color: 'rgba(255,180,162,0.85)',
            borderRadius: 6,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
            cursor: deleting ? 'not-allowed' : 'pointer',
            opacity: deleting ? 0.5 : 1,
          }}
          data-testid={`section-delete-${section.id}`}
        >
          <Trash2 size={12} /> {deleting ? '…' : 'Elimina'}
        </button>
      </div>

      {!collapsed && (
        <>
          {section.section_type === 'flexible_layout' && (
            <FlexibleCellsEditor section={section} onSaved={onChanged} />
          )}
          {section.blocks.map(b => (
            <BlockEditor key={b.full_key} block={b} locale={locale} onSaved={onChanged} />
          ))}
          {section.media.map(s => (
            <MediaSlot key={`${section.id}-${s.slot}`} section={section} slot={s} onChange={onChanged} />
          ))}
          {hasLinks(section) && (
            <LinksEditor section={section} onSaved={onChanged} />
          )}
        </>
      )}
    </div>
  );
};

// True if the section settings expose any *_href key (CTA / link destinations).
const hasLinks = (section) => {
  const links = section?.settings?.links;
  if (!links || typeof links !== 'object') return false;
  return Object.keys(links).some((k) => /_href$|^href$|action$/.test(k));
};

// ── LinksEditor: edit CTA URL + open-in-new-tab per link key ───────────
const LinksEditor = ({ section, onSaved }) => {
  const initial = useMemo(() => ({ ...(section.settings?.links || {}) }), [section.id, JSON.stringify(section.settings?.links)]);
  const [links, setLinks] = useState(initial);
  const [busy, setBusy]   = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep local state in sync with refreshed section prop (after save)
  useEffect(() => { setLinks(initial); }, [initial]);

  const dirty = JSON.stringify(links) !== JSON.stringify(initial);

  // Collect link slots (every key ending with _href / href / _action)
  const slots = Object.keys(links).filter((k) => /_href$|^href$|action$/.test(k));
  if (slots.length === 0) return null;

  const setHref   = (k, v) => setLinks((s) => ({ ...s, [k]: v }));
  const setTarget = (k, openNewTab) => {
    const tKey = k.endsWith('_href') ? k.replace(/_href$/, '_target') : `${k}_target`;
    setLinks((s) => ({ ...s, [tKey]: openNewTab ? '_blank' : '_self' }));
  };
  const tKeyFor = (k) => (k.endsWith('_href') ? k.replace(/_href$/, '_target') : `${k}_target`);

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      // Merge with existing settings so we don't clobber blocks/media
      const newSettings = { ...(section.settings || {}), links };
      await adminApi.patchSection(section.id, { settings: newSettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      onSaved?.();
    } catch (e) {
      window.alert('Errore salvataggio link: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}
         data-testid={`section-links-${section.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 500,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: 'var(--mood-teal, #00C9B3)', margin: 0 }}>
          Link / CTA
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ fontSize:'0.7rem', color:'rgba(0,201,179,0.9)' }}>✓ salvato</span>}
          <button onClick={save} disabled={busy || !dirty}
                  style={{
                    padding: '0.45rem 0.95rem', fontSize: '0.7rem',
                    background: dirty ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.08)',
                    color: dirty ? '#000' : 'rgba(255,255,255,0.55)',
                    border: 'none', cursor: (busy || !dirty) ? 'not-allowed' : 'pointer',
                    opacity: (busy || !dirty) ? 0.55 : 1, fontWeight: 500,
                    fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
                  }}
                  data-testid={`section-links-save-${section.id}`}>
            {busy ? 'Salvataggio…' : 'Salva link'}
          </button>
        </div>
      </div>
      {slots.map((k) => {
        const open = links[tKeyFor(k)] === '_blank';
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto',
                                 gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <code style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)',
                           fontFamily: 'monospace' }}>{k}</code>
            <input
              type="text"
              value={links[k] || ''}
              onChange={(e) => setHref(k, e.target.value)}
              placeholder="/url-interno  oppure  https://..."
              style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFF', padding: '0.5rem 0.7rem', fontSize: '0.84rem',
                outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
              data-testid={`section-link-href-${section.id}-${k}`}
            />
            <label title="Apre il link in una nuova scheda"
                   style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.55)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox" checked={open}
                onChange={(e) => setTarget(k, e.target.checked)}
                style={{ accentColor: 'var(--mood-teal, #00C9B3)' }}
                data-testid={`section-link-target-${section.id}-${k}`}
              />
              nuova scheda
            </label>
          </div>
        );
      })}
    </div>
  );
};

// ── BulkTranslateButton: translate all IT content into target locale ─────
const BulkTranslateButton = ({ content, targetLocale, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  // Collect blocks with non-empty IT source and missing/empty target translation
  const candidates = [];
  for (const sec of content.sections) {
    for (const b of (sec.blocks || [])) {
      const it = (b.translations || {})['it'] || '';
      const tgt = (b.translations || {})[targetLocale] || '';
      if (it.trim() && !tgt.trim()) candidates.push(b);
    }
  }
  if (candidates.length === 0) return null;

  const runAll = async () => {
    if (!window.confirm(`Tradurrò ${candidates.length} blocchi da IT a ${targetLocale.toUpperCase()} usando Claude AI. Procedere?`)) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      setProgress({ at: i + 1, total: candidates.length, key: b.full_key });
      try {
        const res = await adminApi.translate(
          (b.translations || {})['it'],
          'it',
          targetLocale,
        );
        const translated = res?.data?.json?.translated;
        if (!translated) { fail += 1; continue; }
        const parts = b.full_key.split('.');
        const ns = parts.slice(0, 2).join('.');
        const bk = parts.slice(2).join('.');
        const merged = Object.entries(b.translations || {})
          .map(([loc, val]) => ({ locale: loc, value: val }))
          .filter(t => t.locale !== targetLocale);
        merged.push({ locale: targetLocale, value: translated });
        await adminApi.upsertBlock({
          namespace: ns,
          block_key: bk,
          block_type: b.block_type || 'body',
          source_locale: b.source_locale || 'it',
          source_value: b.source_value || (b.translations || {})['it'],
          translations: merged,
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    setProgress(null);
    window.alert(`Traduzione completata.\n✓ ${ok} riusciti\n✗ ${fail} falliti`);
    onDone?.();
  };

  return (
    <button
      onClick={runAll}
      disabled={busy}
      style={{
        padding: '0.55rem 1rem', fontSize: '0.7rem', borderRadius: 999,
        background: 'rgba(180,140,255,0.12)',
        border: '1px solid rgba(180,140,255,0.35)',
        color: 'rgba(200,170,255,0.95)',
        cursor: busy ? 'wait' : 'pointer',
        fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        opacity: busy ? 0.6 : 1,
      }}
      title={`Traduce ${candidates.length} blocchi IT → ${targetLocale.toUpperCase()} con Claude AI`}
      data-testid="bulk-translate"
    >
      <Sparkles size={12} />
      {busy && progress
        ? `Traducendo ${progress.at}/${progress.total}…`
        : `Traduci ${candidates.length} blocchi → ${targetLocale.toUpperCase()}`}
    </button>
  );
};

// ── SEOEditor: per-locale title / description / og_image ──────────────
const SEOEditor = ({ pageKey, locale, onSaved }) => {
  const [meta, setMeta] = useState({ title: '', description: '', og_image: '', og_image_url: '' });
  const [allMeta, setAllMeta] = useState({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!pageKey) return;
    adminApi.getPageSEO(pageKey)
      .then(r => {
        const all = r.data?.locale_meta || {};
        setAllMeta(all);
        const m = all[locale] || {};
        setMeta({
          title: m.title || '',
          description: m.description || '',
          og_image: m.og_image || '',
          og_image_url: m.og_image_url || '',
        });
      });
  }, [pageKey, locale]);

  const dirty = useMemo(() => {
    const src = allMeta[locale] || {};
    return (src.title || '') !== meta.title
      || (src.description || '') !== meta.description
      || (src.og_image || '') !== meta.og_image;
  }, [meta, allMeta, locale]);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.updatePageSEO(pageKey, {
        locale,
        title: meta.title,
        description: meta.description,
        og_image: meta.og_image || null,
      });
      setSavedAt(Date.now());
      setAllMeta({ ...allMeta, [locale]: { ...meta } });
      onSaved?.();
    } catch (e) {
      window.alert('Errore: ' + (e?.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '1.1rem 1.4rem', marginBottom: 24,
    }} data-testid="seo-editor">
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 500,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mood-teal, #00C9B3)',
          }}>SEO · {locale.toUpperCase()}</span>
          {dirty && <span style={{ fontSize: '0.66rem', color: '#F5A623' }}>● non salvato</span>}
          {savedAt && !dirty && <span style={{ fontSize: '0.66rem', color: 'rgba(0,201,179,0.85)' }}><Check size={10} /> salvato</span>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>{collapsed ? '▾ apri' : '▴ chiudi'}</span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.9rem' }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Title (tag &lt;title&gt;)</span>
            <input
              type="text" value={meta.title} maxLength={70}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Es. Caratteristiche — MOOD for DESIGN"
              style={{ width: '100%', marginTop: 6, padding: '0.7rem 0.9rem',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#FFF', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', outline: 'none' }}
              data-testid="seo-title"
            />
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)' }}>{meta.title.length}/70 caratteri (50-60 raccomandato)</span>
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Description (meta)</span>
            <textarea
              value={meta.description} maxLength={170} rows={3}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              placeholder="Riassunto editoriale della pagina (150-160 caratteri)."
              style={{ width: '100%', marginTop: 6, padding: '0.7rem 0.9rem',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#FFF', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', outline: 'none',
                lineHeight: 1.5, resize: 'vertical' }}
              data-testid="seo-description"
            />
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)' }}>{meta.description.length}/170 caratteri</span>
          </label>
          <div>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Open Graph Image (og:image)</span>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              {meta.og_image_url ? (
                <img src={meta.og_image_url} alt="" style={{ width: 96, height: 60, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width: 96, height: 60, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={18} color="rgba(255,255,255,0.3)" />
                </div>
              )}
              <button
                onClick={() => setPickerOpen(true)}
                style={{ padding: '0.55rem 1rem', fontSize: '0.72rem',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.85)', cursor: 'pointer', borderRadius: 2,
                  fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}
                data-testid="seo-og-pick"
              >
                {meta.og_image_url ? 'Cambia immagine' : 'Scegli immagine'}
              </button>
              {meta.og_image && (
                <button
                  onClick={() => setMeta({ ...meta, og_image: '', og_image_url: '' })}
                  style={{ padding: '0.55rem 0.8rem', fontSize: '0.72rem',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.45)', cursor: 'pointer', borderRadius: 2 }}
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
          <button
            onClick={save}
            disabled={!dirty || busy}
            style={{
              alignSelf: 'flex-start', marginTop: 8,
              padding: '0.7rem 1.4rem', fontSize: '0.76rem',
              background: 'var(--mood-teal, #00C9B3)', color: '#000', border: 'none',
              cursor: (!dirty || busy) ? 'not-allowed' : 'pointer',
              opacity: (!dirty || busy) ? 0.4 : 1,
              fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em', fontWeight: 500,
            }}
            data-testid="seo-save"
          >
            {busy ? 'Salvataggio…' : 'Salva SEO'}
          </button>
        </div>
      )}

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          currentMediaId={meta.og_image}
          onSelect={(m) => {
            setMeta({ ...meta, og_image: m.id, og_image_url: m.file_url });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ── Main: PagesEditor ───────────────────────────────────────────────────
const PagesEditor = () => {
  const [pages, setPages]       = useState([]);
  const [activePage, setActive] = useState(null);
  const [content, setContent]   = useState(null);
  const [locale, setLocale]     = useState('it');
  const [loading, setLoading]   = useState(false);
  const [refreshKey, setRefreshKey]   = useState(0);  // bump → reload preview iframe
  const [selectedSection, setSelectedSection] = useState(null);
  const mainScrollRef = useRef(null);

  useEffect(() => {
    adminApi.listPages().then(r => {
      const list = r.data?.pages || [];
      setPages(list);
      if (!activePage && list.length) setActive(list[0].key);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => {
    if (!activePage) return;
    setLoading(true);
    adminApi.getPageContent(activePage)
      .then(r => setContent(r.data))
      .finally(() => setLoading(false));
    // Trigger preview reload too (debounced via key bump)
    setRefreshKey(k => k + 1);
  };
  useEffect(reload, [activePage]);

  const visibleSections = useMemo(() => {
    if (!content) return [];
    if (activePage !== 'home') {
      return content.sections.filter(s => !['navigation', 'footer'].includes(s.section_type));
    }
    return content.sections;
  }, [content, activePage]);

  // When preview reports a section click, scroll editor to it
  const onPreviewSectionClick = (sectionId) => {
    setSelectedSection(sectionId);
    const el = document.querySelector(`[data-testid="section-${sectionId}"]`);
    if (el && mainScrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 2px rgba(0,201,179,0.5)';
      setTimeout(() => { el.style.boxShadow = 'none'; }, 1600);
    }
  };

  // ── Drag & drop reorder ────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleSections.findIndex((s) => s.id === active.id);
    const newIndex = visibleSections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(visibleSections, oldIndex, newIndex);
    // Optimistic UI update
    setContent((c) => {
      if (!c) return c;
      const reorderedIds = reordered.map((s) => s.id);
      const nextSections = [...c.sections].sort((a, b) => {
        const ai = reorderedIds.indexOf(a.id);
        const bi = reorderedIds.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      return { ...c, sections: nextSections };
    });
    try {
      await adminApi.reorderSections(reordered.map((s) => s.id));
      // No reload — keeps the optimistic order; preview refresh on next save
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert('Errore riordino: ' + (e?.response?.data?.detail || e.message));
      reload();
    }
  };

  return (
    <div data-testid="pages-editor" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)', gap: 0, height: '100vh' }}>
      {/* Left: editor */}
      <div ref={mainScrollRef} style={{ overflowY: 'auto', padding: '2rem 1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <Header
            title="Pagine"
            subtitle="Editorial operating console. Modifica testi e fotografie di ogni pagina, per ogni lingua. La preview a destra rispecchia il sito pubblico reale."
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 999 }}>
            <Languages size={13} color="rgba(255,255,255,0.45)" style={{ marginLeft: 10 }} />
            {LOCALES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLocale(l.code); setRefreshKey(k => k + 1); }}
                style={{
                  padding: '0.4rem 0.85rem', fontSize: '0.7rem', borderRadius: 999,
                  background: locale === l.code ? '#FFFFFF' : 'transparent',
                  color: locale === l.code ? '#000000' : 'rgba(255,255,255,0.65)',
                  border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  fontWeight: 500, letterSpacing: '0.04em',
                }}
                data-testid={`locale-tab-${l.code}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          {locale !== 'it' && content && (
            <BulkTranslateButton
              content={content}
              targetLocale={locale}
              onDone={reload}
            />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 22 }}>
          {/* Sidebar pages */}
          <aside style={sidebar}>
            {pages.map(p => (
              <button
                key={p.key}
                onClick={() => setActive(p.key)}
                style={{
                  ...pageItem,
                  background: activePage === p.key ? 'rgba(0,201,179,0.1)' : 'transparent',
                  borderLeft: activePage === p.key ? '2px solid var(--mood-teal, #00C9B3)' : '2px solid transparent',
                  color: activePage === p.key ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                }}
                data-testid={`sidebar-page-${p.key}`}
              >
                <div style={{ fontWeight: activePage === p.key ? 500 : 400 }}>{p.title}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>/{p.key}</div>
              </button>
            ))}
          </aside>

          {/* Main editor area */}
          <main>
            {loading && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento contenuto…</p>}
            {!loading && content && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', margin: 0, color: '#FFFFFF', fontWeight: 400 }}>
                    {content.page.title}
                  </h2>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, fontFamily: 'monospace' }}>
                    {content.page.key} · {content.page.status} · {visibleSections.length} {visibleSections.length === 1 ? 'sezione' : 'sezioni'}
                  </p>
                </div>
                <SEOEditor pageKey={activePage} locale={locale} onSaved={reload} />
                {visibleSections.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Nessun contenuto modificabile in questa pagina.
                  </p>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={visibleSections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {visibleSections.map(s => (
                      <SectionCard
                        key={s.id}
                        section={s}
                        locale={locale}
                        onChanged={reload}
                        isSelected={selectedSection === s.id}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add Section Palette */}
                <AddSectionPalette pageKey={content?.page?.key} onCreated={reload} />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Right: live preview */}
      {activePage && (
        <LivePreview
          pageKey={activePage}
          locale={locale}
          refreshKey={refreshKey}
          scrollToSectionId={selectedSection}
          onSectionClick={onPreviewSectionClick}
        />
      )}
    </div>
  );
};

// ── styles ─────────────────────────────────────────────────────────────
const sidebar = {
  position: 'sticky', top: 100, alignSelf: 'flex-start',
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8, padding: '0.5rem 0',
};
const pageItem = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '0.75rem 1.1rem', fontFamily: 'Inter, sans-serif',
  fontSize: '0.86rem', cursor: 'pointer', border: 'none', background: 'transparent',
  transition: 'all 0.15s',
};
const sectionWrap = { marginBottom: 36 };
const sectionHead = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  paddingBottom: 12, marginBottom: 18,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};
const sectionType = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.66rem',
  textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.5)', margin: 0,
};
const sectionMeta = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.66rem',
  color: 'rgba(255,255,255,0.3)', margin: '4px 0 0 0',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
const blockCard = {
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8, marginBottom: 14, overflow: 'hidden',
};
const blockHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '0.7rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
  background: 'rgba(0,0,0,0.25)',
};
const blockSlot = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--mood-teal, #00C9B3)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
};
const blockKey = {
  fontFamily: 'monospace', fontSize: '0.66rem',
  color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0',
};
const blockActions = { display: 'flex', alignItems: 'center', gap: 10 };
const statusPill = {
  fontSize: 9, fontFamily: 'Inter, sans-serif',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
const saveBtn = {
  fontSize: '0.7rem', padding: '0.45rem 0.9rem',
  background: 'rgba(0,201,179,0.12)', border: '1px solid rgba(0,201,179,0.35)',
  color: 'var(--mood-teal, #00C9B3)', borderRadius: 999, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const translateBtn = {
  fontSize: '0.66rem', padding: '0.4rem 0.8rem',
  background: 'rgba(180,140,255,0.1)', border: '1px solid rgba(180,140,255,0.3)',
  color: 'rgba(200,170,255,0.95)', borderRadius: 999, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const blockBody = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '1.1rem 1.25rem',
};
const textarea = {
  width: '100%', background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  padding: '0.85rem', color: '#FFFFFF', fontSize: '0.88rem',
  fontFamily: 'Inter, sans-serif', lineHeight: 1.55, resize: 'vertical', outline: 'none', minHeight: 80,
};
const previewWrap = {};
const previewLabel = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.62rem',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)', margin: '0 0 8px 0',
};
const previewBox = {
  background: '#000000', border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 6, padding: '1.1rem 1.25rem', minHeight: 80,
};
const emptyMedia = {
  width: '100%', padding: '2.5rem',
  background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.15)',
  borderRadius: 8, cursor: 'pointer',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 8, color: 'rgba(255,255,255,0.5)',
  fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
};

export default PagesEditor;
