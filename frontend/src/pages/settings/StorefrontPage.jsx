/**
 * StorefrontPage — Tenant Storefront overview (Session A placeholder).
 *
 * Currently shows the structure & sources of the public storefront so the
 * SuperAdmin understands WHERE content lives today. The full DB-backed editor
 * is delivered in Session B (Phase H.5 — Backend CMS Foundation).
 */
import React from 'react';
import { ArrowLeft, ExternalLink, FileText, Palette, Image as ImageIcon, Globe } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useBlueprint } from '../../contexts/BlueprintContext';

const SectionRow = ({ pageKey, title, source, status, link }) => (
  <tr data-testid={`storefront-row-${pageKey}`} className="border-b border-[var(--bp-border)]">
    <td className="py-3 pr-4">
      <p className="text-[var(--bp-text-primary)] text-sm font-body font-medium">{title}</p>
      <p className="text-[var(--bp-text-muted)] text-[11px] font-body mt-0.5">{pageKey}</p>
    </td>
    <td className="py-3 pr-4 text-[var(--bp-text-muted)] text-xs font-body"><code>{source}</code></td>
    <td className="py-3 pr-4">
      <span className={`text-[10px] font-body uppercase tracking-[0.18em] px-2 py-1 ${status === 'live' ? 'bg-[#C9A36E]/15 text-[#8B6F3D]' : 'bg-[var(--bp-text-muted)]/10 text-[var(--bp-text-muted)]'}`}>
        {status}
      </span>
    </td>
    <td className="py-3 text-right">
      <Link to={link} target="_blank" rel="noopener noreferrer" className="text-[var(--bp-primary)] text-xs font-body uppercase tracking-[0.2em] inline-flex items-center gap-1.5">
        Open <ExternalLink size={12} />
      </Link>
    </td>
  </tr>
);

const StorefrontPage = () => {
  const navigate = useNavigate();
  const { t } = useBlueprint();

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="storefront-page">
      <button onClick={() => navigate('/settings')}
        className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-xs font-body uppercase tracking-[0.2em] mb-6 inline-flex items-center gap-2"
        data-testid="storefront-back">
        <ArrowLeft size={14} /> {t('common.back', null, 'Back')}
      </button>

      <div className="mb-8">
        <p className="text-[#C9A36E] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">
          {t('settings.section.tenant', null, 'Tenant Storefront')}
        </p>
        <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] mb-2">
          {t('settings.storefront.title', null, 'Storefront Pages')}
        </h1>
        <p className="text-[var(--bp-text-muted)] text-sm font-body max-w-2xl">
          {t('settings.storefront.intro', null, 'These are the public-facing pages of YOUR tenant — the demo store. Content currently lives in frontend config files; full DB-backed editing arrives in Session B.')}
        </p>
      </div>

      {/* Architecture clarification banner */}
      <div className="mb-8 p-5 bg-[var(--bp-surface-2)] border-l-4 border-[#C9A36E] rounded-r-[var(--bp-radius-md)]" data-testid="storefront-architecture-banner">
        <p className="text-[#C9A36E] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2">Architecture</p>
        <ul className="text-[var(--bp-text-secondary)] text-xs font-body space-y-1.5 leading-relaxed">
          <li><strong className="text-[var(--bp-text-primary)]">Tenant Storefront</strong> (this page) — public homepage, projects, onboarding flows. Path: <code>/</code>, <code>/projects</code>, <code>/start-project</code>, <code>/professionals</code></li>
          <li><strong className="text-[var(--bp-text-primary)]">Corporate Platform Pages</strong> — Blueprint OS™ demo content. Path: <code>/settings/pages</code> (separate)</li>
          <li><strong className="text-[var(--bp-text-primary)]">Blueprint Workspace</strong> — your authenticated app. Path: <code>/dashboard</code> + protected routes</li>
        </ul>
      </div>

      <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-6 mb-8" data-testid="storefront-pages-table">
        <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-4">{t('settings.storefront.pagesTitle', null, 'Public pages')}</h2>
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-[var(--bp-border)]">
              <th className="pb-3 pr-4 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">Page</th>
              <th className="pb-3 pr-4 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">Source (Session A)</th>
              <th className="pb-3 pr-4 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <SectionRow pageKey="home"          title="Homepage (Hero · Dual CTA · Values · Projects · Newsletter)" source="src/site/content/homepage.js"      status="live" link="/" />
            <SectionRow pageKey="projects"      title="Projects archive (masonry + filters)"                       source="src/site/content/projects.js"      status="live" link="/projects" />
            <SectionRow pageKey="navigation"    title="Header & Footer"                                            source="src/site/content/navigation.js"    status="live" link="/" />
            <SectionRow pageKey="onboarding"    title="Private wizard (7 steps + final)"                            source="src/site/content/onboarding.js"    status="live" link="/start-project" />
            <SectionRow pageKey="professionals" title="Professionals gateway + 5-step intake"                       source="src/site/content/professionals.js" status="live" link="/professionals" />
            <SectionRow pageKey="ui"            title="Shared UI labels (back, archive, detail, categories)"       source="src/site/content/ui.js"            status="live" link="/" />
          </tbody>
        </table>
      </div>

      {/* Quick actions to existing tenant editors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-testid="storefront-shortcuts">
        <Link to="/settings/navigation" className="block bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-5 hover:border-[var(--bp-border-strong)]">
          <FileText size={18} className="text-[#C9A36E] mb-3" strokeWidth={1.5} />
          <p className="text-[var(--bp-text-primary)] text-sm font-medium font-body">Navigation & Footer</p>
          <p className="text-[var(--bp-text-muted)] text-xs font-body mt-1">Top bar + footer + showroom info</p>
        </Link>
        <Link to="/settings/forms" className="block bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-5 hover:border-[var(--bp-border-strong)]">
          <ImageIcon size={18} className="text-[#C9A36E] mb-3" strokeWidth={1.5} />
          <p className="text-[var(--bp-text-primary)] text-sm font-medium font-body">Forms</p>
          <p className="text-[var(--bp-text-muted)] text-xs font-body mt-1">Onboarding & lead forms</p>
        </Link>
        <Link to="/settings/brand" className="block bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-5 hover:border-[var(--bp-border-strong)]">
          <Palette size={18} className="text-[#C9A36E] mb-3" strokeWidth={1.5} />
          <p className="text-[var(--bp-text-primary)] text-sm font-medium font-body">Brand Studio</p>
          <p className="text-[var(--bp-text-muted)] text-xs font-body mt-1">Theme palette & typography</p>
        </Link>
      </div>

      <div className="p-5 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]" data-testid="storefront-roadmap">
        <p className="text-[var(--bp-text-secondary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2 inline-flex items-center gap-2">
          <Globe size={11} /> {t('settings.storefront.roadmapKicker', null, 'Roadmap — Session B')}
        </p>
        <p className="text-[var(--bp-text-muted)] text-xs font-body leading-relaxed">
          {t('settings.storefront.roadmap', null, 'Session B will introduce: Supabase tables (cms_pages, cms_sections, cms_translations, cms_assets), public endpoint GET /api/cms/public/:tenant/:page_key, migration of these JS configs into DB rows, full inline editor per section, image library via Supabase Storage. The frontend reads via useContent(pageKey) hook with localStorage fallback.')}
        </p>
      </div>
    </div>
  );
};

export default StorefrontPage;
