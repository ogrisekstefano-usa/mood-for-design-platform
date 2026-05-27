import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PreviewBridge — when the public site is embedded in the admin LivePreview
 * iframe, it listens for postMessage commands from the parent (admin) to:
 *   - scroll to a specific section
 *   - send back click events for bidirectional sync
 *
 * The component renders nothing visible. It only activates when window.parent
 * is different from window (i.e. when embedded in iframe).
 */
const PreviewBridge = () => {
  const location = useLocation();

  // Detect embedded mode + signal ready
  useEffect(() => {
    const isEmbedded = window.parent && window.parent !== window;
    if (!isEmbedded) return;

    try {
      window.parent.postMessage(
        { type: 'mood-preview:ready', path: location.pathname },
        '*',
      );
    } catch { /* parent might be cross-origin in some setups */ }

    // Track currently highlighted element (persistent ring until next click)
    let currentHighlight = null;
    const clearHighlight = () => {
      if (currentHighlight) {
        currentHighlight.style.outline = '';
        currentHighlight.style.outlineOffset = '';
        currentHighlight.style.boxShadow = '';
        currentHighlight = null;
      }
    };
    const setHighlight = (el) => {
      clearHighlight();
      if (!el) return;
      el.style.transition = 'outline 0.25s ease, box-shadow 0.25s ease';
      el.style.outline = '2px solid rgba(0,201,179,0.85)';
      el.style.outlineOffset = '-2px';
      el.style.boxShadow = '0 0 0 6px rgba(0,201,179,0.18), 0 18px 60px rgba(0,201,179,0.22)';
      currentHighlight = el;
      // Subtle pulse on entry
      el.animate(
        [
          { boxShadow: '0 0 0 12px rgba(0,201,179,0.28), 0 18px 60px rgba(0,201,179,0.32)' },
          { boxShadow: '0 0 0 6px rgba(0,201,179,0.18), 0 18px 60px rgba(0,201,179,0.22)' },
        ],
        { duration: 700, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      );
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'mood-preview:scroll-to-section') {
        const el = document.querySelector(`[data-section-id="${data.sectionId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setHighlight(el);
        }
      }
      if (data.type === 'mood-preview:clear-highlight') {
        clearHighlight();
      }
    };
    window.addEventListener('message', onMessage);

    // Visual: outline section on hover when embedded
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      [data-section-id] { transition: box-shadow 0.18s ease; cursor: pointer; }
      [data-section-id]:hover { box-shadow: inset 0 0 0 2px rgba(0,201,179,0.35) !important; }
    `;
    document.head.appendChild(styleEl);

    // Forward section clicks to admin (capture phase, intercept links)
    const onClick = (e) => {
      const sec = e.target.closest('[data-section-id]');
      if (!sec) return;
      // Block link navigation inside the preview iframe
      const linkLike = e.target.closest('a, button[type="submit"]');
      if (linkLike) {
        e.preventDefault();
        e.stopPropagation();
      }
      setHighlight(sec);
      try {
        window.parent.postMessage(
          { type: 'mood-preview:section-clicked',
            sectionId: sec.getAttribute('data-section-id'),
            sectionType: sec.getAttribute('data-section-type') },
          '*',
        );
      } catch { /* noop */ }
    };
    document.addEventListener('click', onClick, true);  // capture phase

    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
      clearHighlight();
      try { styleEl.remove(); } catch {}
    };
  }, [location.pathname]);

  // Add a small visual indicator (top-right corner) so the user knows
  // they're seeing the preview embedded view, not the live site.
  const isEmbedded = window.parent && window.parent !== window;
  if (!isEmbedded) return null;
  return (
    <div
      style={{
        position: 'fixed', top: 10, right: 10, zIndex: 9999,
        background: 'rgba(0,201,179,0.15)', color: '#00C9B3',
        fontFamily: 'Inter, sans-serif', fontSize: 9,
        padding: '4px 9px', borderRadius: 999,
        border: '1px solid rgba(0,201,179,0.4)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}
    >
      Live Preview
    </div>
  );
};

export default PreviewBridge;
