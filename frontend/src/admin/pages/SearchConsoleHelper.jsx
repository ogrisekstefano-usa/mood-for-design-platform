import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Search, Globe, CheckCircle2, XCircle } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const PUBLIC_SITE = 'https://www.moodfordesign.com';

/**
 * SearchConsoleHelper — admin tool to monitor & assist SEO indexing.
 *
 * Surfaces:
 *  - direct URLs to robots.txt and sitemap.xml (in production)
 *  - live preview of the sitemap (counts urls + sniffs hreflang coverage)
 *  - quick links to Google Search Console + Bing Webmaster Tools
 *  - per-locale URL coverage check (sampled from sitemap)
 */
const SearchConsoleHelper = () => {
  const [sitemap, setSitemap] = useState({ loading: true, urls: 0, locales: [], error: null });
  const [robotsStatus, setRobotsStatus] = useState({ loading: true, ok: false });

  useEffect(() => {
    fetch(`${BACKEND}/api/site/sitemap.xml`)
      .then((r) => r.text())
      .then((xml) => {
        const urlCount = (xml.match(/<loc>/g) || []).length;
        const hreflangMatches = Array.from(xml.matchAll(/hreflang="([^"]+)"/g));
        const localeSet = new Set(hreflangMatches.map((m) => m[1]).filter((l) => l !== 'x-default'));
        setSitemap({ loading: false, urls: urlCount, locales: Array.from(localeSet).sort(), error: null });
      })
      .catch((e) => setSitemap({ loading: false, urls: 0, locales: [], error: e.message }));

    fetch('/robots.txt')
      .then((r) => setRobotsStatus({ loading: false, ok: r.ok }))
      .catch(() => setRobotsStatus({ loading: false, ok: false }));
  }, []);

  return (
    <div style={{ color: '#FFF', fontFamily: 'Inter, sans-serif' }} data-testid="search-console-helper">
      <h2 style={h2}>SEO & indexing</h2>
      <p style={subtitle}>
        Stato dell'infrastruttura SEO della piattaforma — sitemap dinamica, robots, hreflang multilingua.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
        <Card title="Sitemap dinamica" icon={FileText} state={sitemap.loading ? 'loading' : sitemap.error ? 'error' : 'ok'}>
          <KV k="URL totali"   v={sitemap.loading ? '…' : sitemap.urls.toString()} />
          <KV k="Locale coperti" v={sitemap.loading ? '…' : (sitemap.locales.join(' · ') || '—')} />
          <ButtonRow>
            <ExtLink href={`${BACKEND}/api/site/sitemap.xml`} label="Apri sitemap" />
            <ExtLink href={`${PUBLIC_SITE}/api/site/sitemap.xml`} label="Versione produzione" />
          </ButtonRow>
        </Card>

        <Card title="robots.txt" icon={Globe} state={robotsStatus.loading ? 'loading' : robotsStatus.ok ? 'ok' : 'warning'}>
          <KV k="Disponibile" v={robotsStatus.loading ? '…' : (robotsStatus.ok ? 'sì' : 'no — verifica deploy')} />
          <KV k="Esclusioni" v="/admin · /api" />
          <ButtonRow>
            <ExtLink href={`/robots.txt`} label="Apri robots.txt" />
          </ButtonRow>
        </Card>

        <Card title="Hreflang multilingua" icon={Search} state="ok">
          <p style={small}>
            Ogni pagina pubblica espone automaticamente:
            <br />· <code>&lt;link rel="canonical"&gt;</code>
            <br />· <code>&lt;link rel="alternate" hreflang="…"&gt;</code> per ogni locale
            <br />· un <code>x-default</code> verso <code>en-us</code>
          </p>
          <ButtonRow>
            <ExtLink href={`${PUBLIC_SITE}`} label="Verifica live" />
          </ButtonRow>
        </Card>
      </div>

      <h3 style={h3}>Strumenti esterni</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ToolCard
          title="Google Search Console"
          desc="Invia la sitemap, monitora la copertura, risolvi gli errori di indicizzazione."
          href="https://search.google.com/search-console"
        />
        <ToolCard
          title="Bing Webmaster Tools"
          desc="Stesse funzionalità per Bing + Yahoo. Spesso sottovalutato, ma indicizza in poche ore."
          href="https://www.bing.com/webmasters"
        />
        <ToolCard
          title="Rich Results Test"
          desc="Verifica che Open Graph, Twitter card e schema.org siano leggibili dai crawler."
          href="https://search.google.com/test/rich-results"
        />
        <ToolCard
          title="Sitemap Validator"
          desc="Verifica che il sitemap.xml sia ben formato secondo lo standard sitemaps.org."
          href="https://www.xml-sitemaps.com/validate-xml-sitemap.html"
        />
      </div>

      <div style={hint}>
        <strong style={{ color: 'var(--mood-teal, #00C9B3)' }}>Prima del lancio:</strong>{' '}
        invia il sitemap a Google Search Console e Bing Webmaster Tools. Una volta indicizzato,
        gli aggiornamenti dei contenuti dal CMS appariranno automaticamente alla prossima passata
        del crawler (in genere entro 48h).
      </div>
    </div>
  );
};

