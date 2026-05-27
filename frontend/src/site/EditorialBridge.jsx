/**
 * EditorialBridge — ITER157.D · Visual Editor sync bridge.
 *
 * When the public site is loaded with `?editorial=preview`, this
 * component activates a postMessage protocol between the public
 * page (iframe) and the Blueprint Experience editor (parent window).
 *
 * Capabilities:
 *   • Tags every CMS-driven section with a cyan hover outline.
 *   • Click on a section → posts `{type: 'mfd:section-click', section_type}`
 *     so the editor opens that band's editor panel automatically.
 *   • Listens for `{type: 'mfd:scroll-to', section_type}` from the
 *     editor to scroll the iframe to the matching section.
 *
 * Active ONLY when:
 *   1. URL has `?editorial=preview`
 *   2. Page is inside an iframe (window !== window.parent) — never
 *      shows markers on a top-level public visit.
 */
import { useEffect } from 'react';

const isEditorialPreviewMode = () => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('editorial') === 'preview';
  } catch (_) { return false; }
};

const isEmbedded = () => {
  if (typeof window === 'undefined') return false;
  try { return window.parent && window.parent !== window; } catch (_) { return true; }
};

// Mapping: how to identify a section_type from a DOM node.
// Each rule: { selector → section_type }
const SECTION_TAG_RULES = [
  { selector: '.mfd-header',          section_type: 'navigation' },
  { selector: '[data-testid="hero-section"]',     section_type: 'hero_editorial' },
  { selector: '.mfd-trust',                       section_type: 'trust_marquee' },
  { selector: '[data-testid="how-it-works"]',     section_type: 'how_it_works' },
  { selector: '[data-testid="magazine-section"]', section_type: 'editorial_grid' },
  { selector: '[data-testid="design-stories"]',   section_type: 'featured_design_journeys' },
  { selector: '.mfd-materials',                   section_type: 'materials_carousel' },
  { selector: '.mfd-finalcta',                    section_type: 'cinematic_quote' },
  { selector: '.mfd-footer',                      section_type: 'editorial_footer' },
];

const STYLE_ID = 'mfd-editorial-bridge-style';
const HIGHLIGHT_CSS = `
[data-mfd-editable] {
  position: relative;
  transition: outline 0.18s ease, outline-offset 0.18s ease;
  outline: 0 solid transparent;
  outline-offset: 0;
  cursor: pointer;
}
[data-mfd-editable]:hover,
[data-mfd-editable].mfd-editable-active {
  outline: 2px solid #00C9B3;
  outline-offset: -2px;
}
[data-mfd-editable]::before {
  content: attr(data-mfd-label);
  position: absolute;
  top: 0; left: 0;
  background: #0a0e10;
  color: #00C9B3;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-bottom-right-radius: 6px;
  z-index: 9998;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}
[data-mfd-editable]:hover::before,
[data-mfd-editable].mfd-editable-active::before {
  opacity: 1;
}
.mfd-editable-toolbar {
  position: fixed; top: 12px; right: 12px; z-index: 99999;
  background: rgba(8, 12, 16, 0.94);
  color: #e6f7f4;
  border: 1px solid #1e2a32;
  border-radius: 999px;
  padding: 6px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  backdrop-filter: blur(8px);
  display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,.4);
}
.mfd-editable-toolbar .mfd-eb-dot {
  width: 8px; height: 8px; border-radius: 999px; background: #00C9B3;
}
`;

const tagSections = () => {
  SECTION_TAG_RULES.forEach(({ selector, section_type }) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.hasAttribute('data-mfd-editable')) return;
      el.setAttribute('data-mfd-editable', section_type);
      el.setAttribute('data-mfd-label', `Edit · ${section_type}`);
    });
  });
};

const mountToolbar = () => {
  if (document.querySelector('.mfd-editable-toolbar')) return;
  const t = document.createElement('div');
  t.className = 'mfd-editable-toolbar';
  t.innerHTML = '<span class="mfd-eb-dot"></span> EDITORIAL · CLICK A SECTION';
  document.body.appendChild(t);
};

const EditorialBridge = () => {
  useEffect(() => {
    if (!isEditorialPreviewMode()) return undefined;

    // Inject styles once.
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = HIGHLIGHT_CSS;
      document.head.appendChild(s);
    }

    // Initial pass + observe DOM additions.
    tagSections();
    const obs = new MutationObserver(() => tagSections());
    obs.observe(document.body, { childList: true, subtree: true });

    // Show floating toolbar only when embedded in the editor iframe.
    if (isEmbedded()) mountToolbar();

    // Click handler — emit section-click to parent.
    const onClick = (e) => {
      const target = e.target.closest('[data-mfd-editable]');
      if (!target) return;
      // Allow normal in-section clicks unless meta/alt held — but in editor preview
      // we want to ALWAYS intercept to avoid following links. Studio knows best.
      if (isEmbedded()) {
        e.preventDefault();
        e.stopPropagation();
      }
      const section_type = target.getAttribute('data-mfd-editable');
      try {
        window.parent?.postMessage({
          source: 'mfd-editorial',
          type:   'mfd:section-click',
          section_type,
        }, '*');
      } catch (_) { /* noop */ }
      // Visual feedback on the public side.
      document.querySelectorAll('.mfd-editable-active').forEach((n) => n.classList.remove('mfd-editable-active'));
      target.classList.add('mfd-editable-active');
    };
    document.addEventListener('click', onClick, true);

    // Listen for scroll requests from the editor.
    const onMsg = (ev) => {
      const data = ev?.data || {};
      if (data.source !== 'mfd-editor') return;
      if (data.type === 'mfd:scroll-to' && data.section_type) {
        const node = document.querySelector(`[data-mfd-editable="${data.section_type}"]`);
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.querySelectorAll('.mfd-editable-active').forEach((n) => n.classList.remove('mfd-editable-active'));
          node.classList.add('mfd-editable-active');
        }
      } else if (data.type === 'mfd:reload') {
        window.location.reload();
      }
    };
    window.addEventListener('message', onMsg);

    // Ping parent we are ready.
    try {
      window.parent?.postMessage({ source: 'mfd-editorial', type: 'mfd:bridge-ready' }, '*');
    } catch (_) { /* noop */ }

    return () => {
      obs.disconnect();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('message', onMsg);
    };
  }, []);

  return null;
};

export default EditorialBridge;
