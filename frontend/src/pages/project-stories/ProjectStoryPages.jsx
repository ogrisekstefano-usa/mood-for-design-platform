/**
 * STORE-004 · Project Story™
 * Surface narrativa cinematic. 6 sezioni. NO PDF editor, NO Canva.
 * Riceve il share token via URL pubblico /story/:token e mostra full-screen.
 *
 * Esporta:
 *   - ProjectStoriesListPage  (lista studio)
 *   - ProjectStoryViewer      (full-screen scroll + sezioni)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Plus, Share2, Sparkles, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import './project-story.css';

export const ProjectStoriesListPage = () => {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get('/api/project-stories')
      .then((r) => ({ ok: true, items: r.data?.items || [] }))
      .catch(() => ({ ok: false, items: [] }))
      .then((res) => { if (alive) { setItems(res.items); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return (
    <div className="ps-canvas" data-testid="project-stories-list">
      <header className="ps-hero">
        <p className="ps-eyebrow">Project Story™</p>
        <h1 className="ps-title">Il racconto del progetto, già scritto</h1>
        <p className="ps-lede">
          Ogni Moodboard, Material Board e Specification approvata diventa storia. Una sola esperienza per il cliente.
        </p>
      </header>
      <section className="ps-grid">
        {loading && <p className="ps-empty-cell">Caricamento…</p>}
        {!loading && items.length === 0 && (
          <div className="ps-zero">
            <Sparkles size={32} strokeWidth={1.2} />
            <h3>Nessuna Project Story ancora</h3>
            <p>Apri una Specification approvata e premi <em>Genera Project Story</em>.</p>
          </div>
        )}
        {items.map((s) => (
          <Link key={s.id} to={`/project-stories/${s.id}`}
                className="ps-card" data-testid={`ps-card-${s.id}`}>
            {s.cover_image_url && (
              <div className="ps-card-cover" style={{ backgroundImage: `url(${s.cover_image_url})` }} />
            )}
            <div className="ps-card-body">
              <p className="ps-card-tag">{s.status === 'published' ? 'Pubblicata' : 'Bozza'}</p>
              <h3 className="ps-card-title">{s.title}</h3>
              {s.client_name && <p className="ps-card-client">{s.client_name}</p>}
              <span className="ps-card-open">Apri storia <ArrowUpRight size={12} strokeWidth={1.7} /></span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
};

const SectionCover = ({ s }) => (
  <section className="ps-sec ps-cover">
    {s.cover_image_url ? (
      <div className="ps-cover-bg" style={{ backgroundImage: `url(${s.cover_image_url})` }} />
    ) : (
      <div className="ps-cover-bg ps-cover-bg--gradient" />
    )}
    <div className="ps-cover-veil" />
    <div className="ps-cover-content">
      <p className="ps-cover-eye">Project Story™</p>
      <h1 className="ps-cover-title">{s.sections?.cover?.title || s.title}</h1>
      {(s.sections?.cover?.client || s.client_name) && (
        <p className="ps-cover-client">per {s.sections?.cover?.client || s.client_name}</p>
      )}
      {(s.sections?.cover?.studio || s.studio_name) && (
        <p className="ps-cover-studio">{s.sections?.cover?.studio || s.studio_name}</p>
      )}
    </div>
  </section>
);

const SectionVision = ({ data }) => (
  <section className="ps-sec ps-vision">
    <p className="ps-sec-eye">Vision</p>
    <h2 className="ps-sec-title">{data?.headline || 'La direzione del progetto'}</h2>
    <p className="ps-sec-body">{data?.body}</p>
  </section>
);

const SectionMoodboard = ({ data, entityMap }) => (
  <section className="ps-sec ps-moodboard">
    <p className="ps-sec-eye">Moodboard</p>
    <h2 className="ps-sec-title">{data?.title || 'L\u2019atmosfera scelta'}</h2>
    {data?.entity_ids?.length > 0 ? (
      <div className="ps-mb-grid">
        {data.entity_ids.slice(0, 16).map((eid) => {
          const e = entityMap?.[eid] || {};
          return (
            <div key={eid} className="ps-mb-tile">
              <p className="ps-mb-name">{e.display_name || '—'}</p>
              <p className="ps-mb-meta">{e.brand_name || ''}</p>
            </div>
          );
        })}
      </div>
    ) : <p className="ps-sec-empty">Nessun elemento Moodboard.</p>}
  </section>
);

const SectionMaterial = ({ data, entityMap }) => (
  <section className="ps-sec ps-material">
    <p className="ps-sec-eye">Material Board</p>
    <h2 className="ps-sec-title">{data?.title || 'La materia del progetto'}</h2>
    {data?.entity_ids?.length > 0 ? (
      <div className="ps-mat-grid">
        {data.entity_ids.slice(0, 12).map((eid) => {
          const e = entityMap?.[eid] || {};
          return (
            <div key={eid} className="ps-mat-tile">
              <p className="ps-mat-type">{e.entity_type || 'material'}</p>
              <p className="ps-mat-name">{e.display_name || '—'}</p>
              <p className="ps-mat-brand">{e.brand_name || ''}</p>
            </div>
          );
        })}
      </div>
    ) : <p className="ps-sec-empty">Nessun materiale selezionato.</p>}
  </section>
);

const SectionProducts = ({ items }) => (
  <section className="ps-sec ps-products">
    <p className="ps-sec-eye">Selected Products</p>
    <h2 className="ps-sec-title">Le scelte che firmano il progetto</h2>
    {items?.length > 0 ? (
      <div className="ps-prod-grid">
        {items.map((p) => (
          <article key={p.entity_id} className="ps-prod-card">
            <p className="ps-prod-brand">{p.brand_name || '—'}</p>
            <h3 className="ps-prod-name">{p.display_name || '—'}</h3>
            <p className="ps-prod-meta">
              {p.entity_type ? `${p.entity_type} · ` : ''}
              {p.quantity ? `${p.quantity} ${p.unit || 'pz'}` : ''}
              {p.code ? ` · ${p.code}` : ''}
            </p>
            {p.material_finish && <p className="ps-prod-finish">{p.material_finish}</p>}
          </article>
        ))}
      </div>
    ) : <p className="ps-sec-empty">Nessun prodotto selezionato.</p>}
  </section>
);

const SectionSummary = ({ data }) => (
  <section className="ps-sec ps-summary">
    <p className="ps-sec-eye">Summary</p>
    <h2 className="ps-sec-title">{data?.closing || 'Un progetto pronto.'}</h2>
    <div className="ps-sum-grid">
      <div className="ps-sum-tile"><span className="ps-sum-n">{data?.items_count || 0}</span><span className="ps-sum-l">Elementi</span></div>
      <div className="ps-sum-tile"><span className="ps-sum-n">{data?.moodboard_count || 0}</span><span className="ps-sum-l">Moodboard</span></div>
      <div className="ps-sum-tile"><span className="ps-sum-n">{data?.material_count || 0}</span><span className="ps-sum-l">Materiali</span></div>
    </div>
  </section>
);

export const ProjectStoryViewer = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/api/project-stories/${id}`)
      .then((r) => ({ ok: true, story: r.data }))
      .catch(() => ({ ok: false, story: null }))
      .then((res) => { if (alive) { setStory(res.story); setLoading(false); } });
    return () => { alive = false; };
  }, [id]);

  // Hydrate entity map · derivato direttamente con useMemo
  const entityMap = useMemo(() => {
    if (!story) return {};
    const map = {};
    (story.sections?.selected_products || []).forEach((p) => {
      if (p.entity_id) map[p.entity_id] = { display_name: p.display_name, brand_name: p.brand_name, entity_type: p.entity_type };
    });
    return map;
  }, [story]);

  const share = () => {
    if (!story?.share_token) return;
    const url = `${window.location.origin}/story/${story.share_token}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  };

  useEffect(() => {
    if (!shareCopied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [shareCopied]);

  if (loading) return <div className="ps-loading">Caricamento Project Story…</div>;
  if (!story)  return <div className="ps-loading">Non trovata · <Link to="/project-stories">Lista</Link></div>;

  return (
    <div className="ps-viewer" data-testid="project-story-viewer">
      <header className="ps-toolbar">
        <button type="button" className="ps-back" onClick={() => nav('/project-stories')}>
          <ArrowLeft size={14} strokeWidth={1.6} /> Lista
        </button>
        <span className="ps-toolbar-title">{story.title}</span>
        <button type="button" className="ps-share" onClick={share}
                data-testid="ps-share-btn">
          <Share2 size={13} strokeWidth={1.7} />
          {shareCopied ? 'Link copiato!' : 'Condividi'}
        </button>
        {story.share_token && (
          <a className="ps-share" href={`/story/${story.share_token}`} target="_blank" rel="noreferrer"
             data-testid="ps-public-link">
            <ExternalLink size={13} strokeWidth={1.7} /> Showroom mode
          </a>
        )}
      </header>

      <main className="ps-scroll">
        <SectionCover s={story} />
        <SectionVision data={story.sections?.vision} />
        <SectionMoodboard data={story.sections?.moodboard} entityMap={entityMap} />
        <SectionMaterial data={story.sections?.material_board} entityMap={entityMap} />
        <SectionProducts items={story.sections?.selected_products} />
        <SectionSummary data={story.sections?.summary} />
      </main>
    </div>
  );
};

/** Public viewer (route /story/:token · no chrome studio) */
export const PublicProjectStoryViewer = () => {
  const { token } = useParams();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get(`/api/story/${token}`)
      .then((r) => ({ ok: true, story: r.data }))
      .catch(() => ({ ok: false, story: null }))
      .then((res) => { if (alive) { setStory(res.story); setLoading(false); } });
    return () => { alive = false; };
  }, [token]);
  if (loading) return <div className="ps-loading">Caricamento…</div>;
  if (!story)  return <div className="ps-loading">Project Story non trovata.</div>;
  const entityMap = {};
  (story.sections?.selected_products || []).forEach((p) => {
    if (p.entity_id) entityMap[p.entity_id] = { display_name: p.display_name, brand_name: p.brand_name, entity_type: p.entity_type };
  });
  return (
    <div className="ps-viewer ps-viewer--public">
      <main className="ps-scroll">
        <SectionCover s={story} />
        <SectionVision data={story.sections?.vision} />
        <SectionMoodboard data={story.sections?.moodboard} entityMap={entityMap} />
        <SectionMaterial data={story.sections?.material_board} entityMap={entityMap} />
        <SectionProducts items={story.sections?.selected_products} />
        <SectionSummary data={story.sections?.summary} />
      </main>
    </div>
  );
};