// ── inline subcomponents ──────────────────────────────────────────────
const Card = ({ title, icon: Icon, state, children }) => (
  <div style={{
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.2rem 1.4rem',
    display: 'flex', flexDirection: 'column', gap: '0.8rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon size={16} color="var(--mood-teal, #00C9B3)" />
      <span style={{ fontSize: '0.78rem', fontWeight: 500,
                     letterSpacing: '0.16em', textTransform: 'uppercase',
                     color: '#FFF' }}>
        {title}
      </span>
      {state === 'ok' && <CheckCircle2 size={14} color="rgba(0,201,179,0.9)" style={{ marginLeft: 'auto' }} />}
      {state === 'warning' && <XCircle size={14} color="rgba(245,166,35,0.9)" style={{ marginLeft: 'auto' }} />}
      {state === 'error' && <XCircle size={14} color="rgba(255,128,128,0.9)" style={{ marginLeft: 'auto' }} />}
    </div>
    {children}
  </div>
);

const KV = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.82rem' }}>
    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{k}</span>
    <span style={{ color: '#FFF', fontWeight: 400, textAlign: 'right' }}>{v}</span>
  </div>
);

const ButtonRow = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{children}</div>
);

const ExtLink = ({ href, label }) => (
  <a href={href} target="_blank" rel="noreferrer" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: '0.74rem', letterSpacing: '0.04em',
    color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none',
    border: '1px solid rgba(0,201,179,0.32)', padding: '0.4rem 0.8rem',
  }}>
    {label} <ExternalLink size={11} />
  </a>
);

const ToolCard = ({ title, desc, href }) => (
  <a href={href} target="_blank" rel="noreferrer" style={{
    display: 'block', textDecoration: 'none',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.2rem 1.4rem',
    transition: 'all 0.2s ease',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,201,179,0.32)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: '0.92rem', color: '#FFF', fontWeight: 500 }}>{title}</span>
      <ExternalLink size={13} color="rgba(255,255,255,0.4)" />
    </div>
    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: 0 }}>
      {desc}
    </p>
  </a>
);

const h2 = { fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', margin: 0, fontWeight: 400 };
const h3 = { fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', marginTop: '2.4rem', marginBottom: '1rem', fontWeight: 400 };
const subtitle = { fontSize: '0.86rem', color: 'rgba(255,255,255,0.55)', maxWidth: 640, marginTop: 8 };
const small = { fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: 0 };
const hint = {
  marginTop: '2.4rem', padding: '1.1rem 1.4rem',
  background: 'rgba(0,201,179,0.05)',
  border: '1px solid rgba(0,201,179,0.18)',
  fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)',
  lineHeight: 1.6,
};

export default SearchConsoleHelper;
