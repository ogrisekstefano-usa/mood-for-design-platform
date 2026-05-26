import React, { useEffect, useMemo, useState } from 'react';
import { Save, Check, AlertCircle, Image as ImageIcon, Languages, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../adminApi';
import MediaPicker from '../components/MediaPicker';

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
const BlockEditor = ({ block, locale, onSaved }) => {
  const initial = (block.translations && block.translations[locale]) || '';
  const [value, setValue]   = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('idle');  // 'idle' | 'saved' | 'error'

  useEffect(() => { setValue(initial); setStatus('idle'); }, [initial, locale]);

  const previewStyle = PREVIEW_STYLE[block.block_type] || PREVIEW_STYLE.default;
  const dirty = value !== initial;
  const minLines = (block.block_type === 'body') ? 4 : 2;

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

  return (
    <div style={blockCard} data-testid={`block-${block.full_key}`}>
      <div style={blockHeader}>
        <div>
          <p style={blockSlot}>{block.slot}</p>
          <p style={blockKey}>{block.full_key}</p>
        </div>
        <div style={blockActions}>
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
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={minLines}
          style={textarea}
          placeholder={`Scrivi in ${locale.toUpperCase()}…`}
          data-testid={`block-input-${block.full_key}`}
        />
        {/* Preview */}
        <div style={previewWrap}>
          <p style={previewLabel}>Anteprima · {locale.toUpperCase()}</p>
          <div style={previewBox}>
            {block.block_type === 'cta' ? (
              <span style={previewStyle}>{value || '—'}</span>
            ) : (
              <div style={previewStyle}>{value || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MediaSlot: thumbnail + "Change photo" + dimensions/usages ───────────
const MediaSlot = ({ section, slot, onChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
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
      </div>

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          currentMediaId={slot.media_id}
          onSelect={async (newMedia) => {
            try {
              await adminApi.setSectionMedia(section.id, slot.slot, newMedia.id);
              setPickerOpen(false);
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

// ── SectionCard ─────────────────────────────────────────────────────────
const SectionCard = ({ section, locale, onChanged }) => {
  if (!section.blocks.length && !section.media.length) return null;
  return (
    <div style={sectionWrap} data-testid={`section-${section.id}`}>
      <div style={sectionHead}>
        <div>
          <p style={sectionType}>{section.section_type.replace(/_/g, ' ')}</p>
          <p style={sectionMeta}>Sort {section.sort_order} · {section.visible ? <><Eye size={10} /> visible</> : <><EyeOff size={10} /> hidden</>}</p>
        </div>
      </div>
      {section.blocks.map(b => (
        <BlockEditor key={b.full_key} block={b} locale={locale} onSaved={onChanged} />
      ))}
      {section.media.map(s => (
        <MediaSlot key={`${section.id}-${s.slot}`} section={section} slot={s} onChange={onChanged} />
      ))}
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
  };
  useEffect(reload, [activePage]);

  const visibleSections = useMemo(() => {
    if (!content) return [];
    // Skip navigation/footer when on non-home pages to reduce noise (still editable from home)
    if (activePage !== 'home') {
      return content.sections.filter(s => !['navigation', 'footer'].includes(s.section_type));
    }
    return content.sections;
  }, [content, activePage]);

  return (
    <div data-testid="pages-editor">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <Header
          title="Pagine"
          subtitle="Editorial operating console. Modifica testi e fotografie di ogni pagina, per ogni lingua."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 999 }}>
          <Languages size={13} color="rgba(255,255,255,0.45)" style={{ marginLeft: 10 }} />
          {LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28 }}>
        {/* Sidebar */}
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

        {/* Main */}
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
              {visibleSections.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nessun contenuto modificabile in questa pagina.
                </p>
              )}
              {visibleSections.map(s => (
                <SectionCard key={s.id} section={s} locale={locale} onChanged={reload} />
              ))}
            </>
          )}
        </main>
      </div>
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
