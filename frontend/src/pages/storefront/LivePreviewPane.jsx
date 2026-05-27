/**
 * LivePreviewPane — ITER157.D · Visual Editor side-by-side preview.
 *
 * Renders an iframe of the public landing in `?editorial=preview` mode
 * and wires a postMessage bridge with `EditorialBridge` (on the public
 * page).
 *
 * Capabilities
 *   • Receives `{type:'mfd:section-click', section_type}` → calls
 *     `onSectionClick(section_type)` so the editor opens that band.
 *   • Sends `{type:'mfd:scroll-to', section_type}` when the parent
 *     wants the preview to scroll to a specific section.
 *   • Auto-reloads on `refreshKey` bump (called after Publish).
 *   • Viewport toggle: desktop / tablet / mobile.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, RefreshCw, ExternalLink } from 'lucide-react';
import './storefrontStudio.css';

const VIEWPORTS = {
  desktop: { w: '100%',  label: 'Desktop' },
  tablet:  { w: '820px', label: 'Tablet'  },
  mobile:  { w: '390px', label: 'Mobile'  },
};

const LivePreviewPane = ({ pageKey = 'home', refreshKey = 0, onSectionClick, selectedSectionType }) => {
  const iframeRef = useRef(null);
  const [viewport, setViewport] = useState('desktop');
  const [bridgeReady, setBridgeReady] = useState(false);

  // Pages that are NOT a public route (e.g. `navigation`, `footer`)
  // → fall back to / so the editor still has a meaningful preview.
  const previewUrl = useMemo(() => {
    const map = {
      home:           '/',
      navigation:     '/',                // header lives on every page
      footer:         '/',
      projects:       '/projects',
      start_project:  '/begin-journey',
    };
    return (map[pageKey] || '/') + '?editorial=preview&_r=' + refreshKey;
  }, [pageKey, refreshKey]);

  // Listen for postMessage from the iframe.
  useEffect(() => {
    const onMsg = (ev) => {
      const data = ev?.data || {};
      if (data.source !== 'mfd-editorial') return;
      if (data.type === 'mfd:bridge-ready') {
        setBridgeReady(true);
      } else if (data.type === 'mfd:section-click' && data.section_type) {
        onSectionClick?.(data.section_type);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onSectionClick]);

  // When user picks a band in the editor → scroll preview to it.
  useEffect(() => {
    if (!bridgeReady || !selectedSectionType) return;
    try {
      iframeRef.current?.contentWindow?.postMessage({
        source: 'mfd-editor',
        type:   'mfd:scroll-to',
        section_type: selectedSectionType,
      }, '*');
    } catch (_) { /* noop */ }
  }, [selectedSectionType, bridgeReady, refreshKey]);

  const handleReload = () => {
    try { iframeRef.current.src = previewUrl; } catch (_) { /* noop */ }
  };

  return (
    <div className="ss-preview" data-testid="ss-live-preview">
      <header className="ss-preview__head">
        <div className="ss-preview__viewport" role="group" aria-label="Viewport">
          {Object.entries(VIEWPORTS).map(([k, v]) => {
            const Icon = k === 'desktop' ? Monitor : k === 'tablet' ? Tablet : Smartphone;
            return (
              <button key={k} type="button"
                className="ss-preview__vp" data-active={viewport === k}
                onClick={() => setViewport(k)}
                data-testid={`ss-preview-vp-${k}`}
                aria-label={v.label}
              ><Icon size={13} strokeWidth={1.6} /></button>
            );
          })}
        </div>
        <span className="ss-preview__status">
          {bridgeReady ? '● Bridge attivo · click sezione per editare' : '○ Caricamento preview…'}
        </span>
        <div className="ss-preview__actions">
          <button type="button" className="ss-preview__btn" onClick={handleReload}
            title="Ricarica preview" data-testid="ss-preview-reload">
            <RefreshCw size={12} strokeWidth={1.7} />
          </button>
          <a href={previewUrl.replace('&_r=' + refreshKey, '')} target="_blank" rel="noopener noreferrer"
            className="ss-preview__btn" title="Apri in nuova scheda" data-testid="ss-preview-open">
            <ExternalLink size={12} strokeWidth={1.7} />
          </a>
        </div>
      </header>
      <div className="ss-preview__frame-wrap">
        <div className="ss-preview__frame-inner" style={{ width: VIEWPORTS[viewport].w }}>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Live preview"
            data-testid="ss-preview-iframe"
            className="ss-preview__iframe"
          />
        </div>
      </div>
    </div>
  );
};

export default LivePreviewPane;
