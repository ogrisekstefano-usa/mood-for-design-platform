// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Article detail (Phase Y.1 + Y.3 lite)
// Cinematic editorial reader with Design References™ hotspots.
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowUpRight, BookOpen, Plus, X, Check, Send, Globe } from 'lucide-react';
import { useDwellRead } from '../../hooks/useMarketSignal';
import { SiteProvider, useSite } from '../../site/SiteContext';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import { navigationContent } from '../../site/content/navigation';
import { tenantConfig } from '../../site/content/tenant';
import ArticleHead from './ArticleHead';
import PreviewBanner from './PreviewBanner';
import '../../site/site.css';
import './magazine.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SESSION_KEY = 'mfd_session';

const T = {
  it: { back: 'Magazine', references: 'DESIGN REFERENCES', share: 'Salva questa atmosfera', loading: 'Caricamento…', notFound: 'Articolo non disponibile.', readMin: 'min di lettura', saveCta: 'Salva nel mio progetto', sendCta: 'Parla con il mio referente', mbCta: 'Aggiungi alla moodboard', exploreCta: 'Esplora la palette', soft_title: 'Crea il tuo spazio progetto', soft_body: 'Per salvare questo riferimento ti chiediamo solo nome ed email — ti accompagneremo poi nella scoperta del progetto.', soft_email: 'La tua email', soft_first: 'Nome', soft_project: 'Tipo di progetto (es. residenza)', soft_save: 'Salva e continua', soft_cancel: 'Annulla', toast_anon: 'Riferimento salvato · ti accompagniamo nell\'onboarding', toast_advisor: 'Riferimento condiviso con', toast_default: 'Riferimento salvato nel tuo progetto.', related_eyebrow: 'CONTINUA LA SCOPERTA', related_title: 'Altre storie editoriali curate dallo studio.' },
  en: { back: 'Magazine', references: 'DESIGN REFERENCES', share: 'Save this atmosphere', loading: 'Loading…', notFound: 'Article unavailable.', readMin: 'min read', saveCta: 'Save to my project', sendCta: 'Discuss with my advisor', mbCta: 'Add to my moodboard', exploreCta: 'Explore the palette', soft_title: 'Create your project space', soft_body: 'To save this reference we only need your name and email — we\'ll then guide you through the project discovery.', soft_email: 'Your email', soft_first: 'First name', soft_project: 'Project type (e.g. residential)', soft_save: 'Save & continue', soft_cancel: 'Cancel', toast_anon: 'Reference saved · we\'ll guide you through onboarding', toast_advisor: 'Reference shared with', toast_default: 'Reference saved to your project.', related_eyebrow: 'CONTINUE THE DISCOVERY', related_title: 'More editorial stories curated by the studio.' },
};

const ctaCopy = (action, locale) => {
  const t = T[locale] || T.it;
  switch (action) {
    case 'send_to_advisor':
    case 'discuss_with_advisor':  return t.sendCta;
    case 'add_to_moodboard':      return t.mbCta;
    case 'explore_material':      return t.exploreCta;
    default:                       return t.saveCta;
  }
};

const TYPE_LABEL = {
  material: 'Material', fabric: 'Fabric', lighting: 'Lighting', furniture: 'Furniture',
  finish: 'Finish', atmosphere: 'Atmosphere', color_palette: 'Color palette',
  product: 'Product', custom: 'Reference',
};

