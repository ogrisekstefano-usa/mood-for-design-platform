/**
 * ITER202 · Digital Brand Embassy™
 *
 * Premium brand experience page for architects/designers.
 * Does NOT expose Knowledge Engine technical metrics
 * (no knowledge_score, no audit, no entity counts as scores).
 * Shows only: hero, collections, materials, designers, products,
 * MOOD DNA, brand story, Atlas Certified badge, Studio Library CTA.
 *
 * All content is dynamic from `/api/knowledge/brands/{id}/embassy`.
 * Tenant Chameleon™ theme tokens are honoured (primary/secondary
 * colour, font_heading, font_body) with editorial neutral fallback.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import './brand-embassy.css';

const FALLBACK_HERO_BG =
  'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #312e2b 100%)';

export default function BrandEmbassyPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [heroOpen, setHeroOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productFilter, setProductFilter] = useState({ category: null, collection: null });

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const { data } = await KE.brandEmbassy(brandId);
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Brand non disponibile');
    }
  }, [brandId]);

  useEffect(() => { reload(); }, [reload]);

  // Apply Chameleon tokens to CSS variables at mount/update
  useEffect(() => {
    if (!data?.theme) return;
    const root = document.documentElement;
    const t = data.theme;
    if (t.primary_color)    root.style.setProperty('--embassy-accent', t.primary_color);
    if (t.secondary_color)  root.style.setProperty('--embassy-accent-2', t.secondary_color);
    if (t.font_heading)     root.style.setProperty('--embassy-font-heading', t.font_heading);
    if (t.font_body)        root.style.setProperty('--embassy-font-body', t.font_body);
    return () => {
      // Reset on unmount
      ['--embassy-accent','--embassy-accent-2','--embassy-font-heading','--embassy-font-body']
        .forEach((k) => root.style.removeProperty(k));
    };
  }, [data?.theme]);

  const productsFiltered = useMemo(() => {
    if (!data) return [];
    let list = data.products || [];
    if (productFilter.category) {
      list = list.filter((p) => p.category_slug === productFilter.category);
    }
    if (productFilter.collection) {
      list = list.filter((p) => p.collection_id === productFilter.collection);
    }
    return list;
  }, [data, productFilter]);

  const categoryFacets = useMemo(() => {
    if (!data) return [];
    const m = {};
    for (const p of (data?.products || [])) {
      const k = p.category_slug || 'unclassified';
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (err) {
    return (
      <div className="embassy-page" data-testid="embassy-error">
        <div className="embassy-err">
          <Icons.AlertTriangle size={20} />
          <span>{err}</span>
          <button onClick={() => navigate('/inspirations/brands')} className="embassy-btn">
            Torna ai brand
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="embassy-page" data-testid="embassy-loading">
        <div className="embassy-loading">
          <Icons.Loader2 className="embassy-spin" size={20} />
          <span>Caricamento Brand Embassy…</span>
        </div>
      </div>
    );
  }

  const onLinkStudio = async () => {
    setBusy(true);
    try {
      if (data.studio_library?.linked) {
        await KE.unlinkBrandFromStudio(brandId);
        toast.success('Brand rimosso dalla Studio Library');
      } else {
        await KE.linkBrandToStudio(brandId, {});
        toast.success('Brand aggiunto alla Studio Library™');
      }
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Operazione fallita');
    } finally { setBusy(false); }
  };

  const onRegenerateMood = async () => {
    setBusy(true);
    try {
      const { data: r } = await KE.regenerateMoodDna(brandId);
      toast.success('MOOD DNA rigenerato');
      setData((d) => d ? ({ ...d, mood_dna: r.mood_dna }) : d);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Rigenerazione fallita');
    } finally { setBusy(false); }
  };
  return (
    <div className="embassy-page" data-testid="embassy-page">
      <TopBar brand={data.brand}
              isLinked={data.studio_library?.linked}
              onLink={onLinkStudio}
              busy={busy} />

      <Hero hero={data.hero}
            brand={data.brand}
            atlasBadgeAt={data.brand?.atlas_certified_at
                          || (data.brand?.verified ? new Date().toISOString() : null)}
            onEdit={() => setHeroOpen(true)} />

      {data.mood_dna?.length > 0 && (
        <MoodDnaSection moods={data.mood_dna} onRegenerate={onRegenerateMood} busy={busy} />
      )}

      {data.collections?.length > 0 && (
        <CollectionUniverse collections={data.collections} />
      )}

      {data.materials?.length > 0 && (
        <MaterialIntelligence materials={data.materials}
                               totalFinishes={data.counts?.finishes} />
      )}

      {data.designers?.length > 0 && (
        <DesignersSection designers={data.designers} />
      )}

      {(data.story?.title || data.story?.body) && (
        <StorySection story={data.story} />
      )}

      <ProductsGallery
        products={productsFiltered}
        totalCount={data.products?.length || 0}
        filter={productFilter}
        setFilter={setProductFilter}
        categoryFacets={categoryFacets}
        collections={data.collections || []} />

      {data.academy?.available && data.academy.modules_count > 0 && (
        <AcademySlot modules={data.academy.modules_count} />
      )}

      <StudioLibraryCTA
        linked={data.studio_library?.linked}
        onToggle={onLinkStudio} busy={busy} />

      <ChangeHeroModal
        open={heroOpen}
        onClose={() => setHeroOpen(false)}
        brandId={brandId}
        hero={data.hero}
        story={data.story}
        onSaved={reload} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  TOP BAR                                                            */
