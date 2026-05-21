/**
 * RelationshipGraph — Editorial connection map per un Account.
 *
 * Non è una graph viz. Non ha nodi-collegamenti tecnici. È una mappa
 * editoriale curata che racconta dove la relazione vive:
 *   • Progetti tessuti insieme
 *   • Moodboard condivise
 *   • Cultural Editions™ avviate
 *   • Ispirazioni raccolte
 *   • Materiali in risonanza (con affinity bar editoriale)
 *   • Mercati attivi
 *
 * Tono concierge — frasi narrative, MAI KPI / percentuali tecniche.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers, Globe, Sparkles, Compass, Feather, ArrowUpRight, MapPin,
} from 'lucide-react';
import api from '../../lib/api';
import './relationship-graph.css';
import { useT } from '../../i18n/useT';

const SECTIONS = [
  { key: 'projects',          icon: Compass,  title: 'Progetti tessuti insieme',     empty: 'Nessun progetto ancora collegato.' },
  { key: 'moodboards',        icon: Layers,   title: 'Moodboard condivise',          empty: 'Nessuna moodboard condivisa.' },
  { key: 'cultural_editions', icon: Globe,    title: 'Cultural Editions™ avviate',   empty: 'Nessuna edizione culturale avviata.' },
  { key: 'inspirations',      icon: Sparkles, title: 'Ispirazioni raccolte',         empty: 'Nessuna ispirazione salvata.' },
  { key: 'materials',         icon: Feather,  title: 'Materiali in risonanza',       empty: 'Nessuna affinità materica ancora.' },
  { key: 'markets',           icon: MapPin,   title: 'Mercati attivi',               empty: 'Relazione ancorata a un solo mercato.' },
];

const RelationshipGraph = ({ accountId }) => {
  const { t } = useT();
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    api.get(`/api/relationships/accounts/${accountId}/graph`)
      .then((r) => setGraph(r.data))
      .catch(() => setGraph(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <div className="rgraph rgraph--loading" data-testid="relationship-graph-loading">
        <p className="rgraph__eyebrow">Relationship Graph™</p>
        <p className="rgraph__loading-line">{t('crm.relationship_graph.tracciando_la_mappa_della_relazione')}</p>
      </div>
    );
  }
  if (!graph) return null;

  const total = Object.values(graph.counts || {}).reduce((a, b) => a + b, 0);

  return (
    <section className="rgraph" data-testid="relationship-graph">
      <header className="rgraph__head">
        <p className="rgraph__eyebrow">{t('crm.relationship_graph.relationship_graph_mappa_editoriale')}</p>
        <h3 className="rgraph__title">{t('crm.relationship_graph.dove_vive_la_relazione')}</h3>
        {graph.editorial_summary?.length > 0 && (
          <div className="rgraph__summary">
            {graph.editorial_summary.map((line, i) => (
              <p key={i} className="rgraph__summary-line">{line}</p>
            ))}
          </div>
        )}
      </header>

      {total === 0 ? (
        <div className="rgraph__empty-state">
          <p>{t('crm.relationship_graph.nessun_progetto_moodboard_o_materiale_ancora_colle')}</p>
          <p className="rgraph__empty-hint">
            Avvia una direzione editoriale: condividi una moodboard o avvia una Cultural Edition™.
          </p>
        </div>
      ) : (
        <div className="rgraph__sections">
          {SECTIONS.map(({ key, icon: Icon, title, empty }) => {
            const items = graph[key] || [];
            if (items.length === 0) return null;
            return (
              <article key={key} className="rgraph__section" data-testid={`rgraph-section-${key}`}>
                <header className="rgraph__section-head">
                  <Icon size={13} className="rgraph__section-icon" />
                  <h4 className="rgraph__section-title">{title}</h4>
                  <span className="rgraph__count">{items.length}</span>
                </header>
                <div className="rgraph__chips">
                  {items.slice(0, 8).map((it, i) => (
                    <GraphChip key={it.id || it.intent_id || i} kind={key} item={it} />
                  ))}
                  {items.length > 8 && (
                    <span className="rgraph__more">+{items.length - 8} altre</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

// ─── Single chip — editorial style by section type ────────────────────
const GraphChip = ({ kind, item }) => {
  if (kind === 'projects') {
    const inner = (
      <>
        <span className="rgraph-chip__label">{item.name}</span>
        {item.role && <span className="rgraph-chip__meta">{item.role}</span>}
      </>
    );
    return item.slug ? (
      <Link to={`/site/projects/${item.slug}`} className="rgraph-chip rgraph-chip--clickable">
        {inner} <ArrowUpRight size={11} className="rgraph-chip__icon" />
      </Link>
    ) : <span className="rgraph-chip">{inner}</span>;
  }

  if (kind === 'moodboards') {
    return (
      <span className="rgraph-chip rgraph-chip--soft">
        <span className="rgraph-chip__label">{item.name || 'Moodboard'}</span>
        {item.status && <span className="rgraph-chip__meta">{item.status}</span>}
      </span>
    );
  }

  if (kind === 'cultural_editions') {
    return (
      <span className="rgraph-chip rgraph-chip--accent">
        <Globe size={11} className="rgraph-chip__lead" />
        <span className="rgraph-chip__label">{item.submarket_name || item.submarket_code}</span>
        {item.locale && <span className="rgraph-chip__meta">{item.locale}</span>}
      </span>
    );
  }

  if (kind === 'inspirations') {
    return (
      <span className="rgraph-chip rgraph-chip--soft">
        <span className="rgraph-chip__label">{item.resonance || 'Riferimento'}</span>
        {item.source && <span className="rgraph-chip__meta">{item.source.replace(/_/g, ' ')}</span>}
      </span>
    );
  }

  if (kind === 'materials') {
    const affinityPct = Math.min(100, Math.max(0, Math.round(item.affinity || 0)));
    return (
      <span className="rgraph-chip rgraph-chip--material" title={item.finish || ''}>
        <span className="rgraph-chip__label">{item.name}</span>
        {item.family && <span className="rgraph-chip__meta">{item.family}</span>}
        <span className="rgraph-affinity">
          <span className="rgraph-affinity__bar"
                style={{ width: `${affinityPct}%` }} />
        </span>
      </span>
    );
  }

  if (kind === 'markets') {
    return (
      <span className={`rgraph-chip ${item.is_primary ? 'rgraph-chip--accent' : ''}`}>
        <MapPin size={11} className="rgraph-chip__lead" />
        <span className="rgraph-chip__label">{item.name}</span>
        {item.is_primary && <span className="rgraph-chip__meta">primario</span>}
      </span>
    );
  }

  return <span className="rgraph-chip">{item.name || '—'}</span>;
};

export default RelationshipGraph;
