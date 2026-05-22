/**
 * LocalizationScreenshotDrawer · ITER133.
 *
 * Side drawer that, when an admin picks a route from the heatmap grid,
 * reveals the latest crawler screenshot + every detected leak grouped
 * by kind, plus the route's remediation history (links to the leak rows
 * inside the inspector).
 */
import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { SEVERITY, runtimeScreenshotUrl } from './RuntimeLocalizationApi';

const Bucket = ({ kind, items, renderItem }) => {
  if (!items || items.length === 0) return null;
  const meta = SEVERITY[kind] || { color: '#888', label: kind };
  return (
    <div className="mb-6" data-testid={`locgov-drawer-bucket-${kind}`}>
      <p className="mb-3 text-[10px] uppercase tracking-[0.26em] font-mono"
         style={{ color: meta.color }}>
        {meta.label} · {items.length}
      </p>
      <ul className="space-y-2.5">
        {items.slice(0, 25).map((it, idx) => (
          <li key={idx} className="text-[12.5px] leading-[1.6] text-[var(--mood-text-muted, rgba(240,235,224,0.78))] border-l-2 pl-3"
              style={{ borderColor: meta.color }}>
            {renderItem(it)}
          </li>
        ))}
      </ul>
    </div>
  );
};

const LocalizationScreenshotDrawer = ({ route, onClose }) => {
  if (!route) return null;
  const url = route.url;
  const shotUrl = runtimeScreenshotUrl(route.key);

  return (
    <aside
      data-testid="locgov-drawer"
      className="fixed top-0 right-0 h-screen w-[min(720px,100vw)] bg-[var(--mood-bg, #0c0e11)] border-l border-[var(--mood-border, rgba(255,255,255,0.08))] z-[60] overflow-y-auto"
      style={{ boxShadow: '-32px 0 60px rgba(0,0,0,0.6)' }}
    >
      <header className="sticky top-0 bg-[var(--mood-bg, #0c0e11)] z-10 px-8 pt-7 pb-5 border-b border-[var(--mood-border, rgba(255,255,255,0.06))]">
        <button
          type="button"
          onClick={onClose}
          data-testid="locgov-drawer-close"
          aria-label="Close"
          className="absolute right-5 top-5 text-[var(--mood-text-muted, rgba(240,235,224,0.5))] hover:text-[var(--mood-text, #f0ebe0)]"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">
          Route Audit · {route.key}
        </p>
        <h3 className="font-heading text-[24px] leading-[1.2] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-2">
          <code className="font-mono text-[18px]">{url}</code>
        </h3>
        {route.nav_error && (
          <p className="mt-2 text-[11px] font-mono text-[var(--mood-danger, #c25b5b)]">
            nav error · {route.nav_error}
          </p>
        )}
      </header>

      <div className="px-8 py-8">
        <div className="mb-7 border border-[var(--mood-border, rgba(255,255,255,0.06))]">
          <img
            src={shotUrl}
            alt={`Screenshot of ${url}`}
            data-testid="locgov-drawer-screenshot"
            loading="lazy"
            className="block w-full h-auto"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        <Bucket
          kind="RUNTIME_CRASH"
          items={route.page_errors}
          renderItem={(it) => <code className="text-[var(--mood-danger, #c25b5b)]">{it.message}</code>}
        />
        <Bucket
          kind="INVALID_USE_TRANSLATION"
          items={route.raw_keys}
          renderItem={(it) => (
            <>
              <code className="text-[var(--mood-text, #f0ebe0)]">{it.text}</code>
              <br />
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">
                testid · {it.testid || '—'}
              </span>
            </>
          )}
        />
        <Bucket
          kind="MISSING_REGISTRY_KEY"
          items={route.missing_tokens}
          renderItem={(it) => (
            <>
              <code className="text-[var(--mood-text, #f0ebe0)]">{it.text}</code>
              <br />
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">
                testid · {it.testid || '—'}
              </span>
            </>
          )}
        />
        <Bucket
          kind="HARD_CODED_UI"
          items={route.italian_leaks}
          renderItem={(it) => (
            <>
              <span className="font-heading italic">«{it.text}»</span>
              <br />
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--mood-text-faint, rgba(240,235,224,0.4))]">
                testid · {it.testid || '—'}
              </span>
            </>
          )}
        />
        <Bucket
          kind="DB_SEEDED_CONTENT"
          items={route.api_leaks}
          renderItem={(it) => (
            <>
              <code className="text-[var(--mood-text, #f0ebe0)] text-[11.5px]">{it.url}</code>
              <br />
              <span className="text-[10.5px] font-body text-[var(--mood-text-muted, rgba(240,235,224,0.6))]">
                {it.body_excerpt?.slice(0, 220)}{(it.body_excerpt?.length || 0) > 220 ? '…' : ''}
              </span>
            </>
          )}
        />

        <a
          href={`${(process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '')}${url}`}
          target="_blank"
          rel="noreferrer"
          data-testid="locgov-drawer-open-route"
          className="mt-6 inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-accent, #d9b285)] hover:opacity-80"
        >
          <ExternalLink size={11} strokeWidth={1.7} /> Open route in new tab
        </a>
      </div>
    </aside>
  );
};

export default LocalizationScreenshotDrawer;