// ─── Hotspot pin + popover ──────────────────────────────────────────────
const Hotspot = ({ hotspot, articleId, locale, onSave, onSent, openSoftLead }) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const lc = hotspot.locale_content?.[locale] || hotspot.locale_content?.it || {};
  const label = lc.label || 'Design reference';
  const description = lc.description;
  const ctaLabel = lc.cta_label || ctaCopy(hotspot.cta_action, locale);

  // Smart positioning so the popover never escapes the figure frame.
  // - vertical: open above when the pin is in the bottom half
  // - horizontal: anchor left/center/right depending on x_pct
  const pos = useMemo(() => {
    const x = Number(hotspot.x_pct) || 50;
    const y = Number(hotspot.y_pct) || 50;
    return {
      vertical: y > 55 ? 'above' : 'below',
      horizontal: x < 22 ? 'left' : x > 78 ? 'right' : 'center',
    };
  }, [hotspot.x_pct, hotspot.y_pct]);

  const handleSave = async () => {
    const session = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } })();
    setSending(true);
    try {
      if (session?.access_token) {
        const r = await axios.post(`${BACKEND_URL}/api/magazine/client/save-reference`, {
          article_id: articleId,
          hotspot_id: hotspot.id,
          locale,
          title: label, description, image_url: hotspot.image_url,
          reference_type: hotspot.reference_type,
          action: hotspot.cta_action,
        }, { headers: { Authorization: `Bearer ${session.access_token}` } });
        onSent?.(r.data);
      } else {
        // Anonymous: open soft lead capture
        openSoftLead({ hotspot, articleId });
      }
    } catch (e) {
      // Silent fail for now — toast pre-existing
    } finally {
      setSending(false);
      setOpen(false);
    }
  };

  return (
    <div
      className="mfd-hotspot"
      style={{ left: `${hotspot.x_pct}%`, top: `${hotspot.y_pct}%` }}
      data-testid={`hotspot-${hotspot.id}`}
    >
      <button
        type="button"
        className={`mfd-hotspot__pin ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        data-testid={`hotspot-pin-${hotspot.id}`}
      >
        <span className="mfd-hotspot__pin-inner" />
      </button>
      {open && (
        <div
          className={`mfd-hotspot__panel mfd-hotspot__panel--v-${pos.vertical} mfd-hotspot__panel--h-${pos.horizontal}`}
          data-testid={`hotspot-panel-${hotspot.id}`}
        >
          <button
            type="button"
            className="mfd-hotspot__panel-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
            data-testid={`hotspot-close-${hotspot.id}`}
          >
            <X size={11} strokeWidth={1.6} />
          </button>
          <p className="mfd-hotspot__type">{TYPE_LABEL[hotspot.reference_type] || 'Reference'}</p>
          <p className="mfd-hotspot__label">{label}</p>
          {description && <p className="mfd-hotspot__description">{description}</p>}
          <button
            type="button"
            className="mfd-hotspot__cta"
            onClick={handleSave}
            disabled={sending}
            data-testid={`hotspot-cta-${hotspot.id}`}
          >
            {sending ? '…' : ctaLabel}
            <ArrowUpRight size={11} strokeWidth={1.6} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Soft lead capture modal (anonymous flow) ───────────────────────────
const SoftLeadModal = ({ visible, onClose, articleId, hotspot, locale, onCaptured }) => {
  const t = T[locale] || T.it;
  const [form, setForm] = useState({ email: '', first_name: '', project_type: '' });
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.first_name) return;
    setBusy(true);
    try {
      const tenantSlug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
      const lc = hotspot?.locale_content?.[locale] || hotspot?.locale_content?.it || {};
      const r = await axios.post(
        `${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/save-reference`,
        {
          article_id: articleId,
          hotspot_id: hotspot?.id,
          locale,
          title: lc.label, description: lc.description, image_url: hotspot?.image_url,
          reference_type: hotspot?.reference_type,
          email: form.email, first_name: form.first_name, project_type: form.project_type || null,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
        }
      );
      onCaptured?.(r.data);
    } catch (_) {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mfd-soft-lead" data-testid="soft-lead-modal" role="dialog" aria-modal="true">
      <div className="mfd-soft-lead__panel">
        <button type="button" className="mfd-soft-lead__close" onClick={onClose} aria-label="Close" data-testid="soft-lead-close">
          <X size={14} strokeWidth={1.5} />
        </button>
        <p className="mfd-soft-lead__eyebrow">DESIGN REFERENCES</p>
        <h3 className="mfd-soft-lead__title">{t.soft_title}</h3>
        <p className="mfd-soft-lead__body">{t.soft_body}</p>
        <form onSubmit={handleSubmit} className="mfd-soft-lead__form">
          <input type="text" placeholder={t.soft_first} value={form.first_name}
                 onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                 required data-testid="soft-lead-first-name" />
          <input type="email" placeholder={t.soft_email} value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })}
                 required data-testid="soft-lead-email" />
          <input type="text" placeholder={t.soft_project} value={form.project_type}
                 onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                 data-testid="soft-lead-project-type" />
          <button type="submit" disabled={busy} data-testid="soft-lead-submit">
            {busy ? '…' : t.soft_save} <ArrowUpRight size={13} strokeWidth={1.6} />
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Article body renderer ──────────────────────────────────────────────
const ArticleBody = ({ blocks, hotspots, locale, articleId, openSoftLead, onSentRef }) => {
  const hotspotsByBlock = useMemo(() => {
    const map = {};
    for (const h of hotspots || []) {
      (map[h.block_id] ||= []).push(h);
    }
    return map;
  }, [hotspots]);

  // Normalize a block hotspot (embedded in b.hotspots[], new schema)
  // to the legacy `Hotspot` component shape (which expects locale_content).
  const normalizeEmbeddedHotspots = (raw) => (raw || []).map((h) => {
    // Already in legacy shape (has locale_content) → pass through.
    if (h.locale_content) return h;
    return {
      id: h.id,
      x_pct: h.x_pct,
      y_pct: h.y_pct,
      reference_type: h.kind || h.reference_type || 'atmosphere',
      cta_action: h.cta_action || 'save_reference',
      locale_content: {
        it: { label: h.title || '', description: h.description || '' },
        en: { label: h.title || '', description: h.description || '' },
      },
    };
  });

  // Extract textual content from a block — supports legacy
  // locale_content envelope AND new flat shape.
  const textOf = (b, key = 'text') => {
    if (b.locale_content) {
      const lc = b.locale_content[locale] || b.locale_content.it || {};
      return lc[key] || '';
    }
    return b[key] || '';
  };

  return (
    <div className="mfd-article__body" data-testid="article-body">
      {(blocks || []).map((b, i) => {
        const lc = b.locale_content?.[locale] || b.locale_content?.it || {};
        const blockKey = b.id || `b-${i}`;
        // Block hotspots — prefer embedded (new schema), fall back to
        // hotspotsByBlock[block_id] (legacy magazine_articles schema).
        const embeddedHs = b.hotspots && b.hotspots.length > 0
          ? normalizeEmbeddedHotspots(b.hotspots)
          : (hotspotsByBlock[b.id] || []);

        if (b.type === 'hero') return null;

        if (b.type === 'paragraph') {
          const txt = textOf(b);
          if (!txt) return null;
          return (
            <p key={blockKey} className="mfd-article__para" data-testid={`block-${blockKey}`}>{txt}</p>
          );
        }
        if (b.type === 'quote' || b.type === 'pull_quote') {
          const txt = textOf(b);
          const author = textOf(b, 'author') || b.attribution || '';
          if (!txt) return null;
          return (
            <blockquote key={blockKey} className="mfd-article__quote" data-testid={`block-${blockKey}`}>
              <p>{txt}</p>
              {author && <cite>— {author}</cite>}
            </blockquote>
          );
        }
        if (b.type === 'image' || b.type === 'hotspot_image' || (b.type === 'gallery' && b.image_url && !(b.items?.length))) {
          // Single image or hotspot_image (new) or single-image legacy gallery.
          const url = b.url || b.image_url;
          const caption = b.caption || lc.caption || '';
          if (!url) return null;
          // Filter + focal-point styles inlined (no new imports for the
          // leaf renderer). Matches the SiteImage signature.
          const imgStyle = {};
          const f = b.filters;
          if (f) {
            const parts = [];
            if (f.brightness != null && f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
            if (f.contrast   != null && f.contrast   !== 1) parts.push(`contrast(${f.contrast})`);
            if (f.saturation != null && f.saturation !== 1) parts.push(`saturate(${f.saturation})`);
            if (parts.length) imgStyle.filter = parts.join(' ');
            if (f.rotate != null && f.rotate !== 0) imgStyle.transform = `rotate(${f.rotate}deg)`;
          }
          const fp = b.focal_point;
          if (fp && (fp.x != null || fp.y != null)) {
            imgStyle.objectPosition = `${(fp.x ?? 0.5) * 100}% ${(fp.y ?? 0.5) * 100}%`;
          }
          return (
            <figure key={blockKey} className="mfd-article__figure" data-testid={`block-${blockKey}`}>
              <div className="mfd-article__figure-media">
                <img src={url} alt={b.alt_text || lc.alt || ''} loading="lazy" style={imgStyle} />
                {embeddedHs.map((h) => (
                  <Hotspot key={h.id}
                           hotspot={{ ...h, image_url: url }}
                           articleId={articleId}
                           locale={locale}
                           openSoftLead={openSoftLead}
                           onSent={onSentRef} />
                ))}
              </div>
              {caption && <figcaption>{caption}</figcaption>}
            </figure>
          );
        }
        if (b.type === 'gallery' && (b.items || []).length > 0) {
          // Mini gallery block (new schema)
          return (
            <div key={blockKey} className="mfd-article__minigallery" data-testid={`block-${blockKey}`}
                 style={{
                   display: 'grid',
                   gridTemplateColumns: `repeat(${Math.min(b.items.length, 3)}, 1fr)`,
                   gap: '0.8rem',
                   margin: '2rem 0',
                 }}>
              {b.items.map((g, gi) => {
                const ig = {};
                const gf = g.filters;
                if (gf) {
                  const parts = [];
                  if (gf.brightness != null && gf.brightness !== 1) parts.push(`brightness(${gf.brightness})`);
                  if (gf.contrast   != null && gf.contrast   !== 1) parts.push(`contrast(${gf.contrast})`);
                  if (gf.saturation != null && gf.saturation !== 1) parts.push(`saturate(${gf.saturation})`);
                  if (parts.length) ig.filter = parts.join(' ');
                  if (gf.rotate != null && gf.rotate !== 0) ig.transform = `rotate(${gf.rotate}deg)`;
                }
                const gfp = g.focal_point;
                if (gfp && (gfp.x != null || gfp.y != null)) {
                  ig.objectPosition = `${(gfp.x ?? 0.5) * 100}% ${(gfp.y ?? 0.5) * 100}%`;
                }
                return (
                  <figure key={g.id || gi} className="mfd-article__minigallery-item" style={{ margin: 0 }}>
                    <img src={g.url} alt={g.alt_text || g.caption || ''} loading="lazy"
                         style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block', ...ig }} />
                    {g.caption && (
                      <figcaption style={{
                        fontSize: '0.8rem', marginTop: '0.35rem',
                        fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                        fontStyle: 'italic',
                        color: 'var(--site-ink-muted, rgba(28,24,20,0.6))',
                      }}>{g.caption}</figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          );
        }
        if (b.type === 'cta') {
          if (!b.label) return null;
          return (
            <div key={blockKey} className="mfd-article__cta" data-testid={`block-${blockKey}`}
                 style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <Link to="/start-project" className="mfd-btn mfd-btn--paper" data-testid={`article-cta-${i}`}>
                {b.label} <ArrowUpRight size={14} />
              </Link>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────
const MagazineArticleInner = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { locale } = useSite();
  const runtime = useLocaleRuntime();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const tenantSlug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
  const t = T[locale] || T.it;
  const [state, setState] = useState({ loading: true, article: null });
  const [related, setRelated] = useState([]);
  const [softLead, setSoftLead] = useState({ visible: false, hotspot: null, articleId: null });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Phase E-2 — try the Editorial Studio variant FIRST (master ×
        // market architecture). Fallback to the legacy magazine_articles
        // path if the slug doesn't correspond to a published variant.
        const params = runtime?.localeCode ? { locale_code: runtime.localeCode } : {};
        // Convert composite IT_IT → BCP-47 it-IT for the editorial lookup.
        const bcp = (runtime?.localeCode || '').toLowerCase().replace('_', '-');
        let served = null;
        const sessionToken = (() => {
          try {
            const s = JSON.parse(localStorage.getItem('mfd_session') || 'null');
            return s?.access_token || null;
          } catch { return null; }
        })();
        try {
          const headers = isPreview && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
          const re = await axios.get(
            `${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/editorial/${encodeURIComponent(slug)}`,
            { params: { ...(bcp ? { locale_code: bcp } : {}), ...(isPreview ? { preview: 1 } : {}) }, headers },
          );
          if (re.data?.article) served = re.data.article;
        } catch (_) { /* fall through to legacy */ }
        if (!served) {
          const r = await axios.get(
            `${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/articles/${encodeURIComponent(slug)}`,
            { params }
          );
          served = r.data?.article || null;
        }
        if (alive) setState({ loading: false, article: served });
      } catch (_) {
        if (alive) setState({ loading: false, article: null });
      }
      try {
        const rr = await axios.get(`${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/articles/${encodeURIComponent(slug)}/related`);
        if (alive) setRelated(rr.data?.articles || []);
      } catch (_) { if (alive) setRelated([]); }
    })();
    return () => { alive = false; };
  }, [tenantSlug, slug, runtime?.localeCode, isPreview]);

  useEffect(() => {
    if (state.article) {
      const a = state.article;
      const lc = a.locale_content?.[locale] || a.locale_content?.it || {};
      const titleForTab = a.title || lc.title || 'Article';
      document.title = `${titleForTab} · ${tenantConfig?.brand?.name || 'Studio'}`;
    }
  }, [state.article, locale]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  // Dwell-read signal — `article_read` viene emesso DOPO 30s di lettura
  // attiva. Misura risonanza editoriale, non bounce rate.
  useDwellRead({
    articleSlug: slug,
    market: state.article?.market_code || null,
    locale: runtime?.localeCode || locale || null,
    thresholdMs: 30000,
    enabled: !!state.article,
  });

  const handleSentRef = (data) => {
    const msg = data?.advisor_name
      ? `${t.toast_advisor} ${data.advisor_name}.`
      : (data?.toast || t.toast_default);
    setToast({ kind: 'success', text: msg });
  };

  const handleSoftLeadCaptured = (data) => {
    setSoftLead({ visible: false, hotspot: null, articleId: null });
    setToast({ kind: 'success', text: t.toast_anon });
    setTimeout(() => navigate(data?.onboarding_url || '/start-project'), 1800);
  };

  if (state.loading) return <div className="mfd-magazine__empty" data-testid="article-loading">{t.loading}</div>;
  if (!state.article) return <div className="mfd-magazine__empty" data-testid="article-not-found">{t.notFound}</div>;

  const a = state.article;
  const lc = a.locale_content?.[locale] || a.locale_content?.it || {};
  // Phase P0.2.D — overlay culturally-native fields from the approved
  // variant (when the public endpoint surfaced them). Falls back to the
  // legacy locale_content block to keep historical articles renderable.
  const displayTitle    = a.title    || lc.title;
  const displaySubtitle = a.subtitle || lc.summary;
  const displayIntro    = a.intro    || lc.summary;
  const cultural        = a._locale || null;
  const localeServed    = cultural?.served || null;
  const isFallback      = !!cultural?.fallback;

  return (
    <div className="mfd-site mfd-magazine mfd-article" data-surface="storefront"
         data-testid="article-page"
         data-locale-served={localeServed || undefined}>
      <ArticleHead article={a} locale={localeServed || locale} isPreview={isPreview} />
      {isPreview && <PreviewBanner />}
      <header className="mfd-magazine__nav">
        <Link to="/" className="mfd-magazine__brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" />
        </Link>
        <Link to="/magazine" className="mfd-magazine__back" data-testid="article-back">
          <ArrowLeft size={12} strokeWidth={1.5} /> {t.back}
        </Link>
      </header>

      <section className="mfd-article__hero" data-testid="article-hero">
        {(a.hero_url || a.cover_url) && (
          <img src={a.hero_url || a.cover_url} alt={displayTitle || ''} loading="eager" />
        )}
        <div className="mfd-article__hero-overlay">
          {localeServed && (
            <p className="mfd-article__perspective"
               data-testid="article-perspective-badge"
               style={{
                 display: 'inline-flex', alignItems: 'center', gap: 6,
                 padding: '0.35rem 0.7rem', marginBottom: '0.75rem',
                 fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
                 color: 'rgba(255,255,255,0.78)',
                 border: '1px solid rgba(216,180,122,0.45)',
                 borderRadius: 999,
                 background: 'rgba(0,0,0,0.25)',
                 backdropFilter: 'blur(6px)',
               }}>
              <Globe size={10} strokeWidth={1.6} />
              <span>{localeServed} Perspective</span>
              {isFallback && (
                <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 'normal', fontSize: 10 }}>
                  · closest cultural register
                </span>
              )}
            </p>
          )}
          <p className="mfd-article__kicker">{lc.kicker}</p>
          <h1 className="mfd-article__h1">{displayTitle}</h1>
          <p className="mfd-article__summary">{displaySubtitle}</p>
          <p className="mfd-article__meta">
            <BookOpen size={11} strokeWidth={1.5} /> {a.reading_minutes || 4} {t.readMin}
          </p>
        </div>
      </section>

      <ArticleBody
        blocks={a.body_blocks}
        hotspots={a.hotspots}
        locale={locale}
        articleId={a.id}
        openSoftLead={(payload) => setSoftLead({ visible: true, ...payload })}
        onSentRef={handleSentRef}
      />

      <section className="mfd-article__footer">
        <p className="mfd-article__refs-eyebrow">{t.references}</p>
        <p className="mfd-article__refs-count">{(a.hotspots || []).length} curated</p>
      </section>

      {related.length > 0 && (
        <section className="mfd-article__related" data-testid="article-related">
          <p className="mfd-article__related-eyebrow">{t.related_eyebrow}</p>
          <h2 className="mfd-article__related-title">{t.related_title}</h2>
          <div className="mfd-article__related-grid">
            {related.map((r) => {
              const rl = r.locale_content?.[locale] || r.locale_content?.it || {};
              return (
                <Link key={r.id} to={`/magazine/${r.slug}`}
                      className="mfd-article__related-card" data-testid={`article-related-${r.slug}`}>
                  <div className="mfd-article__related-card-media">
                    {(r.cover_url || r.hero_url) && (
                      <img src={r.cover_url || r.hero_url} alt="" loading="lazy" />
                    )}
                  </div>
                  <h3 className="mfd-article__related-card-title">{rl.title}</h3>
                  <p className="mfd-article__related-card-meta">
                    {r.reading_minutes || 4} {t.readMin}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <SoftLeadModal
        visible={softLead.visible}
        hotspot={softLead.hotspot}
        articleId={softLead.articleId}
        locale={locale}
        onClose={() => setSoftLead({ visible: false, hotspot: null, articleId: null })}
        onCaptured={handleSoftLeadCaptured}
      />

      {toast && (
        <div className="mfd-toast" data-testid="article-toast" role="status">
          <Check size={12} strokeWidth={1.6} /> {toast.text}
        </div>
      )}
    </div>
  );
};

const MagazineArticlePage = () => (
  <SiteProvider>
    <MagazineArticleInner />
  </SiteProvider>
);

export default MagazineArticlePage;
