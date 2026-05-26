import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, RefreshCw, ExternalLink, Eye } from 'lucide-react';

const VIEWPORTS = [
  { key: 'desktop', label: 'Desktop', width: '100%',   icon: Monitor },
  { key: 'tablet',  label: 'Tablet',  width: '820px',  icon: Tablet },
  { key: 'mobile',  label: 'Mobile',  width: '390px',  icon: Smartphone },
];

const LOCALE_PATHS = {
  audience: { it: '/dedicato-a', 'en-us': '/audience', 'en-uk': '/audience', fr: '/destine-a', de: '/zielgruppe', es: '/dirigido-a' },
  features: { it: '/caratteristiche', 'en-us': '/features', 'en-uk': '/features', fr: '/fonctionnalites', de: '/funktionen', es: '/caracteristicas' },
  pricing:  { it: '/versioni-prezzi', 'en-us': '/pricing', 'en-uk': '/pricing', fr: '/versions-prix', de: '/versionen-preise', es: '/versiones-precios' },
  training: { it: '/formazione', 'en-us': '/training', 'en-uk': '/training', fr: '/formation', de: '/schulung', es: '/formacion' },
  support:  { it: '/supporto', 'en-us': '/support', 'en-uk': '/support', fr: '/support', de: '/support', es: '/soporte' },
  login:    { it: '/accedi', 'en-us': '/login', 'en-uk': '/login', fr: '/connexion', de: '/anmelden', es: '/acceso' },
  home:     { it: '/', 'en-us': '/', 'en-uk': '/', fr: '/', de: '/', es: '/' },
};

const resolveSlug = (pageKey, locale) =>
  LOCALE_PATHS[pageKey]?.[locale] || LOCALE_PATHS[pageKey]?.['it'] || '/';

/**
 * LivePreview — embedded iframe of the REAL public site, with:
 *   - viewport mode toggle (Desktop / Tablet / Mobile) and animated width
 *   - locale-aware URL
 *   - reload-on-save trigger via `refreshKey`
 *   - scrollToSection via postMessage
 *   - "Open in new tab" external link
 *
 * Props:
 *   pageKey: string      (audience, features, …, home)
 *   locale: string       (it, en-us, …)
 *   refreshKey: number   (incrementing key — bump it to force iframe reload)
 *   scrollToSectionId: string | null  (set this to scroll preview to a section)
 *   onSectionClick: (sectionId) => void  (preview reports section clicks)
 */
const LivePreview = ({
  pageKey, locale, refreshKey = 0,
  scrollToSectionId = null,
  onSectionClick,
}) => {
  const iframeRef = useRef(null);
  const [viewport, setViewport]   = useState('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [ready, setReady]         = useState(false);

  const slug = resolveSlug(pageKey, locale);
  const baseUrl = window.location.origin + slug;

  // Reload iframe whenever refreshKey or slug changes
  useEffect(() => {
    setReady(false);
    setReloadKey((k) => k + 1);
  }, [refreshKey, slug]);

  // Listen for postMessage from iframe
  useEffect(() => {
    const onMsg = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'mood-preview:ready') {
        setReady(true);
      }
      if (data.type === 'mood-preview:section-clicked' && data.sectionId) {
        onSectionClick?.(data.sectionId);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onSectionClick]);

  // Send scroll command when section selected
  useEffect(() => {
    if (!scrollToSectionId || !ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        { type: 'mood-preview:scroll-to-section', sectionId: scrollToSectionId },
        '*',
      );
    } catch { /* noop */ }
  }, [scrollToSectionId, ready, reloadKey]);

  const vp = VIEWPORTS.find((v) => v.key === viewport) || VIEWPORTS[0];

  return (
    <div style={wrap} data-testid="live-preview">
      {/* Toolbar */}
      <div style={toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={13} color="var(--mood-teal, #00C9B3)" />
          <span style={lbl}>Live preview</span>
          <span style={pathPill}>{slug}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 999 }}>
          {VIEWPORTS.map((v) => {
            const Icon = v.icon;
            const active = viewport === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setViewport(v.key)}
                title={v.label}
                style={vpBtn(active)}
                data-testid={`preview-viewport-${v.key}`}
              >
                <Icon size={13} strokeWidth={1.7} />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setReloadKey(k => k + 1)} style={iconBtnStyle} title="Reload" data-testid="preview-reload">
            <RefreshCw size={13} strokeWidth={1.6} />
          </button>
          <a href={baseUrl} target="_blank" rel="noopener noreferrer" style={iconBtnStyle} title="Open in new tab" data-testid="preview-open-external">
            <ExternalLink size={13} strokeWidth={1.6} />
          </a>
        </div>
      </div>

      {/* Frame container with animated width */}
      <div style={frameContainer}>
        <div
          style={{
            ...frameInner,
            width: vp.width,
            maxWidth: vp.width === '100%' ? '100%' : vp.width,
          }}
        >
          <iframe
            ref={iframeRef}
            key={reloadKey}
            src={`${baseUrl}?_preview=1`}
            title={`Live preview · ${pageKey}`}
            style={iframeStyle}
            data-testid="preview-iframe"
          />
          {!ready && (
            <div style={overlay} data-testid="preview-loading">
              <div style={spinner} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// styles
const wrap = {
  position: 'sticky', top: 0,
  background: '#000000', borderLeft: '1px solid rgba(255,255,255,0.05)',
  height: '100vh',
  display: 'grid', gridTemplateRows: 'auto 1fr',
};
const toolbar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.75rem 1.1rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  background: 'rgba(255,255,255,0.02)',
};
const lbl = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 500,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.85)',
};
const pathPill = {
  fontFamily: 'monospace', fontSize: '0.66rem',
  color: 'rgba(255,255,255,0.5)',
  padding: '2px 8px', borderRadius: 999,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
};
const vpBtn = (active) => ({
  width: 30, height: 28, borderRadius: 999,
  background: active ? '#FFFFFF' : 'transparent',
  color: active ? '#000000' : 'rgba(255,255,255,0.6)',
  border: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
});
const iconBtnStyle = {
  width: 30, height: 28, borderRadius: 999,
  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none',
};
const frameContainer = {
  display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  padding: '1.2rem',
  overflow: 'auto',
  background: '#0A0A0A',
};
const frameInner = {
  height: 'calc(100vh - 110px)',
  transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  background: '#000',
  borderRadius: 10, overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.06)',
  position: 'relative',
};
const iframeStyle = {
  width: '100%', height: '100%', border: 'none', display: 'block',
  background: '#000',
};
const overlay = {
  position: 'absolute', inset: 0,
  background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const spinner = {
  width: 26, height: 26, borderRadius: '50%',
  border: '2px solid rgba(0,201,179,0.2)',
  borderTopColor: 'var(--mood-teal, #00C9B3)',
  animation: 'mood-spin 0.7s linear infinite',
};

// inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('mood-preview-keyframe')) {
  const style = document.createElement('style');
  style.id = 'mood-preview-keyframe';
  style.textContent = '@keyframes mood-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export default LivePreview;
