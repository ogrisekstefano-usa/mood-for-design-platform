import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Globe } from 'lucide-react';
import { adminApi } from '../adminApi';

/**
 * FooterEditor — minimal CMS for the global footer.
 *
 * Manages 4 logical groups (each per-locale via the language dropdown):
 *   1. Brand:    copyright text
 *   2. Nav:      column heading + list of {label, href} link entries
 *   3. Legal:    column heading + list of {label, href} link entries
 *   4. Social:   list of {icon, href, label} entries
 *      Supported icons: instagram | linkedin | twitter | x | youtube |
 *                       facebook | pinterest
 *
 * All text is stored in editorial_blocks per locale; the structural
 * shape (which icons / how many rows / their href) lives in
 * cms_sections.settings (locale-independent).
 */
const SOCIAL_TYPES = ['instagram', 'linkedin', 'twitter', 'x', 'youtube', 'facebook', 'pinterest'];

const FooterEditor = ({ locales = ['it','en-us','en-uk','fr','de','es'] }) => {
  const [locale, setLocale] = useState('it');
  const [data, setData]     = useState(null);
  const [busy, setBusy]     = useState(false);
  const [saved, setSaved]   = useState(false);

  const load = async (loc = locale) => {
    setBusy(true);
    try {
      const r = await adminApi.getFooter(loc);
      const settings = r.data?.settings || {};
      const values   = r.data?.values   || {};
      // Hydrate structural shape with bootstrap if empty
      const bootstrap = ensureShape(settings);
      setData({ settings: bootstrap, values });
    } finally { setBusy(false); }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);
  useEffect(() => { load(locale); /* eslint-disable-line */ }, [locale]);

  if (!data) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: '2rem' }}>Caricamento footer…</div>;

  const { settings, values } = data;
  const setValueAt = (key, v) => setData({ ...data, values: { ...values, [key]: v }, _dirty: true });
  const setLinkAt = (group, idx, patch) => {
    const arr = (settings[group] || []).slice();
    arr[idx] = { ...arr[idx], ...patch };
    setData({ ...data, settings: { ...settings, [group]: arr }, _dirty: true });
  };
  const addLink = (group) => {
    const arr = (settings[group] || []).slice();
    const n = arr.length + 1;
    const key = `${group}_${n}`;
    arr.push({ key, href: '#', label_block: `site.footer.${group}.${key}`, visible: true, isHeading: false, fallback: '' });
    setData({ ...data, settings: { ...settings, [group]: arr }, _dirty: true });
  };
  const removeLink = (group, idx) => {
    const arr = (settings[group] || []).slice();
    arr.splice(idx, 1);
    setData({ ...data, settings: { ...settings, [group]: arr }, _dirty: true });
  };
  const setSocialAt = (idx, patch) => {
    const arr = (settings.social || []).slice();
    arr[idx] = { ...arr[idx], ...patch };
    setData({ ...data, settings: { ...settings, social: arr }, _dirty: true });
  };
  const addSocial = () => {
    const arr = (settings.social || []).slice();
    arr.push({ key: `social_${arr.length + 1}`, icon: 'instagram', href: 'https://', visible: true });
    setData({ ...data, settings: { ...settings, social: arr }, _dirty: true });
  };
  const removeSocial = (idx) => {
    const arr = (settings.social || []).slice();
    arr.splice(idx, 1);
    setData({ ...data, settings: { ...settings, social: arr }, _dirty: true });
  };

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      // Collect only the editable text values
      const valuesToWrite = {};
      const blocksMap = settings.blocks || {};
      Object.values(blocksMap).forEach((k) => { if (k && values[k] !== undefined) valuesToWrite[k] = values[k]; });
      [...(settings.links || []), ...(settings.legal || [])].forEach((L) => {
        if (L.label_block && values[L.label_block] !== undefined) valuesToWrite[L.label_block] = values[L.label_block];
      });
      await adminApi.updateFooter({ settings, values: valuesToWrite }, locale);
      setSaved(true);
      setData({ ...data, _dirty: false });
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      window.alert('Errore salvataggio footer: ' + (e?.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="footer-editor" style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.6rem' }}>
        <h2 style={h2}>Footer del sito</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={14} color="rgba(255,255,255,0.5)" />
          <select value={locale} onChange={(e) => setLocale(e.target.value)} style={selectStyle} data-testid="footer-locale">
            {locales.map((l) => <option key={l} value={l} style={{ background:'#0a0a0a' }}>{l.toUpperCase()}</option>)}
          </select>
          {data._dirty && <span style={{ fontSize:'0.7rem', color:'#F5A623' }}>● non salvato</span>}
          {saved && <span style={{ fontSize:'0.7rem', color:'rgba(0,201,179,0.9)' }}>✓ salvato</span>}
        </div>
      </div>

      {/* Brand block */}
      <Section title="Brand · Copyright">
        <TextField
          label="Copyright (es. © 2026 MOOD for DESIGN. All rights reserved.)"
          value={values[settings.blocks?.copyright] || ''}
          onChange={(v) => setValueAt(settings.blocks.copyright, v)}
          testid="footer-copyright"
        />
      </Section>

      {/* Nav column */}
      <Section title="Colonna “Esplora” (titolo + voci)">
        <LinkList
          group="links" links={settings.links || []} values={values}
          onSetField={setValueAt}
          onSetLink={(idx, patch) => setLinkAt('links', idx, patch)}
          onAdd={() => addLink('links')}
          onRemove={(idx) => removeLink('links', idx)}
        />
      </Section>

      {/* Legal column */}
      <Section title="Colonna “Legale”">
        <LinkList
          group="legal" links={settings.legal || []} values={values}
          onSetField={setValueAt}
          onSetLink={(idx, patch) => setLinkAt('legal', idx, patch)}
          onAdd={() => addLink('legal')}
          onRemove={(idx) => removeLink('legal', idx)}
        />
      </Section>

      {/* Social */}
      <Section title="Social network">
        {(settings.social || []).map((s, idx) => (
          <div key={s.key || idx} style={socialRow} data-testid={`footer-social-${idx}`}>
            <select value={s.icon} onChange={(e) => setSocialAt(idx, { icon: e.target.value })} style={smallSelect}>
              {SOCIAL_TYPES.map((t) => <option key={t} value={t} style={{ background:'#0a0a0a' }}>{t}</option>)}
            </select>
            <input
              type="url" placeholder="https://…" value={s.href || ''}
              onChange={(e) => setSocialAt(idx, { href: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => removeSocial(idx)} style={iconBtn} title="Rimuovi">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={addSocial} style={addBtn} data-testid="footer-add-social">
          <Plus size={14} /> Aggiungi social
        </button>
      </Section>

      <div style={{ marginTop: '2rem', display: 'flex', gap: 12 }}>
        <button onClick={save} disabled={busy || !data._dirty} style={{
          padding: '0.75rem 1.6rem', fontSize: '0.82rem',
          background: 'var(--mood-teal, #00C9B3)', color: '#000', border: 'none',
          cursor: (busy || !data._dirty) ? 'not-allowed' : 'pointer',
          opacity: (busy || !data._dirty) ? 0.4 : 1,
          fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em', fontWeight: 500,
        }} data-testid="footer-save">
          {busy ? 'Salvataggio…' : `Salva ${locale.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
};

// ── helpers (inline subcomponents) ─────────────────────────────────────
const Section = ({ title, children }) => (
  <div style={{ marginBottom: '1.8rem', padding: '1rem 1.2rem',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <p style={{ fontFamily:'Inter, sans-serif', fontSize:'0.72rem', fontWeight:500,
                letterSpacing:'0.18em', textTransform:'uppercase',
                color:'var(--mood-teal, #00C9B3)', marginBottom:'1rem' }}>
      {title}
    </p>
    {children}
  </div>
);

const TextField = ({ label, value, onChange, testid }) => (
  <label style={{ display: 'block', marginBottom: '0.8rem' }}>
    {label && <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)',
                              letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>}
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
           style={{ ...inputStyle, marginTop: 6, width: '100%' }} data-testid={testid} />
  </label>
);

const LinkList = ({ group, links, values, onSetField, onSetLink, onAdd, onRemove }) => (
  <>
    {links.map((L, idx) => (
      <div key={L.key || idx} style={linkRow}>
        {L.isHeading && (
          <span style={{ fontSize: '0.62rem', color: 'var(--mood-teal, #00C9B3)',
                         letterSpacing: '0.16em', textTransform: 'uppercase',
                         alignSelf: 'center', minWidth: 60 }}>
            Titolo
          </span>
        )}
        <input
          type="text" placeholder="Etichetta"
          value={values[L.label_block] || L.fallback || ''}
          onChange={(e) => onSetField(L.label_block, e.target.value)}
          style={{ ...inputStyle, flex: 2 }}
          data-testid={`footer-${group}-label-${idx}`}
        />
        {!L.isHeading && (
          <input
            type="text" placeholder="/url o https://"
            value={L.href || ''}
            onChange={(e) => onSetLink(idx, { href: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
            data-testid={`footer-${group}-href-${idx}`}
          />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem',
                        color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!L.isHeading}
                 onChange={(e) => onSetLink(idx, { isHeading: e.target.checked })}
                 style={{ accentColor: 'var(--mood-teal, #00C9B3)' }} />
          titolo
        </label>
        <button onClick={() => onRemove(idx)} style={iconBtn} title="Rimuovi">
          <Trash2 size={14} />
        </button>
      </div>
    ))}
    <button onClick={onAdd} style={addBtn} data-testid={`footer-add-${group}`}>
      <Plus size={14} /> Aggiungi voce
    </button>
  </>
);

// Bootstrap a minimal shape so the editor always has something to render
const ensureShape = (settings) => {
  const out = { ...settings };
  out.blocks = out.blocks || {};
  if (!out.blocks.copyright) out.blocks.copyright = 'site.footer.copyright';
  if (!out.links || out.links.length === 0) {
    out.links = [
      { key: 'nav_heading', isHeading: true, label_block: 'site.footer.links.nav_heading', fallback: 'Esplora', visible: true },
      { key: 'audience',    href: '/dedicato-a',     label_block: 'site.footer.links.audience',    fallback: 'Dedicato a',     visible: true },
      { key: 'features',    href: '/caratteristiche', label_block: 'site.footer.links.features',   fallback: 'Caratteristiche', visible: true },
      { key: 'pricing',     href: '/versioni-prezzi', label_block: 'site.footer.links.pricing',    fallback: 'Versioni e Prezzi', visible: true },
      { key: 'training',    href: '/formazione',      label_block: 'site.footer.links.training',   fallback: 'Formazione', visible: true },
    ];
  }
  if (!out.legal || out.legal.length === 0) {
    out.legal = [
      { key: 'legal_heading', isHeading: true, label_block: 'site.footer.legal.legal_heading', fallback: 'Legale', visible: true },
      { key: 'privacy',  href: '/privacy',  label_block: 'site.footer.legal.privacy',  fallback: 'Privacy Policy',  visible: true },
      { key: 'terms',    href: '/terms',    label_block: 'site.footer.legal.terms',    fallback: 'Termini di Servizio', visible: true },
      { key: 'cookies',  href: '/cookies',  label_block: 'site.footer.legal.cookies',  fallback: 'Cookie Policy',  visible: true },
    ];
  }
  if (!out.social) {
    out.social = [
      { key: 'instagram', icon: 'instagram', href: '', visible: true },
      { key: 'linkedin',  icon: 'linkedin',  href: '', visible: true },
    ];
  }
  return out;
};

// Styles
const panel = { padding: '0', color: '#FFF', fontFamily: 'Inter, sans-serif' };
const h2 = { fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', margin: 0, fontWeight: 400, color: '#FFF' };
const selectStyle = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#FFF', padding: '0.4rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer' };
const smallSelect = { ...selectStyle, padding: '0.45rem 0.7rem', fontSize: '0.74rem', minWidth: 120 };
const inputStyle = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                     color: '#FFF', padding: '0.55rem 0.75rem', fontSize: '0.85rem',
                     outline: 'none', fontFamily: 'Inter, sans-serif' };
const linkRow = { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' };
const socialRow = linkRow;
const iconBtn = { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.5)', padding: '0.45rem', cursor: 'pointer' };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6,
                 background: 'transparent', border: '1px solid rgba(0,201,179,0.4)',
                 color: 'var(--mood-teal, #00C9B3)', padding: '0.5rem 0.9rem',
                 cursor: 'pointer', fontSize: '0.76rem', marginTop: 4 };

export default FooterEditor;
