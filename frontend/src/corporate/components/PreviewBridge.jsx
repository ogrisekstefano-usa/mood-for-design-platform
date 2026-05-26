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

    const onMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'mood-preview:scroll-to-section') {
        const el = document.querySelector(`[data-section-id="${data.sectionId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Subtle glow animation
          el.style.transition = 'box-shadow 0.4s ease';
          el.style.boxShadow = 'inset 0 0 0 2px rgba(0,201,179,0.55)';
          setTimeout(() => { el.style.boxShadow = 'none'; }, 1600);
        }
      }
    };
    window.addEventListener('message', onMessage);

    // Forward section clicks to admin
    const onClick = (e) => {
      const sec = e.target.closest('[data-section-id]');
      if (sec) {
        try {
          window.parent.postMessage(
            { type: 'mood-preview:section-clicked',
              sectionId: sec.getAttribute('data-section-id'),
              sectionType: sec.getAttribute('data-section-type') },
            '*',
          );
        } catch { /* noop */ }
      }
    };
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick);
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
