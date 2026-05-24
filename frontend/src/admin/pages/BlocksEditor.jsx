import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../adminApi';
import { Save, X, Check } from 'lucide-react';

const NAMESPACES = [
  { key: 'site.home',   label: 'Homepage' },
  { key: 'site.nav',    label: 'Navigation' },
  { key: 'site.footer', label: 'Footer' },
  { key: 'site.login',  label: 'Login' },
];

const LOCALES = ['it', 'en-us', 'fr', 'de', 'es'];

const BlocksEditor = () => {
  const [namespace, setNamespace] = useState(NAMESPACES[0].key);
  const [blocks, setBlocks]       = useState([]);
  const [selected, setSelected]   = useState(null);
  const [draft, setDraft]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [savedAt, setSavedAt]     = useState(null);
  const [enabledLocales, setEnabledLocales] = useState(LOCALES);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    adminApi.locales().then((r) => {
      if (r.data?.enabled?.length) setEnabledLocales(r.data.enabled);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    adminApi.listBlocks(namespace).then((r) => {
      setBlocks(r.data?.blocks || []);
      setSelected(null); setDraft(null);
    });
  }, [namespace]);

  const filtered = useMemo(() => {
    if (!search) return blocks;
    const s = search.toLowerCase();
    return blocks.filter((b) => b.block_key.toLowerCase().includes(s) || (b.source_value || '').toLowerCase().includes(s));
  }, [blocks, search]);

  const selectBlock = (b) => {
    setSelected(b);
    const tx = Object.fromEntries(LOCALES.map((l) => [l, '']));
    (b.translations || []).forEach((t) => { tx[t.locale] = t.value || ''; });
    setDraft({ ...b, translationsMap: tx });
    setSavedAt(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const translations = Object.entries(draft.translationsMap)
        .filter(([loc, val]) => enabledLocales.includes(loc) && val !== null && val !== undefined)
        .map(([locale, value]) => ({ locale, value, status: 'manual' }));
      await adminApi.upsertBlock({
        namespace: draft.namespace,
        block_key: draft.block_key,
        block_type: draft.block_type,
        source_locale: draft.source_locale,
        source_value: draft.translationsMap[draft.source_locale] || draft.source_value,
        notes: draft.notes,
        translations,
      });
      // refresh
      const r = await adminApi.listBlocks(namespace);
      setBlocks(r.data?.blocks || []);
      setSavedAt(Date.now());
    } catch (e) {
      window.alert('Save failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="blocks-editor">
      <Header title="Editorial Blocks" subtitle="All text shown on the public website. Multilingual. Versioned." />

      {/* Namespace tabs */}
      <div className="flex gap-2 mb-6 flex-wrap" data-testid="namespace-tabs">
        {NAMESPACES.map((ns) => (
          <button
            key={ns.key}
            onClick={() => setNamespace(ns.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: 999,
              background: namespace === ns.key ? '#00C9B3' : 'transparent',
              color:      namespace === ns.key ? '#000000' : 'rgba(255,255,255,0.75)',
              border: `1px solid ${namespace === ns.key ? '#00C9B3' : 'rgba(255,255,255,0.12)'}`,
              fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
            }}
            data-testid={`ns-${ns.key}`}
          >
            {ns.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '2rem' }}>
        {/* Block list */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }}>
          <input
            type="text"
            placeholder="Search keys or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.6rem 0.8rem', color: '#FFFFFF', fontSize: '0.84rem', marginBottom: '1rem', outline: 'none' }}
            data-testid="blocks-search"
          />
          {filtered.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>No blocks.</p>}
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => selectBlock(b)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.75rem 0.9rem', marginBottom: '0.4rem',
                background: selected?.id === b.id ? 'rgba(0,201,179,0.10)' : 'transparent',
                border: `1px solid ${selected?.id === b.id ? 'rgba(0,201,179,0.35)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 6, cursor: 'pointer', color: '#FFFFFF',
              }}
              data-testid={`block-row-${b.block_key}`}
            >
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', letterSpacing: '0.06em', color: '#00C9B3' }}>{b.block_key}</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 1.3, maxHeight: 38, overflow: 'hidden' }}>
                {b.source_value}
              </p>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '1.5rem', minHeight: 400 }}>
          {!draft ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.92rem', textAlign: 'center', paddingTop: '4rem' }}>
              Select a block on the left to edit.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.68rem', color: '#00C9B3', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    {draft.namespace}
                  </p>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', color: '#FFFFFF', marginTop: 4 }}>
                    {draft.block_key}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {draft.block_type} · source locale: <strong>{draft.source_locale}</strong>
                  </p>
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn-pill-teal"
                  style={{ padding: '0.6rem 1.1rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  data-testid="save-block"
                >
                  <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {savedAt && (
                <p style={{ color: '#00C9B3', fontSize: '0.78rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Saved
                </p>
              )}

              <div className="space-y-4">
                {LOCALES.filter((l) => enabledLocales.includes(l)).map((loc) => (
                  <div key={loc}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        {loc} {loc === draft.source_locale && <em style={{ color: '#00C9B3' }}>(source)</em>}
                      </span>
                    </div>
                    <textarea
                      value={draft.translationsMap[loc] || ''}
                      onChange={(e) => setDraft({ ...draft, translationsMap: { ...draft.translationsMap, [loc]: e.target.value } })}
                      rows={(draft.translationsMap[loc] || '').length > 80 ? 4 : 2}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
                        padding: '0.7rem 0.9rem', color: '#FFFFFF',
                        fontFamily: 'Montserrat, sans-serif', fontSize: '0.92rem',
                        resize: 'vertical', outline: 'none',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#00C9B3')}
                      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                      data-testid={`block-tx-${loc}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const Header = ({ title, subtitle }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.2rem', color: '#FFFFFF', lineHeight: 1.1 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', marginTop: 8, fontFamily: 'Montserrat, sans-serif' }}>{subtitle}</p>}
  </div>
);

export default BlocksEditor;
