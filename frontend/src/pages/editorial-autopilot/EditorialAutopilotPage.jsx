/**
 * EditorialAutopilotPage · STORE-008A MVP
 * Business dashboard for the showroom.
 * Replaces the editorial CMS entry experience at /blueprint/editorial.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, CheckCircle2, Send, AlertTriangle, ArrowUpRight,
  BookOpen, Sparkles, Palette, Image as ImageIcon, FileText, Camera,
  Compass, Workflow,
} from 'lucide-react';
import api from '../../lib/api';
import './editorial-autopilot.css';

const OPP_ICON = {
  BookOpen: BookOpen, Sparkles: Sparkles, Palette: Palette,
  Image: ImageIcon, FileText: FileText, Camera: Camera,
};

const GENERATE_SOURCES = [
  { id: 'brand_atlas',     eyebrow: 'Genera Visibilità da',  title: 'Brand Atlas',     sub: 'Articoli, social e newsletter dal tuo patrimonio di brand.', href: '/inspirations/brands' },
  { id: 'design_journey',  eyebrow: 'Genera Visibilità da',  title: 'Design Journey',  sub: 'Case study automatici dai progetti in corso.',              href: '/workspace/projects' },
  { id: 'moodboard',       eyebrow: 'Genera Visibilità da',  title: 'Moodboard',       sub: 'Pinterest e Instagram dalle direzioni estetiche.',          href: '/moodboards' },
  { id: 'material_board',  eyebrow: 'Genera Visibilità da',  title: 'Material Board',  sub: 'SEO articles dai materiali curati per il cliente.',         href: '/material-boards' },
  { id: 'specification',   eyebrow: 'Genera Visibilità da',  title: 'Specification',   sub: 'Landing page e LinkedIn dai documenti commerciali.',        href: '/specifications' },
  { id: 'project_story',   eyebrow: 'Genera Visibilità da',  title: 'Project Story',   sub: 'Newsletter e case study dalle presentazioni cliente.',      href: '/project-stories' },
];

const EditorialAutopilotPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    api.get('/api/editorial/autopilot/dashboard')
      .then((r) => { if (!cancel) { setData(r.data); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading) {
    return <div className="eap-shell"><div className="eap-loading">Loading Editorial Autopilot…</div></div>;
  }
  if (!data) {
    return <div className="eap-shell"><div className="eap-loading">Editorial Autopilot is warming up. Riprova tra un istante.</div></div>;
  }

  const { this_week, pipeline, opportunities, markets_covered, markets_uncovered } = data;

  return (
    <div className="eap-shell" data-testid="editorial-autopilot">
      {/* HERO */}
      <header className="eap-hero">
        <p className="eap-hero__eyebrow">Editorial Autopilot™</p>
        <h1 className="eap-hero__title">Blueprint AI ti tiene visibile.</h1>
        <p className="eap-hero__sub">
          Ogni settimana Blueprint AI prepara articoli, post LinkedIn, newsletter e visuali social
          per i tuoi mercati target. Tu approvi · noi pubblichiamo.
        </p>
      </header>

      {/* SECTION A · THIS WEEK */}
      <section className="eap-section" data-testid="eap-this-week">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Questa settimana</h2>
          <span className="eap-section__kicker">Contenuti pianificati per mercato</span>
        </div>
        <div className="eap-week-grid">
          {this_week.length === 0 && (
            <div className="eap-week-card" style={{ opacity: 0.6 }}>
              <span className="eap-week-card__code">—</span>
              <span className="eap-week-card__label">Nessun mercato attivo</span>
              <span className="eap-week-card__sub">Vai in Settings per attivare i tuoi mercati target.</span>
            </div>
          )}
          {this_week.map((m) => (
            <div key={m.market_id} className="eap-week-card" data-testid={`eap-market-${m.code}`}>
              <span className="eap-week-card__code">{m.code?.replace(/_/g, ' ') || 'Market'}</span>
              <span className="eap-week-card__label">{m.label}</span>
              <span className={`eap-week-card__count ${m.weekly_frequency === 0 ? 'eap-week-card__count--mute' : ''}`}>
                {m.weekly_frequency || 0}
              </span>
              <span className="eap-week-card__sub">
                {m.weekly_frequency > 0
                  ? `${m.this_week_count} su ${m.weekly_frequency} preparati`
                  : 'Frequenza non impostata'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION B · PIPELINE */}
      <section className="eap-section" data-testid="eap-pipeline">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Pipeline</h2>
          <span className="eap-section__kicker">Stato dei contenuti</span>
        </div>
        <div className="eap-pipeline">
          <Link to="/blueprint/editorial/inbox" className="eap-stat" data-testid="eap-stat-in-proofreading">
            <span className="eap-stat__label"><Inbox size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />In Proofreading</span>
            <div className="eap-stat__count eap-stat__count--amber">{pipeline.in_proofreading}</div>
            <span className="eap-stat__cta">Apri inbox <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=approved" className="eap-stat" data-testid="eap-stat-approved">
            <span className="eap-stat__label"><CheckCircle2 size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />Approvati</span>
            <div className="eap-stat__count eap-stat__count--cyan">{pipeline.approved}</div>
            <span className="eap-stat__cta">Pronti per pubblicazione <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=published" className="eap-stat" data-testid="eap-stat-published">
            <span className="eap-stat__label"><Send size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />Pubblicati</span>
            <div className="eap-stat__count">{pipeline.published}</div>
            <span className="eap-stat__cta">Storico <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=blocked" className="eap-stat" data-testid="eap-stat-blocked">
            <span className="eap-stat__label"><AlertTriangle size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />Bloccati</span>
            <div className="eap-stat__count eap-stat__count--warn">{pipeline.blocked}</div>
            <span className="eap-stat__cta">Media richiesti <ArrowUpRight size={12} /></span>
          </Link>
        </div>
      </section>

      {/* SECTION C · OPPORTUNITIES */}
      <section className="eap-section" data-testid="eap-opportunities">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Opportunità di contenuto</h2>
          <span className="eap-section__kicker">Calcolate dal tuo patrimonio</span>
        </div>
        <div className="eap-opportunities">
          {opportunities.map((o) => {
            const Icon = OPP_ICON[o.icon] || Sparkles;
            return (
              <div key={o.key} className="eap-opp" data-testid={`eap-opp-${o.key}`}>
                <div className="eap-opp__icon"><Icon size={18} strokeWidth={1.6} /></div>
                <div className="eap-opp__body">
                  <span className="eap-opp__count">{o.count}</span>
                  <span className="eap-opp__label">{o.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION D · GENERATE VISIBILITY · sources rail */}
      <section className="eap-section" data-testid="eap-generate">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Genera Visibilità™</h2>
          <span className="eap-section__kicker">Le sorgenti del tuo content engine</span>
        </div>
        <div className="eap-sources">
          {GENERATE_SOURCES.map((s) => (
            <Link key={s.id} to={s.href} className="eap-source" data-testid={`eap-source-${s.id}`}>
              <span className="eap-source__eyebrow">{s.eyebrow}</span>
              <span className="eap-source__title">{s.title}</span>
              <span className="eap-source__sub">{s.sub}</span>
              <span className="eap-source__cta">Vai <ArrowUpRight size={12} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION E · MARKETS COVERAGE */}
      <section className="eap-section" data-testid="eap-markets">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Mercati</h2>
          <span className="eap-section__kicker">Copertura editoriale corrente</span>
        </div>
        <div className="eap-markets">
          <div className="eap-markets__col">
            <p className="eap-markets__hdr eap-markets__hdr--ok">Coperti questa settimana ({markets_covered.length})</p>
            <ul className="eap-markets__list">
              {markets_covered.length === 0 && <li><span>—</span><span className="eap-markets__count">Blueprint AI sta preparando il primo ciclo</span></li>}
              {markets_covered.map((m) => (
                <li key={m.market_id}><span>{m.label}</span><span className="eap-markets__count">{m.count} contenuti</span></li>
              ))}
            </ul>
          </div>
          <div className="eap-markets__col">
            <p className="eap-markets__hdr eap-markets__hdr--gap">Scoperti ({markets_uncovered.length})</p>
            <ul className="eap-markets__list">
              {markets_uncovered.length === 0 && <li><span>—</span><span className="eap-markets__count">Tutti i mercati attivi sono coperti</span></li>}
              {markets_uncovered.map((m) => (
                <li key={m.market_id}><span>{m.label}</span><span className="eap-markets__count">Blueprint sta preparando</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EditorialAutopilotPage;
