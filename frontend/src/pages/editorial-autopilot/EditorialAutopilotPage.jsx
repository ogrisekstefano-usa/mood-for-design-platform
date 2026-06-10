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
import { useT } from '../../contexts/BlueprintContext';
import './editorial-autopilot.css';

const OPP_ICON = {
  BookOpen: BookOpen, Sparkles: Sparkles, Palette: Palette,
  Image: ImageIcon, FileText: FileText, Camera: Camera,
};

const EditorialAutopilotPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    let cancel = false;
    api.get('/api/editorial/autopilot/dashboard')
      .then((r) => { if (!cancel) { setData(r.data); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading) {
    return <div className="eap-shell"><div className="eap-loading">{t('editorial.loading', null, 'Loading Editorial Autopilot…')}</div></div>;
  }
  if (!data) {
    return <div className="eap-shell"><div className="eap-loading">{t('editorial.warming_up', null, 'Editorial Autopilot is warming up. Please retry in a moment.')}</div></div>;
  }

  const { this_week, pipeline, opportunities, markets_covered, markets_uncovered } = data;

  const GENERATE_SOURCES = [
    { id: 'brand_atlas',    eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Brand Atlas',    sub: t('editorial.brand_atlas_sub', null, 'Articles, social and newsletters from your brand heritage.'), href: '/inspirations/brands' },
    { id: 'design_journey', eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Design Journey',  sub: t('editorial.design_journey_sub', null, 'Automatic case studies from active projects.'),             href: '/workspace/projects' },
    { id: 'moodboard',      eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Moodboard',       sub: t('editorial.moodboard_sub', null, 'Pinterest and Instagram from aesthetic directions.'),          href: '/moodboards' },
    { id: 'material_board', eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Material Board',  sub: t('editorial.material_board_sub', null, 'SEO articles from materials curated for the client.'),      href: '/material-boards' },
    { id: 'specification',  eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Specification',   sub: t('editorial.specification_sub', null, 'Landing pages and LinkedIn from commercial documents.'),    href: '/specifications' },
    { id: 'project_story',  eyebrow: t('editorial.generate_from', null, 'Generate Visibility from'), title: 'Project Story',   sub: t('editorial.project_story_sub', null, 'Newsletters and case studies from client presentations.'),  href: '/project-stories' },
  ];

  return (
    <div className="eap-shell" data-testid="editorial-autopilot">
      {/* HERO */}
      <header className="eap-hero">
        <p className="eap-hero__eyebrow">Editorial Autopilot™</p>
        <h1 className="eap-hero__title">{t('editorial.hero_title', null, 'Blueprint AI keeps you visible.')}</h1>
        <p className="eap-hero__sub">
          {t('editorial.hero_sub', null, 'Every week Blueprint AI prepares articles, LinkedIn posts, newsletters and social visuals for your target markets. You approve · we publish.')}
        </p>
      </header>

      {/* SECTION A · THIS WEEK */}
      <section className="eap-section" data-testid="eap-this-week">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">{t('editorial.this_week', null, 'This week')}</h2>
          <span className="eap-section__kicker">{t('editorial.planned_by_market', null, 'Planned content by market')}</span>
        </div>
        <div className="eap-week-grid">
          {this_week.length === 0 && (
            <div className="eap-week-card" style={{ opacity: 0.6 }}>
              <span className="eap-week-card__code">—</span>
              <span className="eap-week-card__label">{t('editorial.no_active_market', null, 'No active market')}</span>
              <span className="eap-week-card__sub">{t('editorial.activate_market_hint', null, 'Go to Settings to activate your target markets.')}</span>
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
                  ? t('editorial.this_week_count', {ready: m.this_week_count, total: m.weekly_frequency}, `${m.this_week_count} of ${m.weekly_frequency} prepared`)
                  : t('editorial.frequency_not_set', null, 'Frequency not set')}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION B · PIPELINE */}
      <section className="eap-section" data-testid="eap-pipeline">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">Pipeline</h2>
          <span className="eap-section__kicker">{t('editorial.content_status', null, 'Content status')}</span>
        </div>
        <div className="eap-pipeline">
          <Link to="/blueprint/editorial/inbox" className="eap-stat" data-testid="eap-stat-in-proofreading">
            <span className="eap-stat__label"><Inbox size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />In Proofreading</span>
            <div className="eap-stat__count eap-stat__count--amber">{pipeline.in_proofreading}</div>
            <span className="eap-stat__cta">{t('editorial.open_inbox', null, 'Open inbox')} <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=approved" className="eap-stat" data-testid="eap-stat-approved">
            <span className="eap-stat__label"><CheckCircle2 size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />{t('editorial.approved', null, 'Approved')}</span>
            <div className="eap-stat__count eap-stat__count--cyan">{pipeline.approved}</div>
            <span className="eap-stat__cta">{t('editorial.ready_to_publish', null, 'Ready for publication')} <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=published" className="eap-stat" data-testid="eap-stat-published">
            <span className="eap-stat__label"><Send size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />{t('editorial.published', null, 'Published')}</span>
            <div className="eap-stat__count">{pipeline.published}</div>
            <span className="eap-stat__cta">{t('editorial.history', null, 'History')} <ArrowUpRight size={12} /></span>
          </Link>
          <Link to="/blueprint/editorial/inbox?status=blocked" className="eap-stat" data-testid="eap-stat-blocked">
            <span className="eap-stat__label"><AlertTriangle size={11} style={{ marginRight: 6, verticalAlign: '-2px' }} />{t('editorial.blocked', null, 'Blocked')}</span>
            <div className="eap-stat__count eap-stat__count--warn">{pipeline.blocked}</div>
            <span className="eap-stat__cta">{t('editorial.media_required', null, 'Media required')} <ArrowUpRight size={12} /></span>
          </Link>
        </div>
      </section>

      {/* SECTION C · OPPORTUNITIES */}
      <section className="eap-section" data-testid="eap-opportunities">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">{t('editorial.content_opportunities', null, 'Content opportunities')}</h2>
          <span className="eap-section__kicker">{t('editorial.calculated_from_heritage', null, 'Calculated from your heritage')}</span>
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
          <h2 className="eap-section__title">{t('editorial.generate_visibility', null, 'Generate Visibility™')}</h2>
          <span className="eap-section__kicker">{t('editorial.content_engine_sources', null, 'Your content engine sources')}</span>
        </div>
        <div className="eap-sources">
          {GENERATE_SOURCES.map((s) => (
            <Link key={s.id} to={s.href} className="eap-source" data-testid={`eap-source-${s.id}`}>
              <span className="eap-source__eyebrow">{s.eyebrow}</span>
              <span className="eap-source__title">{s.title}</span>
              <span className="eap-source__sub">{s.sub}</span>
              <span className="eap-source__cta">{t('common.go', null, 'Go')} <ArrowUpRight size={12} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION E · MARKETS COVERAGE */}
      <section className="eap-section" data-testid="eap-markets">
        <div className="eap-section__hdr">
          <h2 className="eap-section__title">{t('editorial.markets', null, 'Markets')}</h2>
          <span className="eap-section__kicker">{t('editorial.current_coverage', null, 'Current editorial coverage')}</span>
        </div>
        <div className="eap-markets">
          <div className="eap-markets__col">
            <p className="eap-markets__hdr eap-markets__hdr--ok">{t('editorial.covered_this_week', {n: markets_covered.length}, `Covered this week (${markets_covered.length})`)}</p>
            <ul className="eap-markets__list">
              {markets_covered.length === 0 && <li><span>—</span><span className="eap-markets__count">{t('editorial.first_cycle_preparing', null, 'Blueprint AI is preparing the first cycle')}</span></li>}
              {markets_covered.map((m) => (
                <li key={m.market_id}><span>{m.label}</span><span className="eap-markets__count">{m.count} {t('editorial.contents', null, 'contents')}</span></li>
              ))}
            </ul>
          </div>
          <div className="eap-markets__col">
            <p className="eap-markets__hdr eap-markets__hdr--gap">{t('editorial.uncovered', {n: markets_uncovered.length}, `Uncovered (${markets_uncovered.length})`)}</p>
            <ul className="eap-markets__list">
              {markets_uncovered.length === 0 && <li><span>—</span><span className="eap-markets__count">{t('editorial.all_markets_covered', null, 'All active markets are covered')}</span></li>}
              {markets_uncovered.map((m) => (
                <li key={m.market_id}><span>{m.label}</span><span className="eap-markets__count">{t('editorial.preparing', null, 'Blueprint is preparing')}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EditorialAutopilotPage;
