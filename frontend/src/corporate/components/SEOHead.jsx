import { useEffect } from 'react';

/**
 * SEOHead — pure imperative head manager. No deps on react-helmet.
 *
 * Sets/replaces:
 *   - <title>
 *   - <meta name="description">
 *   - <meta property="og:title">
 *   - <meta property="og:description">
 *   - <meta property="og:image">
 *   - <meta name="twitter:image">
 *
 * On unmount, leaves last values (next page's SEOHead will overwrite).
 */
const upsert = (selector, factory, value) => {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = factory();
    document.head.appendChild(el);
  }
  el.setAttribute(el.tagName === 'TITLE' ? 'data-mood' : 'content', value);
  if (el.tagName === 'TITLE') el.textContent = value;
};

const SEOHead = ({ title, description, ogImage }) => {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let el = document.head.querySelector('meta[name="description"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', 'description');
        document.head.appendChild(el);
      }
      el.setAttribute('content', description);
    }
    upsert(
      'meta[property="og:title"]',
      () => { const m = document.createElement('meta'); m.setAttribute('property','og:title'); return m; },
      title,
    );
    upsert(
      'meta[property="og:description"]',
      () => { const m = document.createElement('meta'); m.setAttribute('property','og:description'); return m; },
      description,
    );
    upsert(
      'meta[property="og:image"]',
      () => { const m = document.createElement('meta'); m.setAttribute('property','og:image'); return m; },
      ogImage,
    );
    upsert(
      'meta[name="twitter:image"]',
      () => { const m = document.createElement('meta'); m.setAttribute('name','twitter:image'); return m; },
      ogImage,
    );
  }, [title, description, ogImage]);
  return null;
};

export default SEOHead;
