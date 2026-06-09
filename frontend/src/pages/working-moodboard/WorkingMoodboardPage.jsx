/**
 * WorkingMoodboardPage · STORE-012B · MOODBOARD V2.1
 * Design Intelligence Workspace™ — the operational heart of the project.
 *
 * Two rendering states on a single route:
 *   /studio/moodboards/working/:id                  → Edit Mode
 *   /studio/moodboards/working/:id?mode=presentation → Showroom Presentation Mode™
 *
 * Edit Mode layout
 *   ┌──────────────────────────────────────┬──────────────────────┐
 *   │ 5 sections (Vision / Materials /     │ Project Brain™       │
 *   │ Products / Atmosphere / Notes)       │ (sticky right)       │
 *   └──────────────────────────────────────┴──────────────────────┘
 *
 * Presentation Mode = no Brain · no toolbar · cinematic narrative:
 *   Vision → Atmosphere → Materials → Products → Highlights → Next Steps
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles, Eye, Edit3, ArrowLeft, Check, Loader2, X,
  Compass, Layers, Package, ImageIcon, NotebookPen, Star,
  ExternalLink,
} from 'lucide-react';
import api from '../../lib/api';
import './working-moodboard.css';

const APPROVAL_OPTIONS = [
  { key: 'suggested', label: 'Suggested' },
  { key: 'discussed', label: 'Discussed' },
  { key: 'approved',  label: 'Approved'  },
  { key: 'rejected',  label: 'Rejected'  },
];

const SECTION_ICON = {
  vision:     Sparkles,
  materials:  Layers,
  products:   Package,
  atmosphere: ImageIcon,
  notes:      NotebookPen,
};

const PRESENTATION_ORDER = ['vision', 'atmosphere', 'materials', 'products', 'highlights', 'next_steps'];

const WorkingMoodboardPage = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const presentation = params.get('mode') === 'presentation';

  const [pages, setPages] = useState([]);
  const [elementsByPage, setElementsByPage] = useState({});
  const [brain, setBrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moodboard, setMoodboard] = useState(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const [payloadRes, brainRes] = await Promise.all([
          api.get(`/api/moodboards/${id}/working-payload`),
          api.get(`/api/moodboards/${id}/project-brain`).catch(() => ({ data: null })),
        ]);
        if (cancel) return;
        setMoodboard({ id, title: payloadRes.data.title });
        setPages(payloadRes.data.sections || []);
        const map = {};
        (payloadRes.data.sections || []).forEach((s) => {
          map[s.page_id] = s.elements || [];
        });
        setElementsByPage(map);
        setBrain(brainRes.data);
      } catch (e) {
        console.error('Working moodboard load failed', e?.response?.data || e);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => { cancel = true; };
  }, [id]);

  const togglePresentation = () => {
    const next = new URLSearchParams(params);
    if (presentation) next.delete('mode'); else next.set('mode', 'presentation');
    setParams(next, { replace: false });
  };

  const setApproval = async (elementId, newStatus) => {
    // Optimistic update
    setElementsByPage(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(pid => {
        next[pid] = next[pid].map(el => {
          if (el.id !== elementId) return el;
          const content = typeof el.content === 'string' ? safeParse(el.content) : (el.content || {});
          return { ...el, content: { ...content, approval_status: newStatus } };
        });
      });
      return next;
    });
    try {
      await api.patch(`/api/moodboard-elements/${elementId}/approval-status`, { approval_status: newStatus });
    } catch (e) {
      console.error('approval patch failed', e?.response?.data || e);
    }
  };

  // Sections from the working-payload (already grouped server-side)
  const sections = useMemo(() => {
    return pages.map((p) => {
      const Icon = SECTION_ICON[p.section] || Compass;
      return {
        section:  p.section,
        title:    p.title,
        Icon,
        page_id:  p.page_id,
        elements: elementsByPage[p.page_id] || p.elements || [],
      };
    });
  }, [pages, elementsByPage]);

  if (loading) {
    return (
      <div className="wmb-shell" data-testid="working-moodboard-loading">
        <div className="wmb-loading"><Loader2 size={18} className="wmb-spin" /> Loading Working Moodboard…</div>
      </div>
    );
  }

  return (
    <div className={`wmb-shell ${presentation ? 'wmb-shell--present' : ''}`} data-testid="working-moodboard">
      <header className="wmb-top" data-testid="wmb-top">
        <Link to={brain?.journey_id ? `/studio/journey/${brain.journey_id}` : '/dashboard'}
              className="wmb-top__back" data-testid="wmb-back">
          <ArrowLeft size={14} /> Journey
        </Link>
        <div className="wmb-top__title">
          <p className="wmb-top__eyebrow">Working Moodboard</p>
          <h1 className="wmb-top__heading">{moodboard?.title || brain?.working_seed?.direction_name || 'Working Moodboard'}</h1>
        </div>
        <button
          type="button"
          onClick={togglePresentation}
          className="wmb-btn wmb-btn--ghost"
          data-testid="wmb-toggle-mode"
        >
          {presentation ? <><Edit3 size={13} /> Edit</> : <><Eye size={13} /> Presentation</>}
        </button>
      </header>

      <div className="wmb-body">
        <main className={`wmb-main ${presentation ? 'wmb-main--present' : ''}`}>
          {!presentation && sections.map((s) => (
            <SectionEdit key={s.page_id} section={s} onApproval={setApproval} />
          ))}

          {presentation && <PresentationView sections={sections} brain={brain} />}
        </main>

        {/* Project Brain™ — Edit mode only */}
        {!presentation && brain && (
          <aside className="wmb-brain" data-testid="project-brain">
            <ProjectBrain brain={brain} />
          </aside>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 *  EDIT SECTION
 * ───────────────────────────────────────────────────────────── */
const SectionEdit = ({ section, onApproval }) => {
  const Icon = section.Icon;
  return (
    <section className="wmb-section" data-testid={`wmb-section-${section.section}`}>
      <header className="wmb-section__hdr">
        <Icon size={16} className="wmb-section__icon" />
        <h2 className="wmb-section__title">{section.title}</h2>
        <span className="wmb-section__count">{section.elements.length}</span>
      </header>
      <div className={`wmb-section__grid wmb-section__grid--${section.section}`}>
        {section.elements.length === 0 && (
          <p className="wmb-section__empty">No elements in this section yet.</p>
        )}
        {section.elements.map((el) => (
          <ElementCard key={el.id} el={el} onApproval={onApproval} />
        ))}
      </div>
    </section>
  );
};

const ElementCard = ({ el, onApproval }) => {
  const content = typeof el.content === 'string' ? safeParse(el.content) : (el.content || {});
  const status = content.approval_status || 'suggested';

  let body = null;
  if (el.type === 'image') {
    body = content.file_url ? (
      <div className="wmb-el__image"><img src={content.file_url} alt={el.title || ''} loading="lazy" /></div>
    ) : <div className="wmb-el__image wmb-el__image--ph" />;
  } else if (el.type === 'material') {
    body = (
      <div className="wmb-el__entity">
        <p className="wmb-el__eyebrow">Material</p>
        <p className="wmb-el__name">{content.display_name || el.title || 'Material'}</p>
        <p className="wmb-el__ids">entity · {(content.entity_id || '').slice(0, 8)}…{content.brand_id ? ` · brand ${content.brand_id.slice(0,6)}…` : ''}</p>
      </div>
    );
  } else if (el.type === 'product') {
    body = (
      <div className="wmb-el__entity">
        <p className="wmb-el__eyebrow">Product</p>
        <p className="wmb-el__name">{content.display_name || el.title || 'Product'}</p>
        <p className="wmb-el__ids">entity · {(content.entity_id || '').slice(0, 8)}…</p>
      </div>
    );
  } else if (el.type === 'palette') {
    body = (
      <div className="wmb-el__palette">
        {(content.colors || []).map((c, i) => (
          <span key={i} style={{ background: c }} title={c} />
        ))}
      </div>
    );
  } else if (el.type === 'text') {
    body = (
      <div className="wmb-el__text">
        <p className={`wmb-el__text-${content.variant || 'body'}`}>{content.text}</p>
      </div>
    );
  } else {
    body = <div className="wmb-el__text"><p className="wmb-el__text-body">{el.title || el.type}</p></div>;
  }

  return (
    <article className={`wmb-el wmb-el--${el.type} wmb-el--${status}`} data-testid={`wmb-el-${el.id}`}>
      {body}
      <ApprovalChips status={status} elementId={el.id} onApproval={onApproval} />
    </article>
  );
};

const ApprovalChips = ({ status, elementId, onApproval }) => (
  <div className="wmb-el__approval" role="group" aria-label="approval">
    {APPROVAL_OPTIONS.map((opt) => (
      <button
        key={opt.key}
        type="button"
        className={`wmb-approval ${status === opt.key ? 'is-on' : ''} wmb-approval--${opt.key}`}
        onClick={() => onApproval(elementId, opt.key)}
        data-testid={`wmb-approval-${opt.key}-${elementId}`}
      >
        {status === opt.key && <Check size={10} strokeWidth={3} />}
        {opt.label}
      </button>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────
 *  PROJECT BRAIN™
 * ───────────────────────────────────────────────────────────── */
const ProjectBrain = ({ brain }) => {
  const nx = brain.recommended_next_action;
  const pref = brain.concept_pulse?.preferred_direction;
  return (
    <div className="wmb-brain__inner">
      <header className="wmb-brain__hdr">
        <Sparkles size={14} />
        <span className="wmb-brain__title">Project Brain™</span>
      </header>

      {/* Recommended Next Action */}
      <section className="wmb-brain__next" data-testid="brain-next-action">
        <p className="wmb-brain__eyebrow">Recommended Next Action™</p>
        <p className="wmb-brain__next-headline">{nx.headline}</p>
        {nx.hint && <p className="wmb-brain__next-hint">{nx.hint}</p>}
      </section>

      {pref && (
        <section className="wmb-brain__pref" data-testid="brain-preferred">
          <p className="wmb-brain__eyebrow">Client preferred direction</p>
          <p className="wmb-brain__pref-name">
            <Star size={11} strokeWidth={2.5} /> {pref.direction_name}
          </p>
        </section>
      )}

      {/* Discovery snapshot */}
      <section className="wmb-brain__box">
        <p className="wmb-brain__eyebrow">Discovery</p>
        {brain.discovery.style_dna?.length > 0 && (
          <div className="wmb-brain__dna">
            {brain.discovery.style_dna.slice(0, 3).map((s) => (
              <div key={s.key} className="wmb-brain__dna-row">
                <span>{s.label}</span>
                <span className="wmb-brain__dna-score">{s.score}%</span>
              </div>
            ))}
          </div>
        )}
        {brain.discovery.material_dna?.length > 0 && (
          <ul className="wmb-brain__mats">
            {brain.discovery.material_dna.slice(0, 4).map((m) => (
              <li key={m.key}>{m.label}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Project facts */}
      {brain.project?.project_type && (
        <section className="wmb-brain__box">
          <p className="wmb-brain__eyebrow">Project</p>
          <p className="wmb-brain__txt">{brain.project.project_type}</p>
          {brain.discovery.investment_profile && (
            <p className="wmb-brain__txt">{brain.discovery.investment_profile}</p>
          )}
        </section>
      )}

      {brain.client?.first_name && (
        <section className="wmb-brain__box">
          <p className="wmb-brain__eyebrow">Client</p>
          <p className="wmb-brain__txt">{brain.client.first_name} {brain.client.last_name || ''}</p>
        </section>
      )}

      {brain.journey_id && (
        <Link to={`/studio/journey/${brain.journey_id}`} className="wmb-brain__link" data-testid="brain-open-journey">
          Open Journey <ExternalLink size={11} />
        </Link>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 *  SHOWROOM PRESENTATION MODE™
 * ───────────────────────────────────────────────────────────── */
const PresentationView = ({ sections, brain }) => {
  // Compose narrative — order by PRESENTATION_ORDER.
  const sectionByKey = Object.fromEntries(sections.map(s => [s.section, s]));
  return (
    <div className="wmb-present">
      {/* Vision */}
      <section className="wmb-present__act wmb-present__vision" data-testid="present-vision">
        {sectionByKey.vision?.elements.find(e => e.type === 'text')?.title && (
          <h2 className="wmb-present__title">
            {safeParse(sectionByKey.vision.elements.find(e => e.type === 'text').content).text}
          </h2>
        )}
        {brain?.working_seed?.direction_name && !sectionByKey.vision && (
          <h2 className="wmb-present__title">{brain.working_seed.direction_name}</h2>
        )}
        {/* Hero image */}
        {sectionByKey.vision?.elements
          .filter(e => e.type === 'image')
          .slice(0, 1)
          .map(e => {
            const c = safeParse(e.content);
            return c.file_url ? <img key={e.id} src={c.file_url} alt="" className="wmb-present__hero" /> : null;
          })}
      </section>

      {/* Atmosphere */}
      {sectionByKey.atmosphere?.elements.length > 0 && (
        <section className="wmb-present__act" data-testid="present-atmosphere">
          <p className="wmb-present__eyebrow">Atmosphere</p>
          <div className="wmb-present__gallery">
            {sectionByKey.atmosphere.elements.filter(e => e.type === 'image').map(e => {
              const c = safeParse(e.content);
              return c.file_url ? <img key={e.id} src={c.file_url} alt="" /> : null;
            })}
          </div>
        </section>
      )}

      {/* Materials */}
      {sectionByKey.materials?.elements.length > 0 && (
        <section className="wmb-present__act" data-testid="present-materials">
          <p className="wmb-present__eyebrow">Materials</p>
          <ul className="wmb-present__mat-list">
            {sectionByKey.materials.elements.map(e => {
              const c = safeParse(e.content);
              return (
                <li key={e.id}>
                  <span className="wmb-present__mat-name">{c.display_name || e.title || 'Material'}</span>
                  <span className="wmb-present__mat-meta">{c.entity_type || ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Products */}
      {sectionByKey.products?.elements.length > 0 && (
        <section className="wmb-present__act" data-testid="present-products">
          <p className="wmb-present__eyebrow">Products</p>
          <ul className="wmb-present__prod-list">
            {sectionByKey.products.elements.map(e => {
              const c = safeParse(e.content);
              return (
                <li key={e.id}>
                  <span>{c.display_name || e.title || 'Product'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Highlights — derived from approved elements across sections */}
      <HighlightsAct sections={sections} />

      {/* Next Steps */}
      {brain?.recommended_next_action && (
        <section className="wmb-present__act wmb-present__next" data-testid="present-next-steps">
          <p className="wmb-present__eyebrow">Next Steps</p>
          <h3 className="wmb-present__next-headline">{brain.recommended_next_action.headline}</h3>
        </section>
      )}
    </div>
  );
};

const HighlightsAct = ({ sections }) => {
  const approved = [];
  sections.forEach(s => {
    s.elements.forEach(el => {
      const c = safeParse(el.content);
      if (c.approval_status === 'approved') approved.push({ el, c });
    });
  });
  if (!approved.length) return null;
  return (
    <section className="wmb-present__act" data-testid="present-highlights">
      <p className="wmb-present__eyebrow">Highlights · Approved</p>
      <ul className="wmb-present__hl">
        {approved.map(({ el, c }) => (
          <li key={el.id}>
            <span>{c.display_name || el.title || c.text || el.type}</span>
            <Check size={12} strokeWidth={3} />
          </li>
        ))}
      </ul>
    </section>
  );
};

/* utils */
function safeParse(v) {
  if (typeof v !== 'string') return v || {};
  try { return JSON.parse(v); } catch { return {}; }
}

export default WorkingMoodboardPage;
