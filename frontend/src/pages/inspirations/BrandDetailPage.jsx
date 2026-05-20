/**
 * BrandDetailPage — Brand Detail View™ · lettura curatoriale.
 * Phase D · Sprint D3.
 *
 * Non è un "vendor profile". È:
 *   • le atmosfere prevalenti
 *   • le materialità ricorrenti
 *   • le geografie narrative
 *   • le collezioni
 *   • le moodboard dove il brand vive nello studio
 *
 * Curatorial Insights™ in primo piano (testuali, NON dashboard).
 * Numeri piccoli, secondari. Quick Jump editoriali a Collections /
 * Inspirations / Moodboards / Cultural Editions™.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import BrandFormModal from './BrandFormModal';
import CollectionFormModal from './CollectionFormModal';
import ConfirmCinematicDialog from '../../components/ConfirmCinematicDialog';
import './brand-mode.css';
import './brand-form.css';

const MARKET_LABEL = {
  'us-miami':    'Miami',  'us-nyc':      'New York',
  'us-socal':    'Southern California', 'it-milano':   'Milano',
  'uk-london':   'Londra', 'fr-paris':    'Parigi',
  'ae-dubai':    'Dubai',
  'usa_miami':   'Miami',  'usa_nyc':     'New York',
  'usa_socal':   'Southern California', 'italy_milano':'Milano',
  'uk_london':   'Londra', 'france_paris':'Parigi',
  'uae_dubai':   'Dubai',
};
const formatMarket = (c) => MARKET_LABEL[c] || c;

const Insight = ({ text, idx }) => (
  <li className="bd-insight" data-testid={`bd-insight-${idx}`}>
    <span className="bd-insight__marker">{String(idx + 1).padStart(2, '0')}</span>
    <p>{text}</p>
  </li>
);

const InsightSkeleton = () => (
  <li className="bd-insight bd-insight--skeleton">
    <span className="bd-insight__marker" />
    <div className="bm-skel bm-skel--row" />
  </li>
);

const Tile = ({ src, label, sub, to, testid }) => {
  const inner = (
    <div className="bd-tile" data-testid={testid}>
      <div className="bd-tile__media">
        {src ? <img src={src} alt="" loading="lazy" /> : <Icons.Image size={14} />}
      </div>
      {label && <p className="bd-tile__label">{label}</p>}
      {sub && <p className="bd-tile__sub">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="bd-tile-link">{inner}</Link> : inner;
};

const BrandDetailPage = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [collForm, setCollForm] = useState(null);  // { mode, collection?: {} } | null
  const [confirmDelColl, setConfirmDelColl] = useState(null);  // collection | null

  const reload = () => {
    setProfile(null); setErr(null);
    api.get(`/api/inspirations/registry/brands/${brandId}/curatorial-profile`)
      .then((r) => setProfile(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || 'Profilo non disponibile'));
  };

  useEffect(reload, [brandId]);

  const handleDelete = async () => {
    try {
      await api.delete(`/api/inspirations/registry/brands/${brandId}`);
      toast.success('Produttore rimosso dall\'atlante');
      setConfirmDel(false);
      navigate('/inspirations/brands');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Impossibile rimuovere il produttore');
      setConfirmDel(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!confirmDelColl) return;
    try {
      await api.delete(`/api/inspirations/registry/collections/${confirmDelColl.id}`);
      toast.success(`Collezione "${confirmDelColl.name}" rimossa`);
      setConfirmDelColl(null);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Impossibile rimuovere la collezione');
      setConfirmDelColl(null);
    }
  };

  const collectionsAreEditable = profile?.brand?.is_studio_private;

  if (err) {
    return (
      <div className="bm-root bd-error" data-testid="bd-error">
        <div className="bm-empty">
          <div className="bm-empty__ring"><Icons.AlertCircle size={16} strokeWidth={1.3} /></div>
          <h3>{err}</h3>
          <Link to="/inspirations/brands" className="bm-empty__back">
            <Icons.ArrowLeft size={11} /> Torna all'atlante
          </Link>
        </div>
      </div>
    );
  }

  const loading = !profile;
  const brand = profile?.brand;

  return (
    <div className="bm-root bd-root" data-testid="brand-detail-page">
      {/* Back nav (editorial, sottile) */}
      <Link to="/inspirations/brands" className="bd-back" data-testid="bd-back">
        <Icons.ArrowLeft size={11} strokeWidth={1.5} />
        <span>Atlante curatoriale</span>
      </Link>

      {/* Hero — il brand come linguaggio */}
      <header className="bd-hero">
        <div className="bd-hero__logo">
          {brand?.logo_url
            ? <img src={brand.logo_url} alt="" />
            : <span>{(brand?.name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}</span>}
        </div>
        <div className="bd-hero__body">
          <p className="bd-hero__eyebrow">Lettura curatoriale</p>
          <h1 className="bd-hero__title">
            {loading ? <span className="bm-skel bm-skel--title" /> : brand.name}
          </h1>
          {!loading && brand.positioning && (
            <p className="bd-hero__lead">{brand.positioning}</p>
          )}
          {!loading && (
            <div className="bd-hero__meta">
              {brand.luxury_tier && <span className="bm-tag bm-tag--luxury">{brand.luxury_tier}</span>}
              {(brand.primary_markets || []).slice(0, 4).map((m) => (
                <span key={m} className="bm-tag bm-tag--market">{formatMarket(m)}</span>
              ))}
              {brand.country && <span className="bm-tag">{brand.country}</span>}
              {!brand.is_studio_private && (
                <span className="bm-curated-badge" data-testid="bd-curated-badge">
                  <Icons.Sparkles size={8} strokeWidth={1.6} /> Curato da MOOD
                </span>
              )}
            </div>
          )}
          {/* Edit/Delete row · only for studio_private brands. Click handlers
              wired to the BrandFormModal (edit) and ConfirmCinematicDialog
              (delete). Curated_public brands stay read-only. */}
          {!loading && brand.is_studio_private && (
            <div className="bm-actions" data-testid="bd-actions" style={{ marginTop: 8 }}>
              <button type="button"
                      className="bm-action-btn"
                      onClick={() => setEditOpen(true)}
                      data-testid="bd-edit-brand"
                      title="Modifica produttore">
                <Icons.Pencil size={12} strokeWidth={1.4} />
              </button>
              <button type="button"
                      className="bm-action-btn bm-action-btn--danger"
                      onClick={() => setConfirmDel(true)}
                      data-testid="bd-delete-brand"
                      title="Rimuovi produttore">
                <Icons.Trash2 size={12} strokeWidth={1.4} />
              </button>
            </div>
          )}
        </div>

        {/* Counts: piccoli, secondari, MAI protagonisti */}
        {!loading && (
          <div className="bd-counts" data-testid="bd-counts">
            <span><em>{profile.counts.collections}</em>collezioni</span>
            <span><em>{profile.counts.products}</em>prodotti</span>
            <span><em>{profile.counts.inspirations}</em>riferimenti</span>
            <span><em>{profile.counts.moodboards}</em>moodboard</span>
          </div>
        )}
      </header>

      {/* Curatorial Insights™ — il vero protagonista */}
      <section className="bd-section" data-testid="bd-insights-section">
        <p className="bd-section__eyebrow">Curatorial Insights™</p>
        <ol className="bd-insights">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <InsightSkeleton key={i} />)
            : (profile.curatorial_insights || []).map((t, i) => (
                <Insight key={i} idx={i} text={t} />
              ))}
        </ol>
      </section>

      {/* Atmosfere + Materialità prevalenti — chip eleganti */}
      {!loading && (profile.dominant_atmospheres.length > 0 || profile.dominant_materials.length > 0) && (
        <section className="bd-section bd-section--cols" data-testid="bd-dominants">
          {profile.dominant_atmospheres.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Atmosfere prevalenti</p>
              <div className="bd-chip-cloud">
                {profile.dominant_atmospheres.map((a) => (
                  <span key={a.label} className="bm-chip">{a.label}</span>
                ))}
              </div>
            </div>
          )}
          {profile.dominant_materials.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Materialità ricorrenti</p>
              <div className="bd-chip-cloud">
                {profile.dominant_materials.map((m) => (
                  <span key={m.label} className="bm-chip bm-chip--material">{m.label}</span>
                ))}
              </div>
            </div>
          )}
          {profile.dominant_markets.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Geografie narrative</p>
              <div className="bd-chip-cloud">
                {profile.dominant_markets.map((m) => (
                  <span key={m.label} className="bm-chip bm-chip--market">{formatMarket(m.label)}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Collezioni */}
      {!loading && (profile.collections.length > 0 || collectionsAreEditable) && (
        <section className="bd-section" data-testid="bd-collections-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Collezioni</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="bd-section__count">{profile.collections.length}</span>
              {collectionsAreEditable && (
                <button type="button"
                        className="bm-action-btn"
                        onClick={() => setCollForm({ mode: 'create' })}
                        data-testid="bd-add-collection"
                        title="Aggiungi capitolo editoriale">
                  <Icons.Plus size={12} strokeWidth={1.4} />
                </button>
              )}
            </div>
          </header>
          {profile.collections.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--bp-text-muted)', fontStyle: 'italic', padding: '14px 0' }}>
              Nessuna collezione registrata — il primo capitolo editoriale apre la lettura curatoriale del brand.
            </p>
          ) : (
            <div className="bd-coll-grid">
              {profile.collections.slice(0, 24).map((c) => (
                <div key={c.id} className="bd-coll-card"
                     data-testid={`bd-coll-${c.id}`}
                     style={{ position: 'relative' }}>
                  <p className="bd-coll-card__title">{c.name}</p>
                  <p className="bd-coll-card__meta">
                    {c.year && <em>{c.year}</em>}{c.category && <> · {c.category}</>}
                    {c.season && <> · {c.season.toUpperCase()}</>}
                  </p>
                  {c.description && <p className="bd-coll-card__desc">{c.description}</p>}
                  {collectionsAreEditable && (
                    <div className="bm-actions"
                         style={{ position: 'absolute', top: 8, right: 8, opacity: 0.6, transition: 'opacity .18s' }}
                         onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                         onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; }}>
                      <button type="button"
                              className="bm-action-btn"
                              onClick={() => setCollForm({ mode: 'edit', collection: c })}
                              data-testid={`bd-coll-edit-${c.id}`}
                              title="Modifica collezione"
                              style={{ width: 24, height: 24 }}>
                        <Icons.Pencil size={10} strokeWidth={1.4} />
                      </button>
                      <button type="button"
                              className="bm-action-btn bm-action-btn--danger"
                              onClick={() => setConfirmDelColl(c)}
                              data-testid={`bd-coll-delete-${c.id}`}
                              title="Rimuovi collezione"
                              style={{ width: 24, height: 24 }}>
                        <Icons.Trash2 size={10} strokeWidth={1.4} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Product Inspirations™ — grid editoriale */}
      {!loading && profile.products.length > 0 && (
        <section className="bd-section" data-testid="bd-products-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Product Inspirations™</p>
            <span className="bd-section__count">{profile.counts.products}</span>
          </header>
          <div className="bd-prod-grid">
            {profile.products.slice(0, 18).map((p) => (
              <Tile key={p.id}
                    testid={`bd-product-${p.id}`}
                    src={p.image_url}
                    label={p.product_name || p.title}
                    sub={p.collection} />
            ))}
          </div>
        </section>
      )}

      {/* Editorial References */}
      {!loading && profile.inspirations.length > 0 && (
        <section className="bd-section" data-testid="bd-inspirations-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Riferimenti editoriali</p>
            <span className="bd-section__count">{profile.counts.inspirations}</span>
          </header>
          <div className="bd-prod-grid">
            {profile.inspirations.slice(0, 18).map((p) => (
              <Tile key={p.id}
                    testid={`bd-insp-${p.id}`}
                    src={p.image_url}
                    label={p.title} />
            ))}
          </div>
        </section>
      )}

      {/* Moodboard correlate */}
      {!loading && profile.moodboards.length > 0 && (
        <section className="bd-section" data-testid="bd-moodboards-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Moodboard correlate</p>
            <span className="bd-section__count">{profile.moodboards.length}</span>
          </header>
          <div className="bd-mb-grid">
            {profile.moodboards.map((m) => (
              <Link key={m.id}
                    to={`/moodboards/${m.id}`}
                    className="bd-mb-card"
                    data-testid={`bd-mb-${m.id}`}>
                <div className="bd-mb-card__cover">
                  {m.cover_image_url ? <img src={m.cover_image_url} alt="" /> : <Icons.Layers size={14} />}
                </div>
                <p className="bd-mb-card__title">{m.title || 'Moodboard'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Jump editoriali — coda della pagina */}
      {!loading && (
        <section className="bd-section bd-jumps" data-testid="bd-quick-jump">
          <p className="bd-section__eyebrow">Continua la lettura</p>
          <div className="bd-jump-row">
            <Link to="/inspirations" className="bd-jump" data-testid="bd-jump-inspirations">
              <Icons.Sparkles size={11} /> Inspirations™
            </Link>
            <Link to="/inspirations/collections" className="bd-jump" data-testid="bd-jump-collections">
              <Icons.Library size={11} /> Studio Collections™
            </Link>
            <Link to="/moodboards" className="bd-jump" data-testid="bd-jump-moodboards">
              <Icons.Layers size={11} /> Moodboards™
            </Link>
            <Link to="/cultural-editions" className="bd-jump" data-testid="bd-jump-editions">
              <Icons.Globe size={11} /> Cultural Editions™
            </Link>
          </div>
        </section>
      )}

      {/* Edit Brand Modal */}
      <BrandFormModal
        open={editOpen}
        mode="edit"
        brand={brand}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload()}
      />

      {/* Cinematic Delete Confirm (brand) */}
      <ConfirmCinematicDialog
        open={confirmDel}
        title={`Rimuovere ${brand?.name || 'il produttore'} dall'atlante?`}
        body="Il produttore verrà rimosso dall'atlante curatoriale dello studio. Le collezioni e i moodboard associati restano archiviati."
        confirmLabel="Rimuovi produttore"
        tone="destructive"
        onConfirm={handleDelete}
        onClose={() => setConfirmDel(false)}
        testid="bd-delete-confirm"
      />

      {/* Collection form modal — create/edit */}
      <CollectionFormModal
        open={!!collForm}
        mode={collForm?.mode || 'create'}
        brand={brand}
        collection={collForm?.collection}
        onClose={() => setCollForm(null)}
        onSaved={() => reload()}
      />

      {/* Cinematic Delete Confirm (collection) */}
      <ConfirmCinematicDialog
        open={!!confirmDelColl}
        title={`Rimuovere la collezione "${confirmDelColl?.name || ''}"?`}
        body="La collezione verrà rimossa dal capitolo editoriale del brand. I prodotti già archiviati restano accessibili nell'archivio Inspirations™."
        confirmLabel="Rimuovi collezione"
        tone="destructive"
        onConfirm={handleDeleteCollection}
        onClose={() => setConfirmDelColl(null)}
        testid="bd-coll-delete-confirm"
      />
    </div>
  );
};

export default BrandDetailPage;