/* ─────────────────────────────────────────────────────────────────── */
function TopBar({ brand, isLinked, onLink, busy }) {
  return (
    <header className="embassy-topbar" data-testid="embassy-topbar">
      <nav className="embassy-breadcrumb">
        <Link to="/inspirations/brands" className="embassy-bc-link"
              data-testid="embassy-back">
          <Icons.ChevronLeft size={14} />
          <span>Brands</span>
        </Link>
        <span className="embassy-bc-sep">·</span>
        <span className="embassy-bc-current">{brand.name}</span>
      </nav>
      <div className="embassy-topbar-actions">
        <button className="embassy-btn"
                onClick={() => navigator.clipboard?.writeText(window.location.href)
                  .then(() => toast.success('Link copiato'))}
                data-testid="embassy-share">
          <Icons.Share2 size={14} />
          <span>Share Brand</span>
        </button>
        {brand.website && (
          <a href={brand.website} target="_blank" rel="noopener noreferrer"
              className="embassy-btn" data-testid="embassy-website">
            <Icons.ExternalLink size={14} />
            <span>Visit Website</span>
          </a>
        )}
        <button className={`embassy-btn ${isLinked ? 'embassy-btn-linked' : 'embassy-btn-primary'}`}
                onClick={onLink} disabled={busy}
                data-testid="embassy-link-studio">
          {isLinked ? <Icons.BookmarkCheck size={14} /> : <Icons.Bookmark size={14} />}
          <span>{isLinked ? 'In Studio Library' : 'Add to Studio Library™'}</span>
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  HERO                                                               */
/* ─────────────────────────────────────────────────────────────────── */
function Hero({ hero, brand, atlasBadgeAt, onEdit }) {
  const imageStyle = hero.image_url
    ? { backgroundImage: `url(${hero.image_url})` }
    : { backgroundImage: FALLBACK_HERO_BG };
  return (
    <section className="embassy-hero" data-testid="embassy-hero">
      <div className="embassy-hero-bg" style={imageStyle} />
      <div className="embassy-hero-veil" />
      <div className="embassy-hero-content">
        <h1 className="embassy-hero-title" data-testid="embassy-hero-title">
          {hero.title}
        </h1>
        {hero.subtitle && (
          <p className="embassy-hero-subtitle" data-testid="embassy-hero-subtitle">
            {hero.subtitle}
          </p>
        )}
        {hero.description && (
          <p className="embassy-hero-description" data-testid="embassy-hero-description">
            {hero.description}
          </p>
        )}
        <div className="embassy-hero-badges">
          {brand.verified && (
            <span className="embassy-badge embassy-badge--verified"
                   data-testid="embassy-verified-badge">
              <Icons.BadgeCheck size={14} />
              <span>Verified Brand</span>
            </span>
          )}
          {atlasBadgeAt && (
            <span className="embassy-badge embassy-badge--atlas"
                   data-testid="embassy-atlas-badge"
                   title={`Brand Atlas Certified · ${atlasBadgeAt}`}>
              <Icons.Award size={14} />
              <span>Certified Brand Atlas™</span>
            </span>
          )}
        </div>
      </div>
      <button className="embassy-hero-edit"
               onClick={onEdit}
               data-testid="embassy-hero-edit"
               aria-label="Modifica hero">
        <Icons.Pencil size={14} />
        <span>Change Hero</span>
      </button>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  MOOD DNA                                                           */
/* ─────────────────────────────────────────────────────────────────── */
function MoodDnaSection({ moods, onRegenerate, busy }) {
  return (
    <section className="embassy-section" data-testid="embassy-mood-dna">
      <SectionHeader
        eyebrow="MOOD DNA™"
        title="The brand in 5 words"
        cta={
          <button className="embassy-btn-ghost" onClick={onRegenerate} disabled={busy}
                   data-testid="embassy-regen-mood">
            <Icons.Sparkles size={14} />
            <span>Regenerate</span>
          </button>
        }
      />
      <div className="embassy-mood-row">
        {moods.map((m, i) => (
          <span key={i} className="embassy-mood-tag"
                 data-testid={`embassy-mood-tag-${i}`}>
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  COLLECTION UNIVERSE                                                */
/* ─────────────────────────────────────────────────────────────────── */
function CollectionUniverse({ collections }) {
  const top = collections.slice(0, 8);
  const rest = collections.length - top.length;
  return (
    <section className="embassy-section" data-testid="embassy-collections">
      <SectionHeader
        eyebrow="COLLECTION UNIVERSE™"
        title={`${collections.length} collections`}
      />
      <div className="embassy-coll-grid">
        {top.map((c) => (
          <article key={c.id} className="embassy-coll-card"
                    data-testid={`embassy-coll-${c.id}`}>
            <div className="embassy-coll-image"
                  style={{
                    backgroundImage: c.hero_image_url
                      ? `url(${c.hero_image_url})`
                      : FALLBACK_HERO_BG,
                  }} />
            <div className="embassy-coll-overlay">
              <h3 className="embassy-coll-name">{c.name}</h3>
              <p className="embassy-coll-meta">{c.product_count} prodotti</p>
            </div>
          </article>
        ))}
        {rest > 0 && (
          <article className="embassy-coll-card embassy-coll-card--more"
                    data-testid="embassy-coll-more">
            <div className="embassy-coll-overlay embassy-coll-overlay--center">
              <h3 className="embassy-coll-name">+{rest}</h3>
              <p className="embassy-coll-meta">altre collezioni</p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  MATERIAL INTELLIGENCE                                              */
/* ─────────────────────────────────────────────────────────────────── */
function MaterialIntelligence({ materials, totalFinishes }) {
  return (
    <section className="embassy-section" data-testid="embassy-materials">
      <SectionHeader
        eyebrow="MATERIAL INTELLIGENCE™"
        title={`${materials.length} core materials · ${totalFinishes ?? 0} finishes`}
      />
      <div className="embassy-mat-grid">
        {materials.slice(0, 12).map((m) => (
          <div key={m.id} className="embassy-mat-card"
                data-testid={`embassy-mat-${m.id}`}>
            <div className="embassy-mat-swatch" />
            <div className="embassy-mat-label">{m.name}</div>
            <div className="embassy-mat-sub">{m.variant_count} riferimenti</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  DESIGNERS                                                          */
/* ─────────────────────────────────────────────────────────────────── */
function DesignersSection({ designers }) {
  return (
    <section className="embassy-section" data-testid="embassy-designers">
      <SectionHeader
        eyebrow="DESIGNERS & COLLABORATORS™"
        title={`${designers.length} verified designers`}
      />
      <div className="embassy-des-row">
        {designers.map((d) => {
          const initials = (d.name || '')
            .split(/\s+/).slice(0, 2)
            .map((s) => s[0]).join('').toUpperCase();
          return (
            <div key={d.id} className="embassy-des-card"
                  data-testid={`embassy-designer-${d.id}`}>
              <div className="embassy-des-avatar">{initials}</div>
              <div className="embassy-des-name">{d.name}</div>
              <div className="embassy-des-role">{d.role || 'Designer'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  STORY                                                              */
/* ─────────────────────────────────────────────────────────────────── */
function StorySection({ story }) {
  return (
    <section className="embassy-section embassy-section--story"
              data-testid="embassy-story">
      <SectionHeader eyebrow="BRAND STORY" title={story.title || 'Story'} />
      <p className="embassy-story-body">{story.body}</p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  PRODUCTS GALLERY                                                   */
/* ─────────────────────────────────────────────────────────────────── */
function ProductsGallery({ products, totalCount, filter, setFilter,
                            categoryFacets, collections }) {
  return (
    <section className="embassy-section" data-testid="embassy-products">
      <SectionHeader
        eyebrow="PRODUCTS"
        title={`${products.length} of ${totalCount}`}
        cta={
          <div className="embassy-product-filters">
            <select value={filter.category || ''}
                     onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value || null }))}
                     className="embassy-select"
                     data-testid="embassy-filter-category">
              <option value="">All categories</option>
              {categoryFacets.map(([slug, count]) => (
                <option key={slug} value={slug}>{slug} ({count})</option>
              ))}
            </select>
            <select value={filter.collection || ''}
                     onChange={(e) => setFilter((f) => ({ ...f, collection: e.target.value || null }))}
                     className="embassy-select"
                     data-testid="embassy-filter-collection">
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {(filter.category || filter.collection) && (
              <button className="embassy-btn-ghost"
                       onClick={() => setFilter({ category: null, collection: null })}
                       data-testid="embassy-filter-clear">
                <Icons.X size={14} />
              </button>
            )}
          </div>
        }
      />
      <div className="embassy-prod-grid">
        {products.slice(0, 40).map((p) => (
          <article key={p.id} className="embassy-prod-card"
                    data-testid={`embassy-product-${p.id}`}>
            <div className="embassy-prod-image"
                  style={{
                    backgroundImage: p.image_url
                      ? `url(${p.image_url})`
                      : FALLBACK_HERO_BG,
                  }} />
            <div className="embassy-prod-body">
              <div className="embassy-prod-name">{p.name}</div>
              <div className="embassy-prod-cat">{p.category || '—'}</div>
            </div>
          </article>
        ))}
      </div>
      {products.length > 40 && (
        <div className="embassy-prod-footer">
          +{products.length - 40} altri prodotti — usa i filtri per esplorare la collezione completa.
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  ACADEMY (slot)                                                     */
/* ─────────────────────────────────────────────────────────────────── */
function AcademySlot({ modules }) {
  return (
    <section className="embassy-section embassy-section--academy"
              data-testid="embassy-academy">
      <SectionHeader eyebrow="ACADEMY" title="Education for design excellence" />
      <div className="embassy-academy-empty">
        {modules} modules available · Coming soon
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  STUDIO LIBRARY CTA                                                 */
/* ─────────────────────────────────────────────────────────────────── */
function StudioLibraryCTA({ linked, onToggle, busy }) {
  return (
    <section className="embassy-cta" data-testid="embassy-cta-studio">
      <div>
        <div className="embassy-cta-eyebrow">STUDIO LIBRARY™</div>
        <div className="embassy-cta-title">
          {linked
            ? 'Questo brand è nella tua Studio Library'
            : 'Aggiungi alla tua Studio Library'}
        </div>
        <div className="embassy-cta-sub">
          {linked
            ? 'I prodotti, materiali e collezioni di questo brand sono pronti per essere specificati nei tuoi progetti.'
            : 'Connetti il brand al tuo studio per accedere rapidamente a prodotti, materiali e collezioni quando specifichi un progetto.'}
        </div>
      </div>
      <button className={`embassy-btn ${linked ? 'embassy-btn-linked' : 'embassy-btn-primary'}`}
              onClick={onToggle} disabled={busy}
              data-testid="embassy-cta-toggle">
        {linked ? <Icons.BookmarkCheck size={14} /> : <Icons.Bookmark size={14} />}
        <span>{linked ? 'Rimuovi dalla Library' : 'Add to Studio Library™'}</span>
      </button>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  CHANGE HERO MODAL (admin only — backend enforces 403 if not admin) */
/* ─────────────────────────────────────────────────────────────────── */
function ChangeHeroModal({ open, onClose, brandId, hero, story, onSaved }) {
  const [title, setTitle]       = useState(hero?.title || '');
  const [subtitle, setSubtitle] = useState(hero?.subtitle || '');
  const [desc, setDesc]         = useState(hero?.description || '');
  const [storyTitle, setStoryTitle] = useState(story?.title || '');
  const [storyBody, setStoryBody]   = useState(story?.body || '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle(hero?.title || '');
    setSubtitle(hero?.subtitle || '');
    setDesc(hero?.description || '');
    setStoryTitle(story?.title || '');
    setStoryBody(story?.body || '');
  }, [open, hero, story]);

  if (!open) return null;

  const onSave = async () => {
    setBusy(true);
    try {
      await KE.patchBrandHero(brandId, {
        hero_title: title || null,
        hero_subtitle: subtitle || null,
        hero_description: desc || null,
        story_title: storyTitle || null,
        story_body: storyBody || null,
      });
      toast.success('Hero aggiornato');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setBusy(false); }
  };

  const onUploadFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      await KE.uploadBrandHero(brandId, fd);
      toast.success('Immagine hero caricata');
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload fallito');
    } finally { setBusy(false); }
  };

  return (
    <div className="embassy-modal-backdrop" onClick={onClose}
          data-testid="embassy-hero-modal">
      <div className="embassy-modal" onClick={(e) => e.stopPropagation()}>
        <header className="embassy-modal-head">
          <h2>Change Hero</h2>
          <button className="embassy-icon-btn" onClick={onClose} aria-label="Close">
            <Icons.X size={14} />
          </button>
        </header>
        <div className="embassy-modal-body">
          <label className="embassy-field">
            <span>Hero image</span>
            <input ref={fileRef} type="file" accept="image/*"
                    onChange={(e) => onUploadFile(e.target.files?.[0])}
                    data-testid="embassy-hero-file" />
          </label>
          <label className="embassy-field">
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    data-testid="embassy-hero-title-input" />
          </label>
          <label className="embassy-field">
            <span>Subtitle</span>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                    data-testid="embassy-hero-subtitle-input" />
          </label>
          <label className="embassy-field">
            <span>Description</span>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
                       data-testid="embassy-hero-desc-input" />
          </label>
          <label className="embassy-field">
            <span>Story title</span>
            <input type="text" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)}
                    data-testid="embassy-story-title-input" />
          </label>
          <label className="embassy-field">
            <span>Story body</span>
            <textarea rows={5} value={storyBody} onChange={(e) => setStoryBody(e.target.value)}
                       data-testid="embassy-story-body-input" />
          </label>
        </div>
        <footer className="embassy-modal-foot">
          <button className="embassy-btn" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button className="embassy-btn embassy-btn-primary" onClick={onSave} disabled={busy}
                   data-testid="embassy-hero-save">
            {busy ? 'Salvataggio…' : 'Salva'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  SECTION HEADER (shared)                                            */
/* ─────────────────────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, title, cta }) {
  return (
    <header className="embassy-section-head">
      <div>
        <div className="embassy-eyebrow">{eyebrow}</div>
        <h2 className="embassy-section-title">{title}</h2>
      </div>
      {cta && <div className="embassy-section-cta">{cta}</div>}
    </header>
  );
}
